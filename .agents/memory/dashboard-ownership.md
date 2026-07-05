---
name: Dashboard and ownership architecture
description: How the dashboard connect flow works, owner auto-save on first connect, and superOwner resolution order.
---

# Dashboard & Ownership Architecture

## Connect flow (pairing code only)
- Dashboard is pairing-code only — QR tab removed. Backend still supports QR for backward compat.
- Session ID = phone number (e.g. `923001234567`) — no separate "session name" field.
- Phone is sanitized to `[a-zA-Z0-9_-]` in index.js `/session/create`, so numeric phone IDs are valid.

## Owner auto-save on first connect
When `connection === 'open'` fires in `lib/sessionManager.js`:
1. `sock.user.id` → phone number extracted
2. Added to `db.settings.owners` array if not already present
3. `db.settings.superOwner` set ONLY if `db.settings.getValue('superOwner')` is empty (first-time only, never overwrites)

## Owner resolution order (`lib/commandHandler.js`)
- `isOwner(jid)`: db.superOwner → config.superOwner → isConnectedSessionOwner → db.owners → config.owners
- `isSuperOwner(jid)`: db.superOwner → config.superOwner

**Why:** Auto-save ensures the connecting number gets owner permissions without manually editing config.js. DB-first resolution means the auto-saved value is actually used for permission checks.

## "You" chat detection
- `msg.key.fromMe === true` → always treated as owner in commandHandler (line: `const owner = isOwner(senderJid) || fromMe`)
- `isConnectedSessionOwner(jid)` matches any session's `sock.user.id`
- Both mechanisms mean self-chat always has owner access.
