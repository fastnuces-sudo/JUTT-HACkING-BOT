# AA MD Bot

A production-ready multi-device WhatsApp bot with 147 plugins, multi-session support, economy system, XP/levels, media processing, and full owner/sudo control.

## Run & Operate

- Workflow **"AA MD Bot"** starts the bot automatically — just hit Run.
- On first start, scan the QR code shown in the console to connect WhatsApp.
- Web dashboard: `http://localhost:5000/` (visible in the Replit preview pane).

## Stack

- Node.js, JavaScript (ESM)
- WhatsApp: @whiskeysockets/baileys (Multi-Device)
- DB: JSON-based (fs-extra), stored in `AA-MD-Bot/database/`
- Key packages: axios, chalk, fs-extra, moment, pino, qrcode-terminal, jimp, yt-dlp

## Where things live

- `AA-MD-Bot/index.js` — main entry point
- `AA-MD-Bot/config.js` — bot configuration (owners, prefix, API keys, etc.)
- `AA-MD-Bot/lib/` — core engine (sessions, commands, plugins, database)
- `AA-MD-Bot/plugins/` — 147 plugins in 13 categories
- `AA-MD-Bot/database/` — JSON databases (users, groups, settings)
- `AA-MD-Bot/session/` — WhatsApp session files (auto-created on first scan)
- `AA-MD-Bot/dashboard.html` — web dashboard UI

## Plugin categories

admin (10), download (7), economy (8), fun (15), gb (13), group (11), owner (23), islamic (61), level (5), media (12), search (13), tools (10), utility (18)

## Configuration (`AA-MD-Bot/config.js`)

- **Owner number**: `ownerNumber` — set your WhatsApp number here for owner commands
- **Prefixes**: `.`, `!`, `#` by default
- **Bot mode**: `public` (responds to all) or `private` (owners only)
- **API keys** (optional, set as Replit Secrets):
  - `OPENWEATHER_API_KEY` — for weather plugin
  - `OMDB_API_KEY` — for movie/series search plugin

## User preferences

- Bot name: AA MD Bot
- Developer: Ahsan Ali Wadani
- Brand: AA Mods
- Default prefix: `.`

## Gotchas

- Must scan QR code in console on first run to connect WhatsApp.
- ffmpeg should be available for media plugins (sticker/blur/flip/grayscale/resize/toaudio).
- `ownerNumber` in `config.js` controls who has owner-level access.
- Sessions are stored in `AA-MD-Bot/session/` — don't delete while running.
- Use `.reload` command in WhatsApp to hot-reload plugins without restarting.
- yt-dlp is downloaded automatically by the workflow startup command.
