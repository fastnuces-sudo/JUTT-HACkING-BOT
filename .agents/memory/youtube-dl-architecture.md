---
name: YouTube download architecture
description: How .play/.video/.mp3/.mp4 work — buffer-only delivery, ensureMp3 transcode chain
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
