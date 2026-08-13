import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';

// ── Connection ────────────────────────────────────────────────────────────────
// MONGODB_URI is the only source of database credentials. Never ship a fallback
// account in source code: an unset or placeholder URI intentionally enables the
// local-file/in-memory fallback used by the auth and settings layers.
export function getMongoUri(env = process.env) {
  const configuredUri = env.MONGODB_URI?.trim();
  if (!configuredUri || /PASSWORD|change_this/i.test(configuredUri)) return null;
  if (!/^mongodb(?:\+srv)?:\/\//i.test(configuredUri)) {
    throw new Error('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }
  return configuredUri;
}

// Extract the database from the URI path. MONGODB_DB is an explicit fallback for
// provider URIs that omit a path (for example some Oracle/Atlas connection URLs).
export function extractDbName(uri, env = process.env) {
  const explicit = env.MONGODB_DB?.trim();
  if (explicit) return explicit;

  const match = String(uri || '').match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/i);
  const fromPath = match?.[1] ? decodeURIComponent(match[1]).trim() : '';
  return fromPath || 'jutts_bot';
}

let _client = null;
let _db     = null;

export async function getDb() {
  if (_db) return _db;
  const mongoUri = getMongoUri();
  if (!mongoUri) return null;
  if (!_client) {
    const isOracleAdb = /oraclecloud\.com/i.test(mongoUri) ||
      /authMechanism=PLAIN/i.test(mongoUri);
    // A directConnection hint is safe for localhost/single-host self-managed
    // MongoDB, but breaks replica-set discovery. Only apply it to loopback hosts.
    const isLoopback = /^mongodb:\/\/(?:[^@/]+@)?(?:127\.0\.0\.1|localhost)(?::\d+)?\//i.test(mongoUri);
    const opts = {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 30000,
      ...(isOracleAdb ? { retryWrites: false, loadBalanced: true } : {}),
      ...(isLoopback ? { directConnection: true } : {}),
    };
    _client = new MongoClient(mongoUri, opts);
    try {
      await _client.connect();
    } catch (error) {
      await _client.close().catch(() => {});
      _client = null;
      throw error;
    }
  }
  const dbName = extractDbName(mongoUri);
  _db = _client.db(dbName);
  return _db;
}

// ── Collections persisted to MongoDB ─────────────────────────────────────────
// Each name maps to a MongoDB collection where every document is { _id: key, ...fields }
// 'sessions' is excluded from flush (managed separately by WhatsApp auth state).
const COLLECTIONS = ['groups', 'settings', 'sessionSettings', 'notes', 'birthdays', 'sessions', 'reminders'];
const cache = { groups: {}, settings: {}, sessionSettings: {}, notes: {}, birthdays: {}, sessions: {}, reminders: {} };
// Persist only keys changed by this process. Writing entire cached collections
// would overwrite or delete records created by another VM between reloads.
const dirtyKeys = Object.fromEntries(COLLECTIONS.map(name => [name, new Set()]));
const deletedKeys = Object.fromEntries(COLLECTIONS.map(name => [name, new Set()]));

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
  } catch (error) {
    console.error(`[DB] MongoDB load ${name} failed:`, error.message);
    throw error;
  }
}

async function mongoSaveCollection(name, upserts, removals) {
  const mdb = await getDb();
  if (!mdb) return;
  try {
    const collection = mdb.collection(name);
    if (name === 'settings') {
      if (upserts) {
        await collection.replaceOne(
          { _id: '__settings__' },
          { _id: '__settings__', ...upserts },
          { upsert: true },
        );
      }
      return;
    }

    const operations = Object.entries(upserts || {}).map(([key, value]) => ({
      replaceOne: {
        filter: { _id: key },
        replacement: { _id: key, ...value },
        upsert: true,
      },
    }));
    for (const key of removals || []) {
      operations.push({ deleteOne: { filter: { _id: key } } });
    }
    if (operations.length) await collection.bulkWrite(operations, { ordered: false });
  } catch (error) {
    console.error(`[DB] MongoDB save ${name} failed:`, error.message);
    throw error;
  }
}

// ── Debounced write-through ───────────────────────────────────────────────────
const saveTimers = {};
const flushPromises = new Map();
const flushPending = new Set();

function takeWriteBatch(name) {
  const changed = [...dirtyKeys[name]];
  const removed = [...deletedKeys[name]];
  if (!changed.length && !removed.length) return null;

  for (const key of changed) dirtyKeys[name].delete(key);
  for (const key of removed) deletedKeys[name].delete(key);

  const upserts = name === 'settings'
    ? structuredClone(cache.settings)
    : Object.fromEntries(
        changed
          .filter(key => Object.hasOwn(cache[name], key))
          .map(key => [key, structuredClone(cache[name][key])]),
      );
  return { changed, removed, upserts };
}

function restoreFailedBatch(name, batch) {
  for (const key of batch.changed) {
    if (name === 'settings' || Object.hasOwn(cache[name], key)) dirtyKeys[name].add(key);
  }
  for (const key of batch.removed) {
    if (!Object.hasOwn(cache[name], key)) deletedKeys[name].add(key);
  }
}

async function flushCollection(name) {
  const existing = flushPromises.get(name);
  if (existing) {
    flushPending.add(name);
    return existing;
  }

  const task = (async () => {
    do {
      flushPending.delete(name);
      const batch = takeWriteBatch(name);
      if (!batch) continue;
      try {
        await mongoSaveCollection(name, batch.upserts, batch.removed);
      } catch (error) {
        restoreFailedBatch(name, batch);
        throw error;
      }
    } while (flushPending.has(name) || dirtyKeys[name].size || deletedKeys[name].size);
  })();

  flushPromises.set(name, task);
  try {
    await task;
  } finally {
    flushPromises.delete(name);
  }
}

// ── Debounce: 2s for everything — short enough that a crash/restart rarely
// loses data, long enough to avoid hammering MongoDB on rapid successive writes.
const DEBOUNCE_MS      = {};
const DEFAULT_DEBOUNCE = 2_000;

function scheduleSave(name, key = '__settings__', deleted = false) {
  if (deleted) {
    dirtyKeys[name].delete(key);
    deletedKeys[name].add(key);
  } else {
    deletedKeys[name].delete(key);
    dirtyKeys[name].add(key);
  }
  if (flushPromises.has(name)) flushPending.add(name);

  clearTimeout(saveTimers[name]);
  saveTimers[name] = setTimeout(
    () => flushCollection(name).catch(e => console.error('[DB] flush error:', e.message)),
    DEBOUNCE_MS[name] ?? DEFAULT_DEBOUNCE
  );
}

// Immediate save — cancels any pending debounce and writes right now.
// Call this after critical writes (prefix change, mode, owner add/remove, etc.)
export async function saveNow(name) {
  if (!getMongoUri()) return;
  clearTimeout(saveTimers[name]);
  await flushCollection(name).catch(e => console.error('[DB] saveNow error:', e.message));
}

// ── Public init: load all data from MongoDB ───────────────────────────────────
export async function initDatabase() {
  if (!getMongoUri()) {
    console.warn(
      '[DB] ⚠️  No database configured — running in-memory only (ALL data lost on restart)\n' +
      '     To persist data, set this in your .env or deployment secrets:\n' +
      '       MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/jutts_bot'
    );
    return;
  }
  try {
    await getDb(); // ensure connected
    // Load every collection into a temporary snapshot first. If any read fails,
    // retain the complete previous cache instead of mixing fresh and empty data.
    const loaded = {};
    for (const name of COLLECTIONS) loaded[name] = await mongoLoadCollection(name);
    for (const name of COLLECTIONS) {
      cache[name] = loaded[name];
      dirtyKeys[name].clear();
      deletedKeys[name].clear();
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
    console.error(`║  Fix: Check MONGODB_URI in your .env file              ║`);
    console.error(`╚${line}╝\n`);
  }
}

// Re-fetch from MongoDB (used by .dbstats reload)
export async function reloadDatabase() {
  await flushAll();
  await initDatabase();
}

// Flush everything before process exits
export async function flushAll() {
  await Promise.all(COLLECTIONS.map(n => {
    clearTimeout(saveTimers[n]);
    return flushCollection(n);
  }));
}

// On exit: flush every dirty key, including newly linked session metadata.
async function flushOnExit() {
  console.log('[DB] Flushing pending MongoDB writes before exit...');
  const results = await Promise.allSettled(
    COLLECTIONS.map(n => {
      clearTimeout(saveTimers[n]);
      return flushCollection(n);
    })
  );
  const failed = results.filter(result => result.status === 'rejected');
  if (failed.length) console.error(`[DB] ${failed.length} collection(s) failed to flush during shutdown`);
}
process.on('SIGTERM', async () => { await flushOnExit(); process.exit(0); });
process.on('SIGINT',  async () => { await flushOnExit(); process.exit(0); });

// ── Periodic safety-net flush (every 5 minutes) ───────────────────────────────
const periodicFlushTimer = setInterval(() => {
  if (!getMongoUri()) return;
  for (const name of COLLECTIONS) {
    if (name === 'sessions') continue;
    flushCollection(name).catch(e => console.error('[DB] periodic flush error:', e.message));
  }
}, 5 * 60 * 1000);
// Do not keep short-lived validation/test processes alive just for this timer.
periodicFlushTimer.unref();

export async function closeDatabase() {
  clearInterval(periodicFlushTimer);
  if (_client) await _client.close().catch(() => {});
  _client = null;
  _db = null;
}

export function backupDatabase(directory = path.join(process.cwd(), 'logs', 'backups')) {
  fs.mkdirSync(directory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = path.join(directory, `jutts-bot-${timestamp}.json`);
  const snapshot = {
    createdAt: new Date().toISOString(),
    collections: Object.fromEntries(
      COLLECTIONS.map(name => [name, cache[name]])
    ),
  };
  fs.writeFileSync(filename, JSON.stringify(snapshot, null, 2), { mode: 0o600 });
  return filename;
}

// ── db API ────────────────────────────────────────────────────────────────────
export const db = {

  // birthdays — lightweight per-JID birthday storage
  birthdays: {
    get: (jid) => cache.birthdays[jid] || null,
    set: (jid, data) => {
      cache.birthdays[jid] = { ...(cache.birthdays[jid] || {}), ...data };
      scheduleSave('birthdays', jid);
      return cache.birthdays[jid];
    },
    all: () => cache.birthdays,
    delete: (jid) => { delete cache.birthdays[jid]; scheduleSave('birthdays', jid, true); },
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
        scheduleSave('groups', key);
      }
      return cache.groups[key];
    },

    set: (sessionId, groupId, data) => {
      const key = `${sessionId}|${groupId}`;
      cache.groups[key] = { ...(cache.groups[key] || {}), ...data };
      scheduleSave('groups', key);
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
      const key = `${sessionId}|${groupId}`;
      delete cache.groups[key];
      scheduleSave('groups', key, true);
    },

    deleteBySession: (sessionId) => {
      const prefix = `${sessionId}|`;
      for (const key of Object.keys(cache.groups)) {
        if (!key.startsWith(prefix)) continue;
        delete cache.groups[key];
        scheduleSave('groups', key, true);
      }
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
    set: (id, data) => { cache.sessions[id] = { ...cache.sessions[id], ...data }; scheduleSave('sessions', id); },
    delete: (id) => { delete cache.sessions[id]; scheduleSave('sessions', id, true); },
    all: () => cache.sessions,
  },

  sessionSettings: {
    get: (sessionId) => cache.sessionSettings[sessionId] || {},
    set: (sessionId, data) => {
      cache.sessionSettings[sessionId] = { ...(cache.sessionSettings[sessionId] || {}), ...data };
      scheduleSave('sessionSettings', sessionId);
      return cache.sessionSettings[sessionId];
    },
    getValue: (sessionId, key) => cache.sessionSettings[sessionId]?.[key],
    setValue: (sessionId, key, value) => {
      if (!cache.sessionSettings[sessionId]) cache.sessionSettings[sessionId] = {};
      cache.sessionSettings[sessionId][key] = value;
      scheduleSave('sessionSettings', sessionId);
    },
    delete: (sessionId) => { delete cache.sessionSettings[sessionId]; scheduleSave('sessionSettings', sessionId, true); },
    all: () => cache.sessionSettings,
  },

  reminders: {
    get: (id) => cache.reminders[id] || null,
    set: (id, data) => { cache.reminders[id] = data; scheduleSave('reminders', id); },
    delete: (id) => { delete cache.reminders[id]; scheduleSave('reminders', id, true); },
    all: () => cache.reminders,
  },

  reload: () => reloadDatabase(),
  backup: (directory) => backupDatabase(directory),

  notes: {
    get: (jid) => cache.notes[jid] || {},
    setNote: (jid, name, data) => {
      if (!cache.notes[jid]) cache.notes[jid] = {};
      cache.notes[jid][name] = data;
      scheduleSave('notes', jid);
    },
    delNote: (jid, name) => {
      if (!cache.notes[jid]) return;
      delete cache.notes[jid][name];
      if (!Object.keys(cache.notes[jid]).length) {
        delete cache.notes[jid];
        scheduleSave('notes', jid, true);
      } else {
        scheduleSave('notes', jid);
      }
    },
    clear: (jid) => { delete cache.notes[jid]; scheduleSave('notes', jid, true); },
  },

  flushAll,
};

export default db;
