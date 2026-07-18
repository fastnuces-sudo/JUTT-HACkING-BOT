---
name: Firebase Realtime Database integration
description: Database migrated from local JSON files to Firebase Realtime DB; architecture, key encoding, and init flow.
---

# Firebase Realtime Database

## Setup
- URL: `https://aa-md-bot-default-rtdb.firebaseio.com` (env: `FIREBASE_DB_URL`)
- Auth: legacy database secret (env: `FIREBASE_DB_SECRET`)
- REST API only (no firebase-admin SDK, no service account needed)

## Architecture
- **In-memory cache** is source of truth for all synchronous plugin reads — zero latency
- **Write-through debounce**: every `scheduleSave(collection)` waits 2s then PUT to Firebase
- **Startup**: `initDatabase()` GETs Firebase root in one request, populates all collections
- **Shutdown**: SIGTERM/SIGINT handlers call `flushAll()` to ensure nothing is lost

## Key encoding
Firebase disallows `.` `#` `$` `[` `]` in key names. JIDs (e.g. `@s.whatsapp.net`) contain dots.
- Encode: `~2E` for `.`, `~23` for `#`, `~24` for `$`, `~5B` for `[`, `~5D` for `]`
- encKey/decKey functions in database.js handle this transparently

## Init flow (index.js main())
1. `await initDatabase()` — load from Firebase first
2. Newsletter JID restoration — reads from db.settings (now populated)
3. startServer, loadPlugins, initAllSessions

**Why:** Previously these db.settings reads were at module level (before async init), so they'd always return empty on first boot. Moving them after `initDatabase()` fixes that.

## Collections
`users`, `groups`, `settings`, `sessions`, `sessionSettings` — same API as before, all sync reads.

## db.reload() 
Now returns a Promise (async re-fetch from Firebase). The `.dbstats reload` plugin awaits it.

## db.backup()
Writes current cache snapshot to `logs/backups/backup-<ts>.json` (local file, not Firebase).
