import { MongoClient } from 'mongodb';

// ── Connection ────────────────────────────────────────────────────────────────
// Priority order:
//   1. MONGODB_URI — Oracle ADB, self-hosted Mongo, or Atlas full URI
//   2. MONGODB_PASSWORD — legacy Atlas shorthand (password only)
const MONGO_URI = process.env.MONGODB_URI ||
  (process.env.MONGODB_PASSWORD
    ? `mongodb+srv://a67515346_db_user:${encodeURIComponent(process.env.MONGODB_PASSWORD)}@aa-md-bot.i1j26yw.mongodb.net/?appName=AA-MD-Bot`
    : null);

// Detect Oracle ADB MongoDB API from URI
// Oracle ADB requires retryWrites:false and loadBalanced:true
const IS_ORACLE_ADB = Boolean(
  MONGO_URI && (
    /oraclecloud\.com/i.test(MONGO_URI) ||
    /authMechanism=PLAIN/i.test(MONGO_URI)
  )
);

// Self-hosted MongoDB (mongodb:// direct IP — not Atlas SRV)
// Needs directConnection:true so driver doesn't do topology discovery
const IS_SELF_HOSTED = Boolean(
  MONGO_URI &&
  MONGO_URI.startsWith('mongodb://') &&
  !MONGO_URI.startsWith('mongodb+srv://') &&
  !IS_ORACLE_ADB
);

// Extract DB name from URI path (supports all URI formats)
function extractDbName(uri) {
  try {
    const afterHost = uri.replace(/^mongodb(\+srv)?:\/\/[^@]+@[^/]+/, '');
    const name = afterHost.split('?')[0].replace(/^\//, '').trim();
    return name || 'aa_md_bot';
  } catch {
    return 'aa_md_bot';
  }
}

let _client = null;
let _db     = null;

export async function getDb() {
  if (_db) return _db;
  if (!MONGO_URI) return null;
  if (!_client) {
    const opts = {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 30000,
      // Oracle ADB MongoDB API — required options
      ...(IS_ORACLE_ADB ? { retryWrites: false, loadBalanced: true } : {}),
      // Self-hosted direct IP — bypass topology discovery
      ...(IS_SELF_HOSTED ? { directConnection: true } : {}),
    };
    _client = new MongoClient(MONGO_URI, opts);
    await _client.connect();
  }
  const dbName = extractDbName(MONGO_URI);
  _db = _client.db(dbName);
  return _db;
}

// ── Collections persisted to MongoDB ─────────────────────────────────────────
// Each name maps to a MongoDB collection where every document is { _id: key, ...fields }
// 'sessions' is excluded from flush (managed separately by WhatsApp auth state).
const COLLECTIONS = ['groups', 'settings', 'sessionSettings', 'notes', 'birthdays', 'sessions', 'reminders'];
const cache = { groups: {}, settings: {}, sessionSettings: {}, notes: {}, birthdays: {}, sessions: {}, reminders: {} };

// ── MongoDB helpers ───────────────────────────────────────────────────────────
async function mongoLoadCollection(name) {
  const mdb = await getDb();
  if (!mdb) return {};
  try {
    const docs = await mdb.collection(name).find({}).toArray();
    const out  = {};
    for (const doc of docs) {
      const { _id, ...rest } = doc;
      // 'settings' is a single flat document stored under _id='__settings__'
      if (name === 'settings') {
        return rest;
      }
      out[_id] = rest;
    }
    return out;
  } catch (e) {
    console.error(`[DB] MongoDB load ${name} failed:`, e.message);
    return {};
  }
}

async function mongoSaveCollection(name, data) {
  const mdb = await getDb();
  if (!mdb) return;
  try {
    const col = mdb.collection(name);
    if (name === 'settings') {
      // Single document
      await col.replaceOne({ _id: '__settings__' }, { _id: '__settings__', ...data }, { upsert: true });
      return;
    }
    // Key-value map: bulk upsert each entry, delete removed entries
    const ops = Object.entries(data).map(([key, val]) => ({
      replaceOne: { filter: { _id: key }, replacement: { _id: key, ...val }, upsert: true },
    }));
    if (ops.length) await col.bulkWrite(ops, { ordered: false });
    // No deletion of removed keys here — keeps it simple and safe
  } catch (e) {
    console.error(`[DB] MongoDB save ${name} failed:`, e.message);
  }
}

// ── Debounced write-through ───────────────────────────────────────────────────
const saveTimers       = {};
const _flushInFlight   = new Set();
const _flushPending    = new Set();

async function flushCollection(name) {
  if (_flushInFlight.has(name)) {
    _flushPending.add(name);
    return;
  }
  _flushInFlight.add(name);
  try {
    await mongoSaveCollection(name, cache[name]);
  } finally {
    _flushInFlight.delete(name);
    if (_flushPending.has(name)) {
      _flushPending.delete(name);
      flushCollection(name).catch(e => console.error('[DB] flush error (retry):', e.message));
    }
  }
}

const DEBOUNCE_MS      = { sessionSettings: 3_000 };
const DEFAULT_DEBOUNCE = 10_000;

function scheduleSave(name) {
  clearTimeout(saveTimers[name]);
  saveTimers[name] = setTimeout(
    () => flushCollection(name).catch(e => console.error('[DB] flush error:', e.message)),
    DEBOUNCE_MS[name] ?? DEFAULT_DEBOUNCE
  );
}

// ── Public init: load all data from MongoDB ───────────────────────────────────
export async function initDatabase() {
  if (!MONGO_URI) {
    console.warn(
      '[DB] ⚠️  No database configured — running in-memory only (ALL data lost on restart)\n' +
      '     To persist data, set one of these in your .env or Replit Secrets:\n' +
      '       MONGODB_URI  = mongodb+srv://user:pass@cluster.mongodb.net/dbname   (Atlas / Oracle ADB)\n' +
      '       MONGODB_PASSWORD = <your-atlas-password>  (legacy shorthand for the built-in cluster)'
    );
    return;
  }
  try {
    await getDb(); // ensure connected
    for (const name of COLLECTIONS) {
      const data = await mongoLoadCollection(name);
      if (data && typeof data === 'object') {
        cache[name] = data;
      }
    }
    const stats = COLLECTIONS.map(n => `${n}:${Object.keys(cache[n]).length}`).join('  ');
    console.log(`[DB] ✅ MongoDB loaded — ${stats}`);
  } catch (e) {
    const line = '═'.repeat(58);
    console.error(`\n╔${line}╗`);
    console.error(`║  ❌  MONGODB CONNECTION FAILED                         ║`);
    console.error(`╠${line}╣`);
    console.error(`║  Error : ${e.message.slice(0, 47).padEnd(47)} ║`);
    console.error(`╠${line}╣`);
    console.error(`║  ⚠️  These features will NOT work:                      ║`);
    console.error(`║    • Session persistence (QR after every restart)      ║`);
    console.error(`║    • Group settings (antilink, welcome, etc.)          ║`);
    console.error(`║    • Reminders, notes, birthdays                       ║`);
    console.error(`╠${line}╣`);
    console.error(`║  Fix: Check MONGODB_URI / MONGODB_PASSWORD in .env     ║`);
    console.error(`╚${line}╝\n`);
  }
}

// Re-fetch from MongoDB (used by .dbstats reload)
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
async function flushOnExit() {
  console.log('[DB] Flushing to MongoDB before exit (excluding sessions)...');
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
if (MONGO_URI) {
  setInterval(() => {
    for (const name of COLLECTIONS) {
      if (name === 'sessions') continue;
      flushCollection(name).catch(e => console.error('[DB] periodic flush error:', e.message));
    }
  }, 5 * 60 * 1000);
}

// ── db API ────────────────────────────────────────────────────────────────────
export const db = {

  // birthdays — lightweight per-JID birthday storage
  birthdays: {
    get: (jid) => cache.birthdays[jid] || null,
    set: (jid, data) => {
      cache.birthdays[jid] = { ...(cache.birthdays[jid] || {}), ...data };
      scheduleSave('birthdays');
      return cache.birthdays[jid];
    },
    all: () => cache.birthdays,
    delete: (jid) => { delete cache.birthdays[jid]; scheduleSave('birthdays'); },
  },

  groups: {
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

  reminders: {
    get: (id) => cache.reminders[id] || null,
    set: (id, data) => { cache.reminders[id] = data; scheduleSave('reminders'); },
    delete: (id) => { delete cache.reminders[id]; scheduleSave('reminders'); },
    all: () => cache.reminders,
  },

  reload: () => reloadDatabase(),

  notes: {
    get: (jid) => cache.notes[jid] || {},
    setNote: (jid, name, data) => {
      if (!cache.notes[jid]) cache.notes[jid] = {};
      cache.notes[jid][name] = data;
      scheduleSave('notes');
    },
    delNote: (jid, name) => {
      if (!cache.notes[jid]) return;
      delete cache.notes[jid][name];
      if (!Object.keys(cache.notes[jid]).length) delete cache.notes[jid];
      scheduleSave('notes');
    },
    clear: (jid) => { delete cache.notes[jid]; scheduleSave('notes'); },
  },

  flushAll,
};

export default db;
