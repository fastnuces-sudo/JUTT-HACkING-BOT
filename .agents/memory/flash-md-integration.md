---
name: Flash-Md-V3 integration
description: What was compared, added, and fixed when merging Flash-Md-V3 features into AA-MD-Bot
---

## Comparison done (July 2026)
Source: https://github.com/franceking1/Flash-Md-V3

## Fixed (broken in our bot)
| Plugin | Problem | Fix |
|---|---|---|
| news.js | `api-key=demo` never works | Guardian `api-key=test` (always free) + BBC RSS fallback |
| downloader.js | api-faa.my.id / nexray APIs unstable | cobalt.tools as primary (free, no key, multi-platform) + faa as fallback |
| apk.js | Aptoide API path changed, crash on write fail | Better error handling, clean tmp cleanup |
| onlinealert.js | In-memory only, lost on restart | Persists to `db.settings.onlineAlerts` as JSON; re-reads from DB on every call |

## New plugins added (from Flash-Md-V3 feature set)
| Plugin | Command | API used |
|---|---|---|
| media/trim.js | `.trim <start> <end>` | System ffmpeg (NixOS path hardcoded + PATH fallback) |
| media/take.js | `.take <pack>\|<author>` | wa-sticker-formatter (installed) |
| media/attp.js | `.attp <text>` | raganork-api.onrender.com/api/attp (free) |
| download/tiktok.js | `.tiktok` | tikwm.com + cobalt fallback |
| download/instagram.js | `.ig` | cobalt.tools + faa fallback |
| download/facebook.js | `.fb` | cobalt.tools + faa fallback |
| download/spotify.js | `.spotify` | spotifydown.com free API |
| search/ai.js | `.ai / .gpt / .gemini / .llama / .mistral` | pollinations.ai (free, no key) with per-JID memory (max 200 JIDs, 12 msg each) |
| search/imagine.js | `.imagine` | image.pollinations.ai (free, no key) |
| search/ss.js | `.screenshot / .webss` | image.thum.io (free, no key) |
| search/country.js | `.country` | restcountries.com v3 (free, no key) |
| search/shazam.js | `.shazam` | audd.io test token (free, ~500/mo) |
| fun/emojimix.js | `.emojimix` | Google Emoji Kitchen gstatic CDN + emojik.vercel.app fallback |
| fun/coinflip.js | `.coinflip` | Built-in random |

## Key alias conflict rules (do not duplicate)
- `song` → youtube.js (.play)
- `ask` → 8ball.js
- `flip` → media/flip.js (image flip)
- `ss` → media/steal.js
- `sp` → freed (take.js uses packname, spotify uses spdl)

## Packages installed
`wa-sticker-formatter`, `fluent-ffmpeg`, `ffmpeg-static` added to AA-MD-Bot/package.json
(form-data was already present)
