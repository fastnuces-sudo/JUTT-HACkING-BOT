---
name: Firebase Auth State
description: Baileys WhatsApp session auth state stored in Firebase RTDB — replaces useMultiFileAuthState disk storage.
---

## What it does
`lib/firebaseAuthState.js` — custom Baileys auth state provider.
- Stores WhatsApp `creds.json` at `auth/{sessionId}/creds` in Firebase RTDB
- Stores signal keys at `auth/{sessionId}/keys/{type}/{id}` in Firebase RTDB
- In-memory per-type key cache (loaded lazily on first access per type)
- 2.5s debounced writes to batch key updates and avoid spam
- Zero local disk writes — session directory no longer needed

## Key design
- `useFirebaseAuthState(sessionId)` → returns `{ state, saveCreds }` (same interface as Baileys)
- `deleteFirebaseAuthState(sessionId)` → clears cache + deletes from Firebase (called on logout/delete)
- Firebase key encoding: same `encKey`/`decKey` as database.js (handles `.`, `#`, `$`, `[`, `]`)
- BufferJSON replacer/reviver handles Buffer serialization
- `app-state-sync-key` type gets `proto.Message.AppStateSyncKeyData.fromObject()` deserialization

## sessionManager.js changes
- Removed `useMultiFileAuthState`, `import fs`, `import path`, `fileURLToPath`
- Removed `sessionDir` and all `fs.ensureDirSync(sessionPath)` calls
- `initAllSessions()` now reads session IDs from `db.sessions.all()` (Firebase) instead of `fs.readdir(sessionDir)`
- `deleteSession()` calls `deleteFirebaseAuthState(sessionId)` instead of `fs.remove()`
- On logout (DisconnectReason.loggedOut): calls `deleteFirebaseAuthState(sessionId)` to wipe Firebase auth

**Why:** Railway/Replit volumes fill up (500MB) with session files from multiple users. Firebase RTDB is effectively unlimited for session data sizes and doesn't count toward volume quota.
