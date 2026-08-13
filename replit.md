# Jutts Bot on Replit

A Node.js multi-device WhatsApp bot with 251 plugin files, multi-session support, media processing and a protected web dashboard.

## Run

```bash
npm ci
npm start
```

Dashboard: port `5000` in the Replit web preview.

Recommended Replit Secrets:

- `MONGODB_URI` — persistent settings and WhatsApp authentication
- `DASHBOARD_TOKEN` — at least 16 random characters; protects pairing/session controls
- `SUPER_OWNER` — privileged WhatsApp number, digits only (otherwise first linked number is used)
- Optional API/Telegram keys from `.env.example`

Without `MONGODB_URI`, settings are in memory and auth falls back to the ignored local `session/` directory. Replit restarts can erase that fallback, so production use needs MongoDB.

## Structure

- `index.js` — HTTP server and application startup
- `config.js` — defaults and environment-derived owners/API keys
- `functional-dashboard.html` — active dashboard UI
- `lib/` — sessions, commands, database, dashboard auth and integrations
- `plugins/` — 11 plugin categories
- `deploy/` — Oracle setup/update scripts
- `test/` — unit, plugin-load and sticker tests

## Validation

```bash
npm run check
npm run smoke
npm audit --omit=dev
```

## Notes

- Node.js 20.6+ is required.
- FFmpeg and yt-dlp are required for many media/download commands.
- Keep `DASHBOARD_TOKEN`, MongoDB credentials, Telegram tokens and `cookies.txt` private.
- Telegram pairing is admin-only unless `TELEGRAM_PUBLIC_PAIRING=true` is set explicitly.
- The Oracle deployment binds Node to `127.0.0.1:5000` behind Nginx; Replit should keep the default `HOST=0.0.0.0`.
