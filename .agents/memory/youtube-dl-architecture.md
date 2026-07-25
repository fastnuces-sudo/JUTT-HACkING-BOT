---
name: YouTube download architecture
description: How .play and .video work — yt-dlp is primary for both audio and video; all third-party APIs confirmed dead from Replit IP.
---

# YouTube download architecture

## Video (.video / .mp4)
`downloadVideo()` in `plugins/download/youtube.js`:

1. **Step A (PRIMARY)**: `tryYtdlpVideo()` — yt-dlp downloads to a temp FILE (not memory). Format order: `18/22` first (360p/720p progressive H.264+AAC, single file, no merge, confirmed working in ~12s), then DASH formats. Then `ensurePlayableMp4()` to add faststart.
2. **Step B (fallback)**: `downloadVideoFromStreamUrl()` — yt-dlp `--get-url` then `fetchBuf` in-process.
3. No third-party APIs — all dead from Replit IP (davidcyriltech, ryzendesu, agatz, ryzen all fail).

**Why format 18/22 first**: Confirmed working in test (12MB in ~12s). DASH formats require ffmpeg merge and are slower. The old code had 18/22 in position 2, wasting time on the DASH format first.

**Why yt-dlp not third-party APIs**: All tested APIs timeout/fail from Replit's server IP (34.x.x.x range is blocked by most free YouTube download APIs).

## Audio (.play / .song)
`downloadAudio()` — similar structure, davidcyriltech audio API as Step 0, then yt-dlp.

## ffmpeg dependency
Both audio and video paths use ffmpeg:
- `ensureMp3()` — transcode audio to mp3
- `ensurePlayableMp4()` — add faststart + re-encode if VP9/AV1/WebM
- Pass 1: stream-copy + faststart (fast, H.264+AAC sources)
- Pass 2: full re-encode libx264+aac (guaranteed WhatsApp-compatible)

## YTDLP_FLAGS
Defined in `lib/ytdlp.js`. Key: `--js-runtimes "deno:<path>"` required for n-challenge (nsig). Without Deno, YouTube serves only storyboard formats on many videos.

**Why:** Never send raw CDN URLs to WhatsApp — IP-bound, expire quickly. Always buffer + transcode.
