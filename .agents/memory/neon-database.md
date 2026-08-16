---
name: Neon Postgres database
description: How Jutts Bot persists settings and state in Neon serverless Postgres.
---

`lib/database.js` is the single persistence layer. It replaced MongoDB (which had
replaced Firebase); no Mongo driver or URI remains anywhere in the repository.

**Connection:** `DATABASE_URL` (alias `NEON_DATABASE_URL`) is the only source of
credentials. An unset or placeholder value returns `null` from `getDatabaseUrl()`,
which intentionally enables the in-memory/local-file fallback. TLS is enabled for
every non-loopback host, so Neon always connects over `sslmode=require`; loopback
URLs used in development and tests skip SSL automatically.

**Schema:** every collection is a `(key TEXT PRIMARY KEY, value JSONB, updated_at)`
table, so the flexible document shape the 251 plugins expect still works while
running on real Postgres. Collection→table names are resolved through a fixed
`TABLES` allow-list because table names are interpolated into SQL. `ensureSchema()`
is idempotent (`CREATE TABLE IF NOT EXISTS`) and runs on every start, so there are
no migration files to manage.

**Caching:** unchanged from before — an in-memory cache plus per-key dirty/deleted
sets, debounced 2s, flushed on SIGTERM/SIGINT and every 5 minutes. Batched upserts
use `unnest($1::text[], $2::text[])` so one round-trip writes the whole batch,
which matters because every Neon query crosses the network.

**Gotchas:** `settings` is a single flat document under `key='__settings__'`.
Prefer the pooled (`-pooler`) Neon host. Free Neon projects scale to zero when
idle; the first query wakes them, and the pool's `error` handler keeps a dropped
idle connection from crashing the process.
