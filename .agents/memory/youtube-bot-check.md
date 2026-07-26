---
name: YouTube bot-check / PO token
description: Why yt-dlp intermittently fails with "Sign in to confirm you're not a bot" on .play/.video, and why PO token generation is not a viable fix in this sandbox.
---

YouTube shows "Sign in to confirm you're not a bot" on a **per-video basis**, not as a blanket IP ban. Confirmed by testing: one video ID (`dQw4w9WgXcQ`) succeeded consistently across many retries with no cookies/token, while other IDs (e.g. random music videos) failed consistently with the exact same yt-dlp flags/clients (android, tv_embedded, ios, mweb, web, web_embedded, tv, web_safari, android_vr all failed identically). So retrying different player clients does not reliably fix it — it depends on which video YouTube has flagged.

Two PO token generation approaches were tried and both are dead ends in this sandbox:
1. `youtube-po-token-generator` (jsdom-based) — hangs indefinitely fetching/executing real YouTube page scripts. Even its own internal 20s `Promise.race` timeout does not save it; an external `Promise.race` wrapper also does not rescue it (the underlying jsdom operation blocks in a way that prevents timers from firing).
2. `bgutils-js` (lighter, no jsdom) — gets past visitor-data fetch and challenge creation quickly (<1s), but the BotGuard interpreter script it evals requires a real browser-like global environment (`window`, and deeper undocumented internals — failed with cryptic `PMD:Undefined` after shimming `window`). This is a whack-a-mole of missing browser globals with no stable stopping point; not worth continuing.

**Why:** BotGuard's obfuscated challenge script is designed to run inside an actual browser and can fingerprint/require real browser internals; no sandboxed Node-only environment can satisfy it without also re-implementing significant browser surface area.

**How to apply:** Don't spend more time on programmatic PO token generation for this project. The reliable, standard fix (recommended by yt-dlp maintainers themselves for this exact error) is a real `cookies.txt` exported from a logged-in browser YouTube session, passed via `getCookiesFlag()` in `lib/ytdlp.js`. Direct users to export cookies via a browser extension ("Get cookies.txt LOCALLY") and drop the file at `AA-MD-Bot/cookies.txt` (already gitignored), or use the in-bot `.cookies` command (superOwnerOnly) which accepts a pasted cookie text or attached .txt file directly in WhatsApp. Cookies expire periodically (weeks/months) and need re-export when the bot-check starts reappearing.

## Cookies can make things WORSE if forced onto every client (confirmed 2026-07-04)
yt-dlp player clients split into two groups: `android`/`tv_embedded`/`ios` do NOT support cookie auth (yt-dlp skips them entirely with a warning if cookies are passed), while `web`/`mweb`/`web_safari`/`tv` do. Tested live: a real exported cookies.txt, when forced onto every client, made even the cookie-compatible clients return ONLY storyboard (thumbnail) formats — no real audio/video — while the exact same request with NO cookies worked instantly on `android`/`tv_embedded`. Likely cause: YouTube treats a personal-account cookie replayed from an unfamiliar server IP as suspicious and serves a degraded response.

**Why:** A single flat `--cookies` flag applied unconditionally to all clients regressed a previously-working no-cookie pipeline the moment cookies.txt was added.

**How to apply:** Never pass `--cookies` to `android`/`tv_embedded`/`ios` attempts. Structure yt-dlp calls as tiers: Tier 1 = no-cookie clients first (fast, reliable for public videos), Tier 2 = cookie-compatible clients (`web`/`mweb`) with `--cookies` only as a fallback for age-restricted/private/members-only content. This is how `plugins/download/youtube.js`'s `tryYtdlpStreamUrl`/`tryYtdlpAudio`/`tryYtdlpVideo` are structured — preserve this tiering when touching that file.

## Third-party mp3/mp4 API fallbacks go stale fast
The API race sources in `plugins/download/youtube.js` (Keith, Faa, Nexray, Gtech, Agatz) are free unofficial YouTube-downloader APIs that come and go. As of 2026-07-04, all three mp3 APIs (Keith/Faa/Nexray) were confirmed dead (500 error, HTML error page, empty response respectively). This doesn't break the feature since they're raced in parallel with yt-dlp and yt-dlp wins when they're down — but don't assume they're alive without testing, and don't rely on them as the primary path.

## Deno is required for yt-dlp's "n" challenge — Node is NOT supported (confirmed 2026-07-05)
Real-world/less-popular videos (e.g. niche religious/regional songs, not just bot-checked ones) returned ONLY storyboard (mhtml thumbnail) formats — no audio/video streams at all — even though the request didn't show "sign in to confirm you're not a bot". Root cause: yt-dlp needs a working JS runtime to solve YouTube's nsig ("n" parameter) anti-throttling challenge; without it, YouTube silently strips all real media formats. `--js-runtimes "node:<path>"` looked correct but yt-dlp's own runtime check reports Node (even v20/v22) as **"unsupported"** for its JS challenge engine (EJS) — only Deno works. Fix: install Deno (`curl -fsSL https://deno.land/install.sh | sh`) and pass `--js-runtimes "deno:<path>"` instead. This must be installed persistently in the workflow startup command (not just the shell PATH), same pattern as the existing yt-dlp auto-install.

**Why:** Without this, `yt-dlp -F` on an affected video shows only `sb0`-`sb3` (storyboard) formats and a `WARNING: ... n challenge solving failed` — a silent, hard-to-diagnose failure that looks identical to "no formats available" from other causes.

**How to apply:** `lib/ytdlp.js` resolves Deno (not Node) for `YTDLP_FLAGS`. If yt-dlp download failures resurface, first check `yt-dlp -v -F <url>` output for "JS runtimes: none" or "(unsupported)" before assuming it's a bot-check or dead API issue.

## ARM64 pip installs may omit the yt-dlp launcher
On Oracle Ubuntu ARM64, `pip3 install yt-dlp` can report the package as already installed while not creating `/usr/local/bin/yt-dlp` because Python and pip use different script paths. The installer must resolve an existing executable or create `/usr/local/bin/yt-dlp` as a wrapper around the exact Python interpreter that imports `yt_dlp`, then verify `yt-dlp --version`.

**Why:** Assuming the conventional pip launcher path caused an otherwise successful ARM64 install to abort during `chmod`.

**How to apply:** Keep the ARM64 install idempotent and validate both executable presence and actual execution before continuing to Deno or the bot setup.

## 'web' client fails even with valid cookies — use mweb/tv/tv_embedded instead (confirmed 2026-07-05)
Contrary to earlier assumption, `tv_embedded` DOES accept `--cookies` in the installed yt-dlp version (it's bot-checked without cookies but works fine with them) — it was wrongly excluded from the cookie-tier client list. Meanwhile `web` consistently fails with "Requested format is not available" even with valid cookies on this server. Confirmed working cookie-tier clients (tested against a real failing video end-to-end, both audio -x and video -f download): `mweb`, `tv_embedded`, `tv`. `COOKIE_CLIENTS` in `plugins/download/youtube.js` should be `['mweb', 'tv_embedded', 'tv']`, not `['web', 'mweb']`.

## Plugins never actually received `prefix` (silent bug affecting 20+ plugins)
`lib/commandHandler.js` destructured `{ command, args, text }` from `parseCommand()` but dropped the `prefix` field it also returns, and never included `prefix` in the object passed to `plugin.execute()`. Every plugin using `prefix` in its execute signature (menu.js, youtube.js, github.js, weather.js, and 15+ others) silently got `undefined`, producing messages like `undefinedvideo <link>` instead of `.video <link>`. Fixed by adding `prefix` to both the destructure and the `plugin.execute({...})` call site in `commandHandler.js`.

**Why:** This is a "looks right in the plugin file, breaks at the call site" class of bug — grepping only the plugin files (which correctly use `${prefix}`) never reveals it; the wiring must be checked in the handler that invokes plugins.
