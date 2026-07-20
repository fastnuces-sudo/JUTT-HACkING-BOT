// ============================================
// AA MD Bot — Firebase Realtime Auth State
// Replaces useMultiFileAuthState (no disk I/O)
// Stores WhatsApp credentials + signal keys
// in Firebase RTDB — zero local file writes.
// ============================================

import { proto, initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';
import axios from 'axios';

const BASE_URL = (process.env.FIREBASE_DB_URL || 'https://aa-md-bot-default-rtdb.firebaseio.com').replace(/\/$/, '');
const SECRET   = process.env.FIREBASE_DB_SECRET;

// ── Firebase key encoding (same rules as database.js) ────────────────────────
// Firebase disallows . # $ [ ] in key names; JIDs and key IDs contain these.
const encKey = k => String(k).replace(/[.#$[\]]/g, c => `~${c.charCodeAt(0).toString(16).toUpperCase()}`);
const decKey = k => String(k).replace(/~([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

// ── Firebase REST helpers ─────────────────────────────────────────────────────
async function fbGet(fbPath) {
  if (!SECRET) return null;
  try {
    const { data } = await axios.get(`${BASE_URL}/${fbPath}.json?auth=${SECRET}`, { timeout: 15000 });
    return data ?? null;
  } catch (e) {
    console.error('[AuthState] GET failed:', e.message);
    return null;
  }
}

async function fbPut(fbPath, data) {
  if (!SECRET) return;
  try {
    await axios.put(`${BASE_URL}/${fbPath}.json?auth=${SECRET}`, data ?? null, { timeout: 15000 });
  } catch (e) {
    console.error('[AuthState] PUT failed:', e.message);
  }
}

async function fbDelete(fbPath) {
  if (!SECRET) return;
  try {
    await axios.delete(`${BASE_URL}/${fbPath}.json?auth=${SECRET}`, { timeout: 10000 });
  } catch {}
}

// ── BufferJSON helpers ────────────────────────────────────────────────────────
function encodeVal(v) {
  try { return JSON.parse(JSON.stringify(v, BufferJSON.replacer)); } catch { return v; }
}
function decodeVal(v) {
  try { return JSON.parse(JSON.stringify(v), BufferJSON.reviver); } catch { return v; }
}

// ── Per-session in-memory key cache ──────────────────────────────────────────
// Prevents repeated Firebase reads for the same key type within a session.
// Structure: { [authPath]: { [type]: { [id]: value } } }
const _keyCache = {};

// Debounced save timers: { [authPath/type]: timerHandle }
const _keySaveTimers = {};
const KEY_SAVE_DELAY_MS = 2500;

function scheduleKeySave(authPath, type) {
  const timerKey = `${authPath}/${type}`;
  clearTimeout(_keySaveTimers[timerKey]);
  _keySaveTimers[timerKey] = setTimeout(async () => {
    const typeData = _keyCache[authPath]?.[type];
    if (!typeData) return;

    // Encode: { encId → encodedValue } for Firebase
    const out = {};
    for (const [id, val] of Object.entries(typeData)) {
      if (val !== undefined && val !== null) {
        out[encKey(id)] = encodeVal(val);
      }
    }

    const fbPath = `${authPath}/keys/${encKey(type)}`;
    await fbPut(fbPath, Object.keys(out).length ? out : null);
  }, KEY_SAVE_DELAY_MS);
}

// ── Public: check if a session has valid auth in Firebase (used at startup) ───
// Returns true only if Firebase has actual stored credentials for this session.
// A session with no Firebase auth = was never connected, was cleared, or logged out.
export async function sessionHasAuth(sessionId) {
  if (!SECRET) return false; // No Firebase → in-memory mode, can't validate
  try {
    const authPath = `auth/${encKey(sessionId)}`;
    const creds = await fbGet(`${authPath}/creds`);
    // Valid creds have at minimum a 'noiseKey' or 'me' field written by Baileys
    return !!(creds && typeof creds === 'object' && (creds.noiseKey || creds.me));
  } catch {
    return false;
  }
}

// ── Public: create auth state backed by Firebase ──────────────────────────────
export async function useFirebaseAuthState(sessionId) {
  const authPath = `auth/${encKey(sessionId)}`;

  if (!_keyCache[authPath]) _keyCache[authPath] = {};

  // ── Load credentials ───────────────────────────────────────────────────────
  let creds;
  const rawCreds = await fbGet(`${authPath}/creds`);
  if (rawCreds && typeof rawCreds === 'object') {
    try { creds = decodeVal(rawCreds); } catch { creds = initAuthCreds(); }
  } else {
    creds = initAuthCreds();
  }

  // ── Signal key store ───────────────────────────────────────────────────────
  const keys = {
    /**
     * get(type, ids) — return a map of { id → key } for the requested ids.
     * First access per type fetches from Firebase; subsequent accesses use cache.
     */
    get: async (type, ids) => {
      // Lazy-load entire key type from Firebase on first access
      if (!_keyCache[authPath][type]) {
        _keyCache[authPath][type] = {};
        const raw = await fbGet(`${authPath}/keys/${encKey(type)}`);
        if (raw && typeof raw === 'object') {
          for (const [encId, val] of Object.entries(raw)) {
            const id = decKey(encId);
            let decoded = decodeVal(val);
            // app-state-sync-key requires proto deserialization
            if (type === 'app-state-sync-key' && decoded) {
              try { decoded = proto.Message.AppStateSyncKeyData.fromObject(decoded); } catch {}
            }
            _keyCache[authPath][type][id] = decoded;
          }
        }
      }

      const result = {};
      for (const id of ids) {
        const val = _keyCache[authPath][type][id];
        if (val !== undefined && val !== null) result[id] = val;
      }
      return result;
    },

    /**
     * set(data) — update key store. data = { [type]: { [id]: value | null } }
     * null value = delete that key.
     */
    set: async (data) => {
      for (const [type, ids] of Object.entries(data)) {
        if (!_keyCache[authPath][type]) _keyCache[authPath][type] = {};
        for (const [id, value] of Object.entries(ids || {})) {
          if (value !== null && value !== undefined) {
            _keyCache[authPath][type][id] = value;
          } else {
            delete _keyCache[authPath][type][id];
          }
        }
        scheduleKeySave(authPath, type);
      }
    },
  };

  // ── saveCreds — called by Baileys on creds.update ─────────────────────────
  const saveCreds = async () => {
    await fbPut(`${authPath}/creds`, encodeVal(creds));
  };

  return { state: { creds, keys }, saveCreds };
}

// ── Delete all auth data for a session (logout / delete) ─────────────────────
export async function deleteFirebaseAuthState(sessionId) {
  const authPath = `auth/${encKey(sessionId)}`;

  // Clear in-memory cache
  delete _keyCache[authPath];

  // Cancel any pending debounced saves
  for (const tk of Object.keys(_keySaveTimers)) {
    if (tk.startsWith(authPath + '/')) {
      clearTimeout(_keySaveTimers[tk]);
      delete _keySaveTimers[tk];
    }
  }

  // Delete from Firebase
  await fbDelete(authPath);
}
