---
name: ViewOnce keyword reveal
description: How the voword/reveal feature works, what was fixed, and key architecture decisions.
---

# ViewOnce keyword reveal

## How it works
- Owner sets a secret keyword via `.voword <keyword>` → stored in `db.settings.getValue('voKeyword')`
- When any view-once arrives, `handleViewOnceMessage()` in `lib/antiViewOnce.js` downloads and stores it:
  - In-memory: `viewOnceStore` (Map, keyed by `msg.key.id`, 30-min TTL)
  - On disk: `media/viewonce/<filename>` + index at `media/viewonce/index.json` (maps msgId → metadata)
- Auto-reveal to "You" chat if `antiViewOnce` setting is ON or caption contains keyword
- Keyword reply: owner replies to a view-once with the keyword → `handleReplyReveal()` in sessionManager triggers
- `.reveal` plugin: owner sends `.reveal` as a reply (no ID needed) OR `.reveal <msgId>`

## What was fixed
- TTL extended from 5 min → 30 min (so reveals work if user takes time to respond)
- Persistent disk index added (`media/viewonce/index.json`) so `handleManualReveal` falls back to disk after TTL
- `extractContextInfo()` hardened to walk the full message wrapper chain (ephemeral, viewOnce, documentWithCaption) to find `stanzaId`
- `.reveal` plugin created at `plugins/owner/reveal.js` — previously only `!reveal <msgId>` worked (hardcoded in sessionManager)
- `handleRevealByReply()` exported from `lib/antiViewOnce.js` for the plugin to use

## Plugin flag rule
- Plugin must use `ownerOnly: true` (not `isOwner: true` which doesn't exist as a plugin flag)

## Key files
- `lib/antiViewOnce.js` — core logic: download, store, reveal functions
- `plugins/owner/voword.js` — set/remove keyword
- `plugins/owner/reveal.js` — `.reveal` command
- `plugins/owner/antiviewonce.js` — toggle auto-reveal
- `lib/sessionManager.js` lines 476-497 — keyword reply and `!reveal` dispatch

**Why:** The 5-min TTL caused reveals to fail if the owner didn't act immediately. The hardcoded `!reveal` prefix meant `.reveal` (bot prefix) silently did nothing.
