---
name: yt-dlp for social media downloads
description: How dl.js and ig.js use yt-dlp binary for TT/IG/FB/TW/Threads/SC after cobalt.tools went dead
---

# yt-dlp Social Media Downloads

## Rule
cobalt.tools now requires JWT auth — it is dead for free use. `dl.js` and `ig.js` now use yt-dlp binary directly for social platform downloads.

**Why:** yt-dlp natively supports TikTok, Instagram, Facebook, Twitter/X, Threads, SoundCloud, YouTube, and more.

**How to apply:**

### dl.js (plugins/download/downloader.js)
- Uses `execFile` (NOT `exec`) with args array to avoid shell injection.
- `ytdlpBaseArgs()` returns `{ flags, ckParts }` for reuse.
- Each request uses a unique file name: `Date.now() + random()` to prevent collision.
- Platform order: TikTok → tikwm primary, yt-dlp fallback; IG/FB/TW/Threads → yt-dlp primary, faaApi fallback; SC → yt-dlp audio; SP → spotifydown.com (still a risk); YT → yt-dlp audio; MF/PIN → faaApi only.

### ig.js (plugins/download/instagram.js)
- Uses `execFile` with args array (no shell injection).
- Output template: `${reqId}_%(autonumber)03d.%(ext)s` where `reqId` is unique per request.
- File collection filters strictly by `reqId` prefix — safe under concurrent downloads.
- Always cleans up own files, even on error.
- Fallback: faa API.

### logo.js (plugins/media/logo.js)
- 4-method fallback chain: mumaker → bochil proxy → lolhuman proxy → ephoto360 direct form submission.
- ephoto360 direct: GET page → extract _token → POST form → extract image URL.
- Buffer validation: size > 5000 bytes AND does not start with '<' (HTML error page).
