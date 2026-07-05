---
name: ViewOnce implementation (post-rewrite)
description: How the new lib-based ViewOnce system works — replaces old plugin+voCache approach
---

## Architecture

All ViewOnce logic lives in `AA-MD-Bot/lib/antiViewOnce.js` (new, replaces voCache.js + antiviewonce plugin + voword plugin).

`sessionManager.js` feeds it from **two** event paths:
- `messages.upsert` → `handleViewOnceMessage(msg, sock, sessionId)`
- `messages.update` → same (for delayed/retry delivery — WhatsApp delivers view-once as empty placeholder first)

## Dedup design (critical)

`_processed.add(msgId)` is marked **only after the buffer downloads successfully**. This allows `messages.update` to retry if `messages.upsert` found the wrapper but the download returned empty (common with delayed VO delivery).

## Config keys (db.settings)

| Key | Purpose |
|-----|---------|
| `voKeyword` | If set, view-once captions containing this keyword auto-reveal to "You" chat |
| `voAutoReply` | If set, bot sends this text to sender on every view-once received |
| `antiViewOnce` | true/false — auto-forward ALL view-once to "You" chat (global) |
| `groups.<jid>.antiviewonce` | per-group toggle |

## Reveal methods (two, both active)

**Method 1 — `!reveal <msgId>`:** Owner sends this text in any chat (gated by `fromMe`). Fallback when reply-reveal isn't possible.

**Method 2 — Reply with keyword (primary):** Owner replies to the view-once message with voKeyword text. Bot extracts `contextInfo.stanzaId` from the reply, looks up viewOnceStore, and sends media to "You" chat. Includes 3 s retry loop (6 × 500 ms) for delayed `messages.update` delivery edge case.

`extractText()` and `extractContextInfo()` helpers in antiViewOnce.js use `normalizeMsg()` to unwrap ephemeral/documentWithCaption/all wrapper types before extracting.

## voword plugin

`plugins/owner/voword.js` — sets/removes `db.settings.voKeyword` (note: uses `db` arg from commandHandler, NOT `settings` — `settings` is not passed by commandHandler).

## Deleted files

- `lib/voCache.js` — replaced by `viewOnceStore` Map in antiViewOnce.js
- `plugins/gb/antiviewonce.js` — replaced by lib
- `plugins/owner/voword.js` — replaced by db.settings.voKeyword direct config

## Menus updated

`plugins/utility/menu.js` and `plugins/gb/gbmenu.js` updated to reference `!reveal <msgId>` instead of `.reveal` / `.voword`.
