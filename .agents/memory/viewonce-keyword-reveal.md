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

## Duplicate plugin commands silently shadow each other
`pluginLoader.js`'s `getPlugin()` checks `plugins.has(cmd)` before checking `aliases`. If two plugin files both declare the same literal `command:` (or one declares as `command` what another only declares as an `alias`), whichever loads later (directories load alphabetically) wins outright — no warning, no error. This previously caused `.reveal` to route to an unrelated plugin that ignored `voCache` and sent media to the current chat instead of the owner's self chat, and caused `.antiviewonce on/off` to write to a differently-cased settings key (`antiviewonce` vs `antiViewOnce`) than the code that reads it.

**Why:** Multiple plugins were independently written for the same feature (view-once reveal) across `plugins/gb/`, `plugins/group/`, and `plugins/media/` without checking for existing command/alias overlap.

**How to apply:** Before adding a plugin, grep the whole `plugins/` tree for the exact `command` and every intended `alias` string. Keep one canonical plugin per command family — do not create a second plugin file "for groups" or "for a variant" of a command that already exists elsewhere.

## voCache population bug (2026-07-04)
The auto-cache-on-receive step in `lib/sessionManager.js` used Baileys' high-level `downloadMediaMessage(fakeMsg, ...)` wrapped in `.catch(() => null)` to fill `voCache` for every incoming view-once. This failed silently in production (no cache ever populated), which broke both `.reveal`-from-cache and the voword keyword-reveal path with zero error trace — while the *unrelated* duplicate `media/reveal.js` plugin (see above) still "worked" because it used a different method, `downloadContentFromMessage(mediaMsg, mediaType)` on the inner image/videoMessage directly, masking the real problem.

**Why:** Two different Baileys download methods were used for the same job across different files; the untested one silently failed and its failure was swallowed by a `.catch(() => null)`.

**How to apply:** For downloading media from a view-once (or any) message object in this codebase, always use `downloadContentFromMessage(innerMediaMsg, 'image'|'video')` + manual stream-to-buffer — it's the proven-reliable method here. Avoid the high-level `downloadMediaMessage` helper for view-once wrappers, and never swallow download errors with a bare `.catch(() => null)` — log them so failures are diagnosable.

## Never use Baileys' `normalizeMessageContent()` to detect view-once wrappers (2026-07-05)
WhatsApp sometimes wraps view-once media in `ephemeralMessage` (when disappearing messages is on for the chat). It's tempting to call Baileys' `normalizeMessageContent(msg.message)` to unwrap that before checking for `viewOnceMessage`/`viewOnceMessageV2`/`viewOnceMessageV2Extension` — but that helper *recursively* unwraps ALL future-proof containers, including the viewOnce wrapper itself, in the same loop. By the time it returns, you already have the raw `imageMessage`/`videoMessage` with no trace that it was ever view-once, so any check for the viewOnce wrapper on its output always fails silently.

**Why:** `normalizeMessageContent`'s internal `getFutureProofMessage()` treats `ephemeralMessage` and `viewOnceMessage*` as equally "unwrap and continue" cases — there's no way to stop it at just the ephemeral layer.

**How to apply:** To detect view-once while still knowing it was view-once, manually unwrap only `ephemeralMessage`/`documentWithCaptionMessage` in a small loop yourself, stop as soon as you hit a `viewOnceMessage*` key, then read the inner media from `voMsg.message.imageMessage/videoMessage`. Do not delegate this unwrapping to `normalizeMessageContent`.
