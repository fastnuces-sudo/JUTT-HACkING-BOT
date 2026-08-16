---
name: Neon Postgres auth state
description: Baileys WhatsApp session auth stored in Neon Postgres.
---

`lib/pgAuthState.js` (formerly `mongoAuthState.js`) stores Baileys credentials and
signal keys in Postgres: `auth_creds(session_id, creds)` and
`auth_keys(session_id, key_type, keys)` with a composite primary key.

**Buffers:** values are encoded with Baileys' `BufferJSON` replacer/reviver before
hitting JSONB and decoded on read, so `noiseKey`, pre-keys and session blobs come
back as real `Buffer`s. `app-state-sync-key` values are additionally rehydrated via
`proto.Message.AppStateSyncKeyData.fromObject`.

**Key ids need no escaping.** MongoDB rejected dots in document keys, so the old
code swapped `.` for `\uFF0E`. Postgres JSONB has no such restriction and ids like
`92300.1@s.whatsapp.net` are stored verbatim — do not reintroduce escaping.
`\u0000` is still stripped, because JSONB rejects that escape inside strings.

**Fallback:** when `getPool()` returns `null` (no `DATABASE_URL`) the module falls
back to Baileys' `useMultiFileAuthState` in `session/<id>/`, which is gitignored.

**Exports:** `usePgAuthState`, `deletePgAuthState`, `sessionHasAuth`,
`flushAuthState`. Writes are debounced 200ms per key type; `flushAuthState` forces
them out before a connection closes so no signal key is lost.
