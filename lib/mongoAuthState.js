// ============================================
// AA MD Bot — MongoDB Auth State
// Replaces useFirebaseAuthState (no disk I/O)
// Stores WhatsApp credentials + signal keys
// in MongoDB — zero local file writes.
// ============================================

import { proto, initAuthCreds, BufferJSON, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { getDb } from './database.js';
import path from 'path';
import fs from 'fs-extra';

// ── BufferJSON helpers ────────────────────────────────────────────────────────
function encodeVal(v) {
  try { return JSON.parse(JSON.stringify(v, BufferJSON.replacer)); } catch { return v; }
}
function decodeVal(v) {
  try { return JSON.parse(JSON.stringify(v), BufferJSON.reviver); } catch { return v; }
}

// ── Per-session in-memory key cache ──────────────────────────────────────────
// Prevents repeated MongoDB reads for the same key type within a session.
// Structure: { [sessionId]: { [type]: { [id]: value } } }
const _keyCache = {};

// Debounced save timers: { ["{sessionId}:{type}"]: timerHandle }
const _keySaveTimers = {};
const KEY_SAVE_DELAY_MS = 200;

function scheduleKeySave(sessionId, type) {
  const timerKey = `${sessionId}:${type}`;
  clearTimeout(_keySaveTimers[timerKey]);
  _keySaveTimers[timerKey] = setTimeout(async () => {
    const typeData = _keyCache[sessionId]?.[type];
    if (!typeData) return;
    try {
      const mdb = await getDb();
      if (!mdb) return;
      // Encode values (Buffer → base64 etc.)
      const encoded = {};
      for (const [id, val] of Object.entries(typeData)) {
        if (val !== undefined && val !== null) {
          encoded[id.replace(/\./g, '\uFF0E')] = encodeVal(val); // replace . (invalid MongoDB key)
        }
      }
      const docId = `${sessionId}:${type}`;
      await mdb.collection('auth_keys').replaceOne(
        { _id: docId },
        { _id: docId, sessionId, type, keys: encoded },
        { upsert: true }
      );
    } catch (e) {
      console.error(`[AuthState] key save failed (${sessionId}/${type}):`, e.message);
    }
  }, KEY_SAVE_DELAY_MS);
}

// ── Public: flush pending key saves for a session immediately ────────────────
export async function flushAuthState(sessionId) {
  const mdb = await getDb();
  if (!mdb) return;
  const sessionTypes = Object.keys(_keyCache[sessionId] || {});
  for (const type of sessionTypes) {
    const timerKey = `${sessionId}:${type}`;
    if (_keySaveTimers[timerKey]) {
      clearTimeout(_keySaveTimers[timerKey]);
      delete _keySaveTimers[timerKey];
    }
    const typeData = _keyCache[sessionId]?.[type];
    if (!typeData) continue;
    try {
      const encoded = {};
      for (const [id, val] of Object.entries(typeData)) {
        if (val !== undefined && val !== null) {
          encoded[id.replace(/\./g, '\uFF0E')] = encodeVal(val);
        }
      }
      const docId = `${sessionId}:${type}`;
      await mdb.collection('auth_keys').replaceOne(
        { _id: docId },
        { _id: docId, sessionId, type, keys: encoded },
        { upsert: true }
      );
    } catch (e) {
      console.error(`[AuthState] flush failed (${sessionId}/${type}):`, e.message);
    }
  }
}

// ── Public: check if a session has valid auth ─────────────────────────────────
export async function sessionHasAuth(sessionId) {
  try {
    const mdb = await getDb();
    if (!mdb) {
      const credsPath = path.join(process.cwd(), 'session', sessionId, 'creds.json');
      return fs.existsSync(credsPath);
    }
    const doc = await mdb.collection('auth_creds').findOne({ _id: sessionId });
    // Valid creds have at minimum 'noiseKey' or 'me' written by Baileys
    return !!(doc && typeof doc === 'object' && (doc.noiseKey || doc.me));
  } catch {
    return false;
  }
}

// ── Public: create auth state backed by MongoDB (with local file fallback) ────
export async function useMongoAuthState(sessionId) {
  if (!_keyCache[sessionId]) _keyCache[sessionId] = {};

  const mdb = await getDb();
  if (!mdb) {
    console.log(`[AuthState] MongoDB not connected — using local file auth state for '${sessionId}'`);
    const sessionDir = path.join(process.cwd(), 'session', sessionId);
    fs.ensureDirSync(sessionDir);
    return await useMultiFileAuthState(sessionDir);
  }

  // ── Load credentials ─────────────────────────────────────────────────────
  let creds;
  if (mdb) {
    try {
      const rawDoc = await mdb.collection('auth_creds').findOne({ _id: sessionId });
      if (rawDoc) {
        const { _id, ...rawCreds } = rawDoc;
        creds = decodeVal(rawCreds);
      } else {
        creds = initAuthCreds();
      }
    } catch {
      creds = initAuthCreds();
    }
  } else {
    // No MongoDB — in-memory only
    creds = initAuthCreds();
  }

  // ── Signal key store ──────────────────────────────────────────────────────
  const keys = {
    get: async (type, ids) => {
      // Lazy-load entire key type from MongoDB on first access
      if (!_keyCache[sessionId][type]) {
        _keyCache[sessionId][type] = {};
        if (mdb) {
          try {
            const docId = `${sessionId}:${type}`;
            const doc = await mdb.collection('auth_keys').findOne({ _id: docId });
            if (doc?.keys && typeof doc.keys === 'object') {
              for (const [encodedId, val] of Object.entries(doc.keys)) {
                const id = encodedId.replace(/\uFF0E/g, '.'); // restore dots
                let decoded = decodeVal(val);
                if (type === 'app-state-sync-key' && decoded) {
                  try { decoded = proto.Message.AppStateSyncKeyData.fromObject(decoded); } catch {}
                }
                _keyCache[sessionId][type][id] = decoded;
              }
            }
          } catch (e) {
            console.error(`[AuthState] key load failed (${sessionId}/${type}):`, e.message);
          }
        }
      }

      const result = {};
      for (const id of ids) {
        const val = _keyCache[sessionId][type][id];
        if (val !== undefined && val !== null) result[id] = val;
      }
      return result;
    },

    set: async (data) => {
      for (const [type, ids] of Object.entries(data)) {
        if (!_keyCache[sessionId][type]) _keyCache[sessionId][type] = {};
        for (const [id, value] of Object.entries(ids || {})) {
          if (value !== null && value !== undefined) {
            _keyCache[sessionId][type][id] = value;
          } else {
            delete _keyCache[sessionId][type][id];
          }
        }
        scheduleKeySave(sessionId, type);
      }
    },
  };

  // ── saveCreds — called by Baileys on creds.update ─────────────────────────
  const saveCreds = async () => {
    if (!mdb) return;
    try {
      const encoded = encodeVal(creds);
      await mdb.collection('auth_creds').replaceOne(
        { _id: sessionId },
        { _id: sessionId, ...encoded },
        { upsert: true }
      );
    } catch (e) {
      console.error(`[AuthState] creds save failed (${sessionId}):`, e.message);
    }
  };

  return { state: { creds, keys }, saveCreds };
}

// ── Delete all auth data for a session (logout / delete) ─────────────────────
export async function deleteMongoAuthState(sessionId) {
  // Clear in-memory cache
  delete _keyCache[sessionId];

  // Cancel any pending debounced saves
  for (const tk of Object.keys(_keySaveTimers)) {
    if (tk.startsWith(`${sessionId}:`)) {
      clearTimeout(_keySaveTimers[tk]);
      delete _keySaveTimers[tk];
    }
  }

  // Delete local session directory if used as fallback
  try {
    const sessionDir = path.join(process.cwd(), 'session', sessionId);
    if (fs.existsSync(sessionDir)) {
      fs.removeSync(sessionDir);
    }
  } catch {}

  // Delete from MongoDB
  try {
    const mdb = await getDb();
    if (!mdb) return;
    await mdb.collection('auth_creds').deleteOne({ _id: sessionId });
    await mdb.collection('auth_keys').deleteMany({ sessionId });
  } catch (e) {
    console.error(`[AuthState] delete failed (${sessionId}):`, e.message);
  }
}
