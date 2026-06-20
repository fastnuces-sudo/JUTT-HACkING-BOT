# AA MD Bot

A production-ready multi-device WhatsApp bot with 109+ plugins, multi-session support, economy system, XP/levels, media processing, and full owner/sudo control.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — start AA MD Bot (shows QR in console)
- Bot health: `GET /api/healthz` — returns bot status JSON
- Bot stats: `GET /api/stats` — detailed stats

## Stack

- pnpm workspaces, Node.js 24, JavaScript (ESM)
- WhatsApp: @whiskeysockets/baileys (Multi-Device)
- DB: JSON-based (fs-extra), upgrade-ready structure
- Packages: axios, chalk, fs-extra, moment, pino, qrcode-terminal, jimp

## Where things live

- `artifacts/api-server/bot/index.js` — main entry point
- `artifacts/api-server/bot/config.js` — bot configuration (owners, prefix, etc.)
- `artifacts/api-server/bot/lib/` — core engine (sessions, commands, plugins, database)
- `artifacts/api-server/bot/plugins/` — 109+ plugins in 11 categories
- `artifacts/api-server/bot/database/` — JSON databases (users, groups, settings, sessions)
- `artifacts/api-server/bot/session/` — WhatsApp session files (auto-created)

## Architecture decisions

- Plugin-based architecture: each command is a separate ESM file, hot-reloadable with `.reload`
- Multi-session: each WhatsApp number gets its own session folder under `bot/session/`
- Shared database: all sessions share the same JSON databases for XP, economy, and settings
- Health HTTP server runs on PORT alongside the bot for Replit's proxy routing
- Command handler uses permission levels: owner > sudo > admin > user

## Product

AA MD Bot is a powerful WhatsApp Multi-Device bot with 109 plugins across 11 categories:
admin (kick/promote/warn/antilink), download (yt/tiktok/instagram), economy (coins/daily/gamble/shop), fun (jokes/memes/trivia/hangman), group management, level/XP system, media processing (stickers/blur/flip), owner tools (eval/shell/broadcast), search (wiki/anime/recipes/lyrics), tools (system/speedtest/backup), and utility (calc/weather/translate/qr).

## User preferences

- Bot name: AA MD Bot
- Developer: Ahsan Ali Wadani
- Brand: AA Mods
- Default prefix: `.`

## Gotchas

- Must scan QR code in console on first run to connect WhatsApp
- ffmpeg must be installed for media plugins (sticker/blur/flip/grayscale/resize/toaudio)
- Add owner number to `bot/config.js` before running for full control
- Sessions are stored in `bot/session/[session_name]/` — don't delete while running
- Use `.reload` to hot-reload plugins without restarting

## Pointers

- See `artifacts/api-server/bot/README.md` for full command reference
- See the `pnpm-workspace` skill for workspace structure details
