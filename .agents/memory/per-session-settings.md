---
name: Per-session settings architecture
description: How per-number settings are stored and accessed in AA-MD-Bot — critical for multi-session correctness.
---

## Rule
Each connected WhatsApp number has its own settings in `db.sessionSettings` (stored in `database/session-settings.json`, keyed by `sessionId`). Session settings take priority over the global `db.settings`; if no session value exists, global is the fallback.

## How to apply
- In plugins, always use `sessionSettings.get(key)` / `sessionSettings.set(key, val)` (the pre-bound accessor passed in `execute({})`) for per-number features: autoReply, autoRead, ghostMode, alwaysOnline, antiCall, antiCallMsg, autoReact, autoReactEmoji, botMode, autoTyping, autoStatus, autoStatusView, autoStatusReact, statusEmoji, privacy_*.
- Use `sessionSettings.eff(key, fallback)` when you need session→global→fallback resolution in one call.
- In `sessionManager.js` (outside execute), use `db.sessionSettings.getValue(sessionId, key) ?? db.settings.getValue(key)` for the same resolution.
- Global features (maintenanceMode, antiSpam, prefix, newsletter, owners list) stay in `db.settings` — do NOT migrate those.

## Why
Without per-session settings, enabling `.autoread on` on one number silently affects all other connected numbers. Each session (number) must be independently configurable.

## Key implementation details
- `db.sessionSettings` API: `getValue(sessionId, key)`, `setValue(sessionId, key, value)`, `get(sessionId)` → object, `set(sessionId, data)` → merged object, `delete(sessionId)`, `all()`.
- `commandHandler.js` builds a `sessionSettings` accessor bound to the current `sessionId` and passes it to every plugin's `execute()`.
- `alwaysonline.js` exports `stopAlwaysOnline(sessionId)` — ghost.js imports this to clear the always-online interval when enabling ghost mode. The `_intervals` Map is module-level (keyed by sessionId) to avoid cross-session interference.
- Duplicate `plugins/owner/autoread.js` was deleted — it conflicted with `plugins/gb/autoread.js` (same command name, global vs per-session). Plugin loader uses last-write-wins; the owner version would silently overwrite the gb per-session version.
