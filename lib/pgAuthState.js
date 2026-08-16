// ============================================
// Jutts Bot — Neon Postgres Auth State
// Stores WhatsApp credentials + signal keys in
// Neon Postgres (auth_creds / auth_keys tables)
// — zero local file writes when configured.
// ============================================

import { proto, initAuthCreds, BufferJSON, useMultiFileAuthState } from '@whiskeysockets/baileys';
import { getPool, ensureSchema } from './database.js';
import path from 'path';
import fs from 'fs-extra';

// ── BufferJSON helpers ────────────────────────────────────────────────────────
function encodeVal(v) {
  try { return JSON.parse(JSON.stringify(v, BufferJSON.replacer)); } catch { return v; }
}
function decodeVal(v) {
  try { return JSON.parse(JSON.stringify(v), BufferJSON.reviver); } catch { return v; }
}

// Postgres JSONB rejects the \u0000 escape inside strings. Baileys values are
// Buffers (base64 via BufferJSON) or plain identifiers, but strip it defensively
// so a single odd byte can never break a whole session save.
function toJsonb(value) {
  return JSON.stringify(value).replace(/\\u0000/g, '');
}

// ── Per-session in-memory key cache ──────────────────────────────────────────
// Prevents repeated Postgres reads for the same key type within a session.
// Structure: { [sessionId]: { [type]: { [id]: value } } }
const _keyCache = {};

// Debounced save timers: { ["{sessionId}:{type}"]: timerHandle }
const _keySaveTimers = {};
const KEY_SAVE_DELAY_MS = 200;

// Shared writer used by both the debounced path and the immediate flush path.
async function writeKeyType(sessionId, type) {
  const typeData = _keyCache[sessionId]?.[type];
  if (!typeData) return;

  const pool = await getPool();
  if (!pool) return;
  await ensureSchema();

  // Encode values (Buffer → base64 etc.). Unlike MongoDB, Postgres JSONB has no
  // restriction on dots in object keys, so ids are stored verbatim.
  const encoded = {};
  for (const [id, val] of Object.entries(typeData)) {
    if (val !== undefined && val !== null) encoded[id] = encodeVal(val);
  }

  await pool.query(
    `INSERT INTO auth_keys (session_id, key_type, keys, updated_at)
     VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (session_id, key_type)
     DO UPDATE SET keys = EXCLUDED.keys, updated_at = now()`,
    [sessionId, type, toJsonb(encoded)],
  );
}

function scheduleKeySave(sessionId, type) {
  const timerKey = `${sessionId}:${type}`;
  clearTimeout(_keySaveTimers[timerKey]);
  _keySaveTimers[timerKey] = setTimeout(async () => {
    try {
      await writeKeyType(sessionId, type);
    } catch (e) {
      console.error(`[AuthState] key save failed (${sessionId}/${type}):`, e.message);
    }
  }, KEY_SAVE_DELAY_MS);
}

// ── Public: flush pending key saves for a session immediately ────────────────
export async function flushAuthState(sessionId) {
  const pool = await getPool();
  if (!pool) return;
  const sessionTypes = Object.keys(_keyCache[sessionId] || {});
  for (const type of sessionTypes) {
    const timerKey = `${sessionId}:${type}`;
    if (_keySaveTimers[timerKey]) {
      clearTimeout(_keySaveTimers[timerKey]);
      delete _keySaveTimers[timerKey];
    }
    try {
      await writeKeyType(sessionId, type);
    } catch (e) {
      console.error(`[AuthState] flush failed (${sessionId}/${type}):`, e.message);
    }
  }
}

// ── Public: check if a session has valid auth ─────────────────────────────────
export async function sessionHasAuth(sessionId) {
  try {
    const pool = await getPool();
    if (!pool) {
      const credsPath = path.join(process.cwd(), 'session', sessionId, 'creds.json');
      return fs.existsSync(credsPath);
    }
    await ensureSchema();
    const { rows } = await pool.query(
      'SELECT creds FROM auth_creds WHERE session_id = $1',
      [sessionId],
    );
    const creds = rows[0]?.creds;
    // Valid creds have at minimum 'noiseKey' or 'me' written by Baileys
    return !!(creds && typeof creds === 'object' && (creds.noiseKey || creds.me));
  } catch {
    const credsPath = path.join(process.cwd(), 'session', sessionId, 'creds.json');
    return fs.existsSync(credsPath);
  }
}

// ── Public: create auth state backed by Postgres (with local file fallback) ───
export async function usePgAuthState(sessionId) {
  if (!_keyCache[sessionId]) _keyCache[sessionId] = {};

  let pool = null;
  try {
    pool = await getPool();
    if (pool) await ensureSchema();
  } catch (error) {
    pool = null;
    console.error(`[AuthState] Postgres unavailable for '${sessionId}', using local auth:`, error.message);
  }
  if (!pool) {
    console.log(`[AuthState] Postgres not connected — using local file auth state for '${sessionId}'`);
    const sessionDir = path.join(process.cwd(), 'session', sessionId);
    fs.ensureDirSync(sessionDir);
    return await useMultiFileAuthState(sessionDir);
  }

  // ── Load credentials ─────────────────────────────────────────────────────
  let creds;
  try {
    const { rows } = await pool.query(
      'SELECT creds FROM auth_creds WHERE session_id = $1',
      [sessionId],
    );
    creds = rows[0]?.creds ? decodeVal(rows[0].creds) : initAuthCreds();
  } catch {
    creds = initAuthCreds();
  }

  // ── Signal key store ──────────────────────────────────────────────────────
  const keys = {
    get: async (type, ids) => {
      // Lazy-load entire key type from Postgres on first access
      if (!_keyCache[sessionId][type]) {
        _keyCache[sessionId][type] = {};
        try {
          const { rows } = await pool.query(
            'SELECT keys FROM auth_keys WHERE session_id = $1 AND key_type = $2',
            [sessionId, type],
          );
          const stored = rows[0]?.keys;
          if (stored && typeof stored === 'object') {
            for (const [id, val] of Object.entries(stored)) {
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
    try {
      const encoded = encodeVal(creds);
      await pool.query(
        `INSERT INTO auth_creds (session_id, creds, updated_at)
         VALUES ($1, $2::jsonb, now())
         ON CONFLICT (session_id)
         DO UPDATE SET creds = EXCLUDED.creds, updated_at = now()`,
        [sessionId, toJsonb(encoded)],
      );
    } catch (e) {
      console.error(`[AuthState] creds save failed (${sessionId}):`, e.message);
    }
  };

  return { state: { creds, keys }, saveCreds };
}

// ── Delete all auth data for a session (logout / delete) ─────────────────────
export async function deletePgAuthState(sessionId) {
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

  // Delete from Postgres
  try {
    const pool = await getPool();
    if (!pool) return;
    await ensureSchema();
    await pool.query('DELETE FROM auth_creds WHERE session_id = $1', [sessionId]);
    await pool.query('DELETE FROM auth_keys  WHERE session_id = $1', [sessionId]);
  } catch (e) {
    console.error(`[AuthState] delete failed (${sessionId}):`, e.message);
  }
}
