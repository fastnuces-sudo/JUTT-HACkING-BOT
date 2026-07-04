---
name: YouTube download architecture
description: How .play/.video/.mp3/.mp4 work — buffer-only delivery, ensureMp3 transcode chain, media buffer validation
---

## Rule
Never send a raw YouTube CDN URL as audio/video payload in WhatsApp. Always buffer before sending.

**Why:** YouTube CDN URLs expire within minutes. WhatsApp may not fetch them before expiry, causing silent playback failure.

## Audio pipeline (downloadAudio) — TRUE parallel race (~6s typical)
NEVER fetch DASH/bestaudio stream URL directly — YouTube throttles it to playback speed (tested: 3MB took 107s).

All three paths start simultaneously, first valid buffer wins (120s cap):
- **Path A** `downloadAudioFromVideo()`: progressive mp4 URL (android client) → fetchBuf (fast, not throttled) → `ffmpeg -vn` strip video → mp3. Tested: 6.3s total.
- **Path B** API race (Keith/Faa/Nexray): fastest when online, often down.
- **Path C** `tryYtdlpAudio()`: full yt-dlp `-x --audio-format mp3` download. Tested: 6.2s.

`firstSuccess()` resolves null cleanly when all paths fail.

`ensureMp3()` returns **null** on ffmpeg failure (never returns original buffer with wrong MIME). Step 2 null → falls through to Step 3.

## Video pipeline (downloadVideo)
1. Race yt-dlp stream URL + API sources (28s cap) → get a direct mp4 URL
2. `fetchBuf(url)` with 90s timeout → confirmed buffer
3. `tryYtdlpVideo()` full download fallback

## How to apply
All execute paths in `plugins/download/youtube.js` use `{ audio: buffer }` / `{ video: buffer }`. Thumbnail preview cards are the only `{ url }` sends and are intentional (YouTube thumbnail CDNs are stable, not expiring).

## Buffer validation is mandatory (added after silent-media-failure bug)
Third-party download APIs (Keith/Faa/Nexray/Gtech/Aagatz) are flaky and sometimes return a "success" response whose URL actually resolves to an HTML error page, JSON blob, or expired link. A naive `buf.length > 0` check treats this as valid, so WhatsApp receives corrupt bytes and silently fails to render media — no error surfaces anywhere (this was reported as "details/caption arrive but media never does, no error shown").

**Why:** `firstSuccess()` races multiple sources and takes whichever resolves first/non-null — a corrupted buffer from a flaky API can "win" over a slower-but-valid yt-dlp result.

**How to apply:** Always validate real magic bytes + minimum size before trusting any fetched buffer as media:
- Audio: `isValidAudioBuffer()` — reject <15KB, reject bodies starting with `<`/`{`/`[`, require ID3 tag or MPEG frame sync bytes.
- Video: `isValidVideoBuffer()` — reject <50KB, same text-error check, require `ftyp` box or WebM/EBML header.
- Apply at every API result site (`tryKeithMp3`, `tryFaaMp3`, `tryNexrayMp3`, video Step 2 fetch) AND as a final defense-in-depth check on the orchestrator's returned result before it's sent to WhatsApp.
- Also wrap the plugin's own error-reply path in try/catch with a plain `sock.sendMessage` fallback — if `reply()` itself throws, the failure must not become a silent unhandled rejection.
