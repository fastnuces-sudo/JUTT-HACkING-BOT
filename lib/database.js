import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Pool, types } = pg;

// Neon returns int8 (bigint) as a string by default via node-postgres. Nothing in
// this schema stores values beyond Number.MAX_SAFE_INTEGER, so parse to Number.
types.setTypeParser(20, value => Number(value));

// ── Connection ────────────────────────────────────────────────────────────────
// DATABASE_URL is the only source of database credentials. Never ship a fallback
// account in source code: an unset or placeholder URL intentionally enables the
// local-file/in-memory fallback used by the auth and settings layers.
//
// Neon connection strings look like:
//   postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require
export function getDatabaseUrl(env = process.env) {
  const configuredUrl = (env.DATABASE_URL ?? env.NEON_DATABASE_URL)?.trim();
  if (!configuredUrl || /PASSWORD|change_this|<[^>]+>/i.test(configuredUrl)) return null;
  if (!/^postgres(?:ql)?:\/\//i.test(configuredUrl)) {
    throw new Error('DATABASE_URL must start with postgres:// or postgresql://');
  }
  return configuredUrl;
}

// Extract the database name from the URL path. PGDATABASE is an explicit fallback
// for provider URLs that omit a path.
export function extractDbName(url, env = process.env) {
  const explicit = env.PGDATABASE?.trim();
  if (explicit) return explicit;

  const match = String(url || '').match(/^postgres(?:ql)?:\/\/[^/]+\/([^?]*)/i);
  const fromPath = match?.[1] ? decodeURIComponent(match[1]).trim() : '';
  return fromPath || 'jutts_bot';
}

// Neon requires TLS. Local/loopback Postgres (used in development and tests)
// generally has no certificate, so only enable SSL for remote hosts unless the
// URL explicitly disables it.
export function buildPoolConfig(url, env = process.env) {
  const disableSsl = /[?&]sslmode=disable/i.test(url) ||
    /^(1|true|yes)$/i.test(env.PGSSL_DISABLE || '');
  const isLoopback = /^postgres(?:ql)?:\/\/(?:[^@/]+@)?(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$)/i.test(url);

  return {
    connectionString: url,
    // Neon's pooler endpoint handles many clients; keep this process modest.
    max: Number.parseInt(env.PGPOOL_MAX || '10', 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
    // Neon closes idle connections; allow the pool to recycle them silently.
    allowExitOnIdle: true,
    ...(disableSsl || isLoopback ? {} : { ssl: { rejectUnauthorized: true } }),
  };
}

let _pool = null;
let _schemaReady = null;

export async function getPool() {
  if (_pool) return _pool;
  const url = getDatabaseUrl();
  if (!url) return null;

  const pool = new Pool(buildPoolConfig(url));
  // An idle client erroring (Neon scale-to-zero, network blip) must not crash the
  // process — node-postgres emits it on the pool.
  pool.on('error', error => console.error('[DB] idle client error:', error.message));

  try {
    const client = await pool.connect();
    client.release();
  } catch (error) {
    await pool.end().catch(() => {});
    throw error;
  }

  _pool = pool;
  return _pool;
}

// Back-compat alias: older code/plugins imported getDb() for a handle.
export const getDb = getPool;

export async function query(text, params) {
  const pool = await getPool();
  if (!pool) return null;
  return pool.query(text, params);
}

// ── Schema ────────────────────────────────────────────────────────────────────
// Every collection is a table of (key TEXT PRIMARY KEY, value JSONB). This keeps
// the flexible document shape the plugins expect while running on real Postgres,
// and lets Neon index/query the JSON when needed.
const COLLECTIONS = ['groups', 'settings', 'sessionSettings', 'notes', 'birthdays', 'sessions', 'reminders'];

// Map camelCase collection names to snake_case Postgres table names.
const TABLES = {
  groups: 'groups',
  settings: 'settings',
  sessionSettings: 'session_settings',
  notes: 'notes',
  birthdays: 'birthdays',
  sessions: 'sessions',
  reminders: 'reminders',
};

const AUTH_CREDS_TABLE = 'auth_creds';
const AUTH_KEYS_TABLE = 'auth_keys';

function tableFor(name) {
  const table = TABLES[name];
  // Defence in depth: table names are interpolated into DDL/DML, so they must
  // only ever come from this fixed allow-list.
  if (!table) throw new Error(`Unknown collection: ${name}`);
  return table;
}

export async function ensureSchema() {
  if (_schemaReady) return _schemaReady;

  _schemaReady = (async () => {
    const pool = await getPool();
    if (!pool) return;

    const statements = [
      ...Object.values(TABLES).map(table => `
        CREATE TABLE IF NOT EXISTS ${table} (
          key         TEXT PRIMARY KEY,
          value       JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )`),
      `CREATE TABLE IF NOT EXISTS ${AUTH_CREDS_TABLE} (
         session_id  TEXT PRIMARY KEY,
         creds       JSONB NOT NULL,
         updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      `CREATE TABLE IF NOT EXISTS ${AUTH_KEYS_TABLE} (
         session_id  TEXT NOT NULL,
         key_type    TEXT NOT NULL,
         keys        JSONB NOT NULL DEFAULT '{}'::jsonb,
         updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
         PRIMARY KEY (session_id, key_type)
       )`,
      `CREATE INDEX IF NOT EXISTS auth_keys_session_idx ON ${AUTH_KEYS_TABLE} (session_id)`,
      // groups keys are "{sessionId}|{groupId}" — this speeds up per-session scans.
      `CREATE INDEX IF NOT EXISTS groups_key_prefix_idx ON groups (key text_pattern_ops)`,
    ];

    for (const statement of statements) await pool.query(statement);
  })();

  try {
    await _schemaReady;
  } catch (error) {
    _schemaReady = null;
    throw error;
  }
  return _schemaReady;
}

const cache = { groups: {}, settings: {}, sessionSettings: {}, notes: {}, birthdays: {}, sessions: {}, reminders: {} };
// Persist only keys changed by this process. Writing entire cached collections
// would overwrite or delete records created by another VM between reloads.
const dirtyKeys = Object.fromEntries(COLLECTIONS.map(name => [name, new Set()]));
const deletedKeys = Object.fromEntries(COLLECTIONS.map(name => [name, new Set()]));

// ── Postgres helpers ──────────────────────────────────────────────────────────
async function pgLoadCollection(name) {
  const pool = await getPool();
  if (!pool) return {};
  const table = tableFor(name);
  try {
    const { rows } = await pool.query(`SELECT key, value FROM ${table}`);
    // 'settings' is a single flat document stored under key='__settings__'
    if (name === 'settings') {
      const row = rows.find(r => r.key === '__settings__');
      return row?.value ?? {};
    }
    const out = {};
    for (const row of rows) out[row.key] = row.value;
    return out;
  } catch (error) {
    console.error(`[DB] Postgres load ${name} failed:`, error.message);
    throw error;
  }
}

async function pgSaveCollection(name, upserts, removals) {
  const pool = await getPool();
  if (!pool) return;
  const table = tableFor(name);
  try {
    if (name === 'settings') {
      if (upserts) {
        await pool.query(
          `INSERT INTO ${table} (key, value, updated_at) VALUES ('__settings__', $1::jsonb, now())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [JSON.stringify(upserts)],
        );
      }
      return;
    }

    const entries = Object.entries(upserts || {});
    const removed = [...(removals || [])];
    if (!entries.length && !removed.length) return;

    // One round-trip per operation type — important on Neon where every query
    // crosses the network. unnest() lets us upsert the whole batch at once.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (entries.length) {
        await client.query(
          `INSERT INTO ${table} (key, value, updated_at)
           SELECT k, v::jsonb, now() FROM unnest($1::text[], $2::text[]) AS t(k, v)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [entries.map(([key]) => key), entries.map(([, value]) => JSON.stringify(value))],
        );
      }
      if (removed.length) {
        await client.query(`DELETE FROM ${table} WHERE key = ANY($1::text[])`, [removed]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`[DB] Postgres save ${name} failed:`, error.message);
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
        await pgSaveCollection(name, batch.upserts, batch.removed);
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
// loses data, long enough to avoid hammering Neon on rapid successive writes.
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
  if (!getDatabaseUrl()) return;
  clearTimeout(saveTimers[name]);
  await flushCollection(name).catch(e => console.error('[DB] saveNow error:', e.message));
}

// ── Public init: load all data from Neon Postgres ─────────────────────────────
export async function initDatabase() {
  if (!getDatabaseUrl()) {
    console.warn(
      '[DB] ⚠️  No database configured — running in-memory only (ALL data lost on restart)\n' +
      '     To persist data, set this in your .env or deployment secrets:\n' +
      '       DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/jutts_bot?sslmode=require\n' +
      '     Copy it from the Neon Console → your project → Connection Details.'
    );
    return;
  }
  try {
    await getPool();      // ensure connected
    await ensureSchema(); // create tables on first run
    // Load every collection into a temporary snapshot first. If any read fails,
    // retain the complete previous cache instead of mixing fresh and empty data.
    const loaded = {};
    for (const name of COLLECTIONS) loaded[name] = await pgLoadCollection(name);
    for (const name of COLLECTIONS) {
      cache[name] = loaded[name];
      dirtyKeys[name].clear();
      deletedKeys[name].clear();
    }
    const stats = COLLECTIONS.map(n => `${n}:${Object.keys(cache[n]).length}`).join('  ');
    console.log(`[DB] ✅ Neon Postgres loaded — ${stats}`);
  } catch (e) {
    const line = '═'.repeat(58);
    console.error(`\n╔${line}╗`);
    console.error(`║  ❌  NEON POSTGRES CONNECTION FAILED                     ║`);
    console.error(`╠${line}╣`);
    console.error(`║  Error : ${e.message.slice(0, 47).padEnd(47)} ║`);
    console.error(`╠${line}╣`);
    console.error(`║  ⚠️  These features will NOT work:                      ║`);
    console.error(`║    • Session persistence (QR after every restart)      ║`);
    console.error(`║    • Group settings (antilink, welcome, etc.)          ║`);
    console.error(`║    • Reminders, notes, birthdays                       ║`);
    console.error(`╠${line}╣`);
    console.error(`║  Fix: Check DATABASE_URL in your .env file             ║`);
    console.error(`║  Neon Console → Project → Connection Details           ║`);
    console.error(`╚${line}╝\n`);
  }
}

// Re-fetch from Neon (used by .dbstats reload)
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
  console.log('[DB] Flushing pending Postgres writes before exit...');
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
  if (!getDatabaseUrl()) return;
  for (const name of COLLECTIONS) {
    if (name === 'sessions') continue;
    flushCollection(name).catch(e => console.error('[DB] periodic flush error:', e.message));
  }
}, 5 * 60 * 1000);
// Do not keep short-lived validation/test processes alive just for this timer.
periodicFlushTimer.unref();

export async function closeDatabase() {
  clearInterval(periodicFlushTimer);
  if (_pool) await _pool.end().catch(() => {});
  _pool = null;
  _schemaReady = null;
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
