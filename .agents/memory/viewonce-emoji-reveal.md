---
name: ViewOnce Reveal System
description: How the view-once reveal system works — only .vv and .avv commands; all auto-triggers removed.
---

# ViewOnce Reveal System

## Rule
Only `.vv` and `.avv` commands reveal view-once media. All auto-triggers (emoji, asdf keyword) have been removed. `antiviewonce on/off` auto-forward still works independently.

**Why:** User requested removal of emoji trigger and "asdf" keyword — only manual .vv/.avv should work.

**How to apply:**
- `handleReplyReveal()` in `lib/antiViewOnce.js` now returns immediately (disabled).
- `.vv` is an alias in `plugins/owner/reveal.js` — reply to a view-once message to reveal it.
- `.avv` is also in the same file — manual reveal by reply.
- `handleViewOnceMessage()` still captures and caches all view-once media (unchanged).
- `antiViewOnce on/off` auto-forward to self-chat still works.

## What was removed
- Emoji trigger (4 same emojis reply) — `hasFourSameEmoji()` still exists but is no longer called.
- `asdf` keyword trigger — removed from `handleReplyReveal()`.
- Menu entries for emoji trigger and asdf — removed from `plugins/utility/menu.js`.
