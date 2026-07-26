---
name: ViewOnce Reveal System
description: How the view-once reveal system works — emoji trigger, .avv/.vv commands, antiviewonce auto-forward.
---

# ViewOnce Reveal System

## Rule
- **Emoji trigger (active):** reply to any message with 4 same emojis — works WITH or WITHOUT prefix (e.g. `🔥🔥🔥🔥` OR `.🔥🔥🔥🔥`). Both trigger reveal via `handleReplyReveal()`.
- **Manual command:** `.avv` / `.vv` / `.reveal` — reply to a view-once message to reveal it (owner only).
- **Auto-forward:** `.antiviewonce on/off` — auto-sends every view-once to owner's self-chat as it arrives.

**Why (emoji trigger fix):** The `textBody` was set to `''` when message had no prefix, so bare `🔥🔥🔥🔥` never matched. Fixed by: `const textBody = msgText.startsWith(prefix) ? msgText.slice(prefix.length) : msgText;`

**How to apply:**
- `handleReplyReveal()` in `lib/antiViewOnce.js` — `textBody` now uses full `msgText` as fallback (not empty string).
- `hasFourSameEmoji()` uses `Intl.Segmenter` for grapheme-aware detection.
- `handleViewOnceMessage()` still captures and caches all view-once media (unchanged).

## voKeyword
- Optional keyword trigger also works (stored in `db.settings.voKeyword`).
- Both keyword and emoji trigger can be active simultaneously.
