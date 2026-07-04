---
name: ViewOnce keyword reveal
description: How the voword secret-keyword feature works — owner replies to view-once with keyword, bot forwards revealed media to owner's self-chat
---

## Rule
Owner sets a secret keyword via `.voword <word>`. Replying to any cached view-once with that keyword silently forwards the revealed media to the owner's own "You" chat.

**Why:** Lets the owner reveal view-once stealthily without typing `.reveal` (which is visible to others in the chat).

## Implementation
- Keyword stored in `db.settings` as `voKeyword` (set/cleared via `plugins/owner/voword.js`)
- Detection block in `lib/sessionManager.js` — runs on every message, before `messageHandler`
- Ownership check: `msg.key.fromMe === true` OR sender number matches `config.ownerNumber[0]`
- Quoted message ID sourced from `msg.message?.extendedTextMessage?.contextInfo?.stanzaId`
- Media fetched from `voCacheGet(quotedId)` — only works if `antiviewonce` cached it first

## Permission
`plugins/owner/voword.js` uses `ownerOnly: true` (not `isOwner`). The commandHandler checks `plugin.ownerOnly` at line ~221. Using `isOwner: true` does nothing.

## How to apply
If adding any new owner-only plugin, use `ownerOnly: true` in the export. `isOwner` is a function name in commandHandler, not a plugin flag.
