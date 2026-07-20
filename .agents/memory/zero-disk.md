---
name: Zero disk architecture
description: Bot uses zero persistent disk (volume) storage — everything goes to Firebase or memory.
---

## What was moved / removed

| Old location | Size impact | New location |
|---|---|---|
| `session/{id}/` (Baileys auth) | 5–20 MB per session | Firebase RTDB `auth/{sessionId}/` |
| `media/viewonce/` (ViewOnce files) | 100KB–10MB per file | In-memory Map only (60-min TTL) |
| `database/notes/{jid}.json` | Small but accumulates | Firebase RTDB `notes` collection |
| `logs/backups/` (DB snapshots) | 1–10 MB per backup | Removed entirely |
| `temp/` (FFmpeg processing) | 5–50 MB per download | Still disk — unavoidable |

## Remaining disk usage (intentional)
- **`temp/`** — FFmpeg, sharp, and yt-dlp need real file paths. Files are deleted immediately after use. `cleanTemp()` runs every 30 minutes as safety net.

## Key file changes
- `lib/firebaseAuthState.js` — new file, handles Baileys auth
- `lib/sessionManager.js` — removed all `fs` and `path` imports, no session directories
- `lib/antiViewOnce.js` — removed `MEDIA_DIR`, `INDEX_PATH`, disk index, all `fs.*` calls; TTL extended to 60min
- `plugins/owner/reveal.js` — removed `getIndexEntry` import (disk index gone)
- `plugins/utility/notes.js` — rewritten to use `db.notes` (Firebase)
- `lib/database.js` — added `notes` collection; removed `backup()` and `fs-extra` import
- `index.js` — only creates `temp/` dir on startup (removed media/, session/, database/, logs/)

## `db.notes` API
```js
db.notes.get(jid)              // returns { noteName: { content, by, at } }
db.notes.setNote(jid, name, data)  // save/update a note
db.notes.delNote(jid, name)   // delete a note
db.notes.clear(jid)           // delete all notes for a chat
```

**Why:** Volume was filling up at ~20-23 users (500MB limit). Moving persistent data to Firebase RTDB eliminates volume growth entirely. Only ephemeral FFmpeg temp files remain on disk, and they self-clean.
