---
name: YouTube bot-check / PO token
description: Why yt-dlp intermittently fails with "Sign in to confirm you're not a bot" on .play/.video, and why PO token generation is not a viable fix in this sandbox.
---

YouTube shows "Sign in to confirm you're not a bot" on a **per-video basis**, not as a blanket IP ban. Confirmed by testing: one video ID (`dQw4w9WgXcQ`) succeeded consistently across many retries with no cookies/token, while other IDs (e.g. random music videos) failed consistently with the exact same yt-dlp flags/clients (android, tv_embedded, ios, mweb, web, web_embedded, tv, web_safari, android_vr all failed identically). So retrying different player clients does not reliably fix it — it depends on which video YouTube has flagged.

Two PO token generation approaches were tried and both are dead ends in this sandbox:
1. `youtube-po-token-generator` (jsdom-based) — hangs indefinitely fetching/executing real YouTube page scripts. Even its own internal 20s `Promise.race` timeout does not save it; an external `Promise.race` wrapper also does not rescue it (the underlying jsdom operation blocks in a way that prevents timers from firing).
2. `bgutils-js` (lighter, no jsdom) — gets past visitor-data fetch and challenge creation quickly (<1s), but the BotGuard interpreter script it evals requires a real browser-like global environment (`window`, and deeper undocumented internals — failed with cryptic `PMD:Undefined` after shimming `window`). This is a whack-a-mole of missing browser globals with no stable stopping point; not worth continuing.

**Why:** BotGuard's obfuscated challenge script is designed to run inside an actual browser and can fingerprint/require real browser internals; no sandboxed Node-only environment can satisfy it without also re-implementing significant browser surface area.

**How to apply:** Don't spend more time on programmatic PO token generation for this project. The reliable, standard fix (recommended by yt-dlp maintainers themselves for this exact error) is a real `cookies.txt` exported from a logged-in browser YouTube session, passed via `getCookiesFlag()` in `lib/ytdlp.js`. Direct users to export cookies via a browser extension ("Get cookies.txt LOCALLY") and drop the file at `AA-MD-Bot/cookies.txt` (already gitignored). Cookies expire periodically (weeks/months) and need re-export when the bot-check starts reappearing.
