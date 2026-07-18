import axios from 'axios';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
const COLLECTIONS = ['users', 'groups', 'settings', 'sessions', 'sessionSettings'];
const cache = { users: {}, groups: {}, settings: {}, sessions: {}, sessionSettings: {} };

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

async function fbPut(fbPath, data) {
  if (!SECRET) return;
  try {
    await axios.put(`${BASE_URL}/${fbPath}.json?auth=${SECRET}`, data ?? {}, { timeout: 15000 });
  } catch (e) {
    console.error(`[DB] Firebase PUT /${fbPath} failed:`, e.message);
  }
}

// ── Debounced write-through ───────────────────────────────────────────────────
const saveTimers = {};

async function flushCollection(name) {
  const encoded = encodeObj(cache[name]);
  await fbPut(name, encoded && Object.keys(encoded).length ? encoded : {});
}

function scheduleSave(name) {
  clearTimeout(saveTimers[name]);
  saveTimers[name] = setTimeout(
    () => flushCollection(name).catch(e => console.error('[DB] flush error:', e.message)),
    2000
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

process.on('SIGTERM', async () => { console.log('[DB] Flushing to Firebase before exit...'); await flushAll(); process.exit(0); });
process.on('SIGINT',  async () => { console.log('[DB] Flushing to Firebase before exit...'); await flushAll(); process.exit(0); });

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
    get: (id) => {
      if (!cache.groups[id]) {
        cache.groups[id] = {
          id, name: '', antilink: false, antibot: false, welcome: false,
          welcomeMsg: 'Welcome @user!', goodbye: false, goodbyeMsg: 'Goodbye @user!',
          muted: false, warnings: {}, createdAt: Date.now(),
        };
        scheduleSave('groups');
      }
      return cache.groups[id];
    },
    set: (id, data) => {
      cache.groups[id] = { ...cache.groups[id], ...data };
      scheduleSave('groups');
      return cache.groups[id];
    },
    all: () => cache.groups,
    delete: (id) => { delete cache.groups[id]; scheduleSave('groups'); },
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

  // Snapshot current cache to a local backup file
  backup: () => {
    const dir = path.join(__dirname, '../logs/backups');
    fs.ensureDirSync(dir);
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(dir, `backup-${ts}.json`);
    fs.writeJsonSync(file, cache, { spaces: 2 });
    return file;
  },

  flushAll,
};

export default db;
