---
name: ViewOnce Emoji Reveal
description: How the view-once reveal system works after replacing keyword trigger with emoji detection
---

# ViewOnce Emoji Reveal

## Rule
The voword keyword system has been removed. Owner now reveals view-once media by **replying to the message with 4 or more of the same emoji** (e.g. 🔥🔥🔥🔥).

**Why:** More intuitive than a keyword, no setup needed, works with any emoji.

**How to apply:**
- `handleReplyReveal()` in `lib/antiViewOnce.js` checks `msg.key.fromMe` (owner only), then calls `hasFourSameEmoji(msgText)`.
- `hasFourSameEmoji` uses `Intl.Segmenter` with granularity='grapheme' for correct handling of ZWJ sequences, flags, keycaps, and skin-tone variants.
- Fallback (old Node): simple codepoint range check.
- The quoted message's stanzaId is still used to look up the viewOnceStore (unchanged).
- `antiViewOnce on/off` (auto-reveal all) still works independently.
- `.voword` plugin now serves as an info/help command explaining the emoji system.
- `.avv` manual reveal still works.

## What was removed
- `db.settings.getValue('voKeyword')` — no longer read or written.
- Caption-based keyword trigger in `handleViewOnceMessage()` — removed.
- "If keyword triggered, send info header first" block — removed.
