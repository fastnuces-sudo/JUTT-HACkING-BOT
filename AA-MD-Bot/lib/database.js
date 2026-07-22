import axios from 'axios';

const BASE_URL = (process.env.FIREBASE_DB_URL || 'https://aa-md-bot-default-rtdb.firebaseio.com').replace(/\/$/, '');
const SECRET   = process.env.FIREBASE_DB_SECRET;

// ── Firebase key encoding ─────────────────────────────────────────────────────
// Firebase Realtime DB disallows: . # $ [ ]  in key names
// JIDs contain dots (e.g. @s.whatsapp.net) so we must encode them
const encKey = k => String(k).replace(/[.#$[\]]/g, c => `~${c.charCodeAt(0).toString(16).toUpperCase()}`);
const decKey = k => String(k).replace(/~([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

function encodeObj(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const k of Object.keys(obj)) out[encKey(k)] = obj[k];
  return out;
}
function decodeObj(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const k of Object.keys(obj)) out[decKey(k)] = obj[k];
  return out;
}

// ── In-memory cache (source of truth for sync reads) ─────────────────────────
// All collections are persisted to Firebase and loaded on startup.
// 'sessions' is excluded from flushOnExit (managed separately by WhatsApp auth state).
const COLLECTIONS = ['users', 'groups', 'settings', 'sessions', 'sessionSettings', 'notes'];
const cache = { users: {}, groups: {}, settings: {}, sessions: {}, sessionSettings: {}, notes: {} };

// ── Firebase REST helpers ─────────────────────────────────────────────────────
async function fbGet(fbPath) {
  if (!SECRET) return {};
  try {
    const { data } = await axios.get(`${BASE_URL}/${fbPath}.json?auth=${SECRET}`, { timeout: 15000 });
    return data || {};
  } catch (e) {
    console.error(`[DB] Firebase GET /${fbPath} failed:`, e.message);
    return {};
  }
}

async function fbPut(fbPath, data, retries = 3) {
  if (!SECRET) return;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await axios.put(`${BASE_URL}/${fbPath}.json?auth=${SECRET}`, data ?? {}, { timeout: 15000 });
      return; // success
    } catch (e) {
      if (attempt === retries) {
        console.error(`[DB] Firebase PUT /${fbPath} failed after ${retries} attempts:`, e.message);
      } else {
        // Exponential back-off: 1s → 2s → 4s
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }
}

// ── Debounced write-through ───────────────────────────────────────────────────
const saveTimers = {};

// In-flight lock: prevents two concurrent PUTs for the same collection from
// racing each other (the slower one could overwrite with stale data).
// If a flush is already running we mark a pending request; on completion we
// immediately start another flush so no write is ever silently dropped.
const _flushInFlight = new Set();
const _flushPending  = new Set();

async function flushCollection(name) {
  if (_flushInFlight.has(name)) {
    // A flush is already running — record that we need another pass after it.
    _flushPending.add(name);
    return;
  }
  _flushInFlight.add(name);
  try {
    const encoded = encodeObj(cache[name]);
    await fbPut(name, encoded && Object.keys(encoded).length ? encoded : {});
  } finally {
    _flushInFlight.delete(name);
    // If a write arrived while we were flushing, flush again immediately.
    if (_flushPending.has(name)) {
      _flushPending.delete(name);
      flushCollection(name).catch(e => console.error('[DB] flush error (retry):', e.message));
    }
  }
}

// Debounce delays per collection:
//   sessionSettings (mode/prefix/anticall…) → 3s  — short so setting changes
//     survive a crash window without feeling laggy
//   everything else                          → 10s — prevents Firebase churn on
//     busy bots with many simultaneous XP/balance updates
const DEBOUNCE_MS = { sessionSettings: 3_000 };
const DEFAULT_DEBOUNCE = 10_000;

function scheduleSave(name) {
  clearTimeout(saveTimers[name]);
  saveTimers[name] = setTimeout(
    () => flushCollection(name).catch(e => console.error('[DB] flush error:', e.message)),
    DEBOUNCE_MS[name] ?? DEFAULT_DEBOUNCE
  );
}

// ── Public init: load all data from Firebase ──────────────────────────────────
export async function initDatabase() {
  if (!SECRET) {
    console.warn('[DB] ⚠️  FIREBASE_DB_SECRET not set — using in-memory only (data lost on restart)');
    return;
  }
  try {
    // Load entire DB root in one request
    const data = await fbGet('');
    for (const name of COLLECTIONS) {
      if (data[name] && typeof data[name] === 'object') {
        cache[name] = decodeObj(data[name]);
      }
    }
    const stats = COLLECTIONS.map(n => `${n}:${Object.keys(cache[n]).length}`).join('  ');
    console.log(`[DB] ✅ Firebase loaded — ${stats}`);
  } catch (e) {
    console.error('[DB] ❌ Firebase init failed, starting with empty cache:', e.message);
  }
}

// Re-fetch from Firebase (used by .dbstats reload)
export async function reloadDatabase() {
  await initDatabase();
}

// Flush everything before process exits
export async function flushAll() {
  await Promise.all(COLLECTIONS.map(n => {
    clearTimeout(saveTimers[n]);
    return flushCollection(n);
  }));
}

// On exit: flush everything EXCEPT sessions.
// Sessions are managed by WhatsApp auth state — flushing them on exit causes stale
// records to be reloaded on the next restart, reconnecting sessions that no longer exist.
async function flushOnExit() {
  console.log('[DB] Flushing to Firebase before exit (excluding sessions)...');
  await Promise.all(
    COLLECTIONS.filter(n => n !== 'sessions').map(n => {
      clearTimeout(saveTimers[n]);
      return flushCollection(n);
    })
  );
}
process.on('SIGTERM', async () => { await flushOnExit(); process.exit(0); });
process.on('SIGINT',  async () => { await flushOnExit(); process.exit(0); });

// ── Periodic safety-net flush (every 5 minutes) ───────────────────────────────
// Guarantees data is written to Firebase at least every 5 min even if a
// debounced save was missed (e.g. process killed before 10s timer fires).
if (SECRET) {
  setInterval(() => {
    for (const name of COLLECTIONS) {
      if (name === 'sessions') continue; // sessions managed by auth state
      flushCollection(name).catch(e => console.error('[DB] periodic flush error:', e.message));
    }
  }, 5 * 60 * 1000);
}

// ── db API (identical surface to old file-based version) ─────────────────────
export const db = {

  users: {
    get: (id) => {
      if (!cache.users[id]) {
        cache.users[id] = {
          id, name: '', xp: 0, level: 1, balance: 1000, commandsUsed: 0,
          lastDaily: null, dailyStreak: 0, warnings: 0, banned: false,
          createdAt: Date.now(), inventory: [], lastSeen: Date.now(),
        };
        scheduleSave('users');
      }
      return cache.users[id];
    },
    set: (id, data) => {
      cache.users[id] = { ...cache.users[id], ...data };
      scheduleSave('users');
      return cache.users[id];
    },
    all: () => cache.users,
    delete: (id) => { delete cache.users[id]; scheduleSave('users'); },
    addXP: (id, amount) => {
      if (!cache.users[id]) db.users.get(id);
      cache.users[id].xp = (cache.users[id].xp || 0) + amount;
      const newLevel = Math.floor(0.1 * Math.sqrt(cache.users[id].xp)) + 1;
      const leveled = newLevel > (cache.users[id].level || 1);
      cache.users[id].level = newLevel;
      scheduleSave('users');
      return { xp: cache.users[id].xp, level: cache.users[id].level, leveled };
    },
    addBalance: (id, amount) => {
      if (!cache.users[id]) db.users.get(id);
      cache.users[id].balance = (cache.users[id].balance || 0) + amount;
      scheduleSave('users');
      return cache.users[id].balance;
    },
    deductBalance: (id, amount) => {
      if (!cache.users[id]) db.users.get(id);
      if ((cache.users[id].balance || 0) < amount) return false;
      cache.users[id].balance -= amount;
      scheduleSave('users');
      return cache.users[id].balance;
    },
  },

  groups: {
    // ── sessionId + groupId composite key: "sessionId|groupJid" ──
    // Each bot number manages its OWN per-group settings independently.
    _key: (sessionId, groupId) => `${sessionId}|${groupId}`,

    get: (sessionId, groupId) => {
      const key = `${sessionId}|${groupId}`;
      if (!cache.groups[key]) {
        cache.groups[key] = {
          id: groupId, sessionId, name: '',
          antilink: false, antibot: false,
          welcome: false, welcomeMsg: 'Welcome @user!',
          goodbye: false, goodbyeMsg: 'Goodbye @user!',
          muted: false, antifake: false, antibadwords: false,
          antidelete: false, antiviewonce: false,
          antidemote: false, antiflood: false, antifloodLimit: 7,
          rules: '',
          badwordsList: [], warnings: {},
          createdAt: Date.now(),
        };
        scheduleSave('groups');
      }
      return cache.groups[key];
    },

    set: (sessionId, groupId, data) => {
      const key = `${sessionId}|${groupId}`;
      cache.groups[key] = { ...(cache.groups[key] || {}), ...data };
      scheduleSave('groups');
      return cache.groups[key];
    },

    // Returns groups for one session (keyed by groupId) — or all raw if no sessionId
    all: (sessionId) => {
      if (!sessionId) return cache.groups;
      const prefix = `${sessionId}|`;
      const out = {};
      for (const k of Object.keys(cache.groups)) {
        if (k.startsWith(prefix)) out[k.slice(prefix.length)] = cache.groups[k];
      }
      return out;
    },

    delete: (sessionId, groupId) => {
      delete cache.groups[`${sessionId}|${groupId}`];
      scheduleSave('groups');
    },

    // Delete ALL group settings for a disconnected/deleted session
    deleteBySession: (sessionId) => {
      const prefix = `${sessionId}|`;
      let changed = false;
      for (const k of Object.keys(cache.groups)) {
        if (k.startsWith(prefix)) { delete cache.groups[k]; changed = true; }
      }
      if (changed) scheduleSave('groups');
    },
  },

  settings: {
    get: () => cache.settings,
    set: (data) => { Object.assign(cache.settings, data); scheduleSave('settings'); return cache.settings; },
    getValue: (key) => cache.settings[key],
    setValue: (key, value) => { cache.settings[key] = value; scheduleSave('settings'); },
  },

  sessions: {
    get: () => cache.sessions,
    set: (id, data) => { cache.sessions[id] = { ...cache.sessions[id], ...data }; scheduleSave('sessions'); },
    delete: (id) => { delete cache.sessions[id]; scheduleSave('sessions'); },
    all: () => cache.sessions,
  },

  sessionSettings: {
    get: (sessionId) => cache.sessionSettings[sessionId] || {},
    set: (sessionId, data) => {
      cache.sessionSettings[sessionId] = { ...(cache.sessionSettings[sessionId] || {}), ...data };
      scheduleSave('sessionSettings');
      return cache.sessionSettings[sessionId];
    },
    getValue: (sessionId, key) => cache.sessionSettings[sessionId]?.[key],
    setValue: (sessionId, key, value) => {
      if (!cache.sessionSettings[sessionId]) cache.sessionSettings[sessionId] = {};
      cache.sessionSettings[sessionId][key] = value;
      scheduleSave('sessionSettings');
    },
    delete: (sessionId) => { delete cache.sessionSettings[sessionId]; scheduleSave('sessionSettings'); },
    all: () => cache.sessionSettings,
  },

  // Returns a promise (async reload from Firebase)
  reload: () => reloadDatabase(),

  // Notes — per-chat note storage in Firebase (no local files)
  notes: {
    // Get all notes for a chat JID (returns plain object {noteName: {content,by,at}})
    get: (jid) => cache.notes[jid] || {},
    // Save/update one note entry
    setNote: (jid, name, data) => {
      if (!cache.notes[jid]) cache.notes[jid] = {};
      cache.notes[jid][name] = data;
      scheduleSave('notes');
    },
    // Delete one note entry
    delNote: (jid, name) => {
      if (!cache.notes[jid]) return;
      delete cache.notes[jid][name];
      if (!Object.keys(cache.notes[jid]).length) delete cache.notes[jid];
      scheduleSave('notes');
    },
    // Delete all notes for a chat
    clear: (jid) => { delete cache.notes[jid]; scheduleSave('notes'); },
  },

  flushAll,
};

export default db;
