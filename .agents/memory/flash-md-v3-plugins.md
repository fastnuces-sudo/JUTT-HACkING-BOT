---
name: Flash-Md-V3 new plugins
description: Summary of new plugins added from Flash-Md-V3 comparison and bug fixes applied.
---

## New plugins added (from Flash-Md-V3)

| File | Command | Notes |
|------|---------|-------|
| plugins/media/logo.js | `.logo <style>\|<text>` | uses `mumaker.ephoto()` against ephoto360.com URLs; 20 styles |
| plugins/search/element.js | `.element <name/symbol/number>` | api.popcat.xyz/periodic-table; free, no key |
| plugins/fun/hack.js | `.hack <target>` | animated editing loop; falls back to single message if edits unsupported |
| plugins/fun/love.js | `.love <name1> & <name2>` | deterministic hash-based love % |
| plugins/group/disap.js | `.disap <off/24h/7d/90d>` | exports ARRAY of 4 plugins (loader handles via Array.isArray at line 35) |
| plugins/owner/privacy.js | `.privacy` | ownerOnly; sock.fetchPrivacySettings |
| plugins/owner/botzip.js | `.botzip` | uses `require('archiver')` via createRequire (NOT import default); excludes session/, auth_info_baileys/ |
| plugins/tools/currency.js | `.currency <amount> <FROM> <TO>` | open.er-api.com; free, no key |

## Bug fixes

- **weather.js** — rewritten to use `wttr.in?format=j1` (no API key); old OpenWeatherMap key was invalid
- **ss.js** — was using `encodeURIComponent` (breaks thum.io); fixed to `encodeURI` (preserves `:`, `/`, `?`, `&` but encodes spaces)
- **attp.js** — all external ATTP APIs broken; replaced with local SVG frame generation via sharp + ffmpeg → animated GIF → wa-sticker-formatter

## Key architecture notes

- `disap.js` array export: pluginLoader.js line 35 has `if (Array.isArray(exported))` — works correctly
- `archiver` is CommonJS; must use `createRequire` pattern in ESM plugins
- `mumaker` v2.0.0 has `.ephoto(url, text)` method returning image URL
- `encodeURI` is correct for thum.io screenshot URLs (not `encodeURIComponent`, not raw)
- Weather: wttr.in returns `j1` JSON format with current_condition, nearest_area, weather arrays

**Why:** External APIs break frequently; having local fallbacks (attp, weather with different provider) is more reliable.
