# Jutts Bot

<p align="center">
  <img src="banner.webp" alt="Jutts Bot" width="600"/>
</p>

<p align="center">
  <b>Multi-Device WhatsApp Bot — 251 Plugin Files | Multi-Session | Secure Web Dashboard</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white" alt="Node.js 20+" />
  <img src="https://img.shields.io/badge/Platform-WhatsApp-25D366?logo=whatsapp&logoColor=white" alt="WhatsApp" />
  <img src="https://img.shields.io/badge/DB-Neon_Postgres-00E599?logo=postgresql&logoColor=white" alt="Neon Postgres" />
  <img src="https://img.shields.io/badge/Deploy-Oracle_Cloud-F80000?logo=oracle&logoColor=white" alt="Oracle Cloud" />
</p>

## One-command Oracle deployment

Ubuntu 22.04 Oracle VM par SSH karne ke baad:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/fastnuces-sudo/JUTT-HACkING-BOT/main/deploy/setup.sh)
```

Script automatically:

- Neon Postgres connection string (`DATABASE_URL`) maangta hai aur validate karta hai
- Node.js 20, yt-dlp, Deno, FFmpeg, PM2 aur Nginx install karta hai
- Repository ko `/home/ubuntu/JUTT-HACkING-BOT` mein clone karta hai
- Reproducible `npm ci` install chalata hai
- Random `SESSION_SECRET` aur `DASHBOARD_TOKEN` generate karta hai
- PM2 startup, firewall, Nginx, nip.io domain aur Let's Encrypt configure karta hai
- Sirf SSH/HTTP/HTTPS ports expose karta hai; Node port 5000 private rehta hai

Deploy ke end par protected dashboard URL print hota hai:

```text
https://YOUR-IP.nip.io/#token=YOUR_DASHBOARD_TOKEN
```

`#token` URL fragment server logs ko send nahi hota. Login ke baad browser ko signed, HttpOnly cookie milti hai aur fragment URL se remove ho jata hai.

> **Important:** `.env` private rakhein. Agar repository ke kisi purane version mein database credentials use hue thay, un credentials ko provider par rotate karein.

## Deploy on Render

Render is supported via Docker (`Dockerfile` + `render.yaml`). Docker is used
instead of Render's native Node runtime because the bot shells out to **ffmpeg,
yt-dlp and deno**, which the Node runtime cannot install.

1. Create your Neon database first and copy the **pooled** connection string
   (host contains `-pooler`) — see [Getting your Neon connection string](#getting-your-neon-connection-string).
2. In Render: **New → Blueprint**, point it at this repository. It reads
   `render.yaml` automatically.
3. When prompted, paste your connection string into `DATABASE_URL`.
   `DASHBOARD_TOKEN` and `SESSION_SECRET` are generated for you.
4. After the first deploy, open **Environment** in Render, copy the generated
   `DASHBOARD_TOKEN`, and log in at:

   ```text
   https://YOUR-APP.onrender.com/#token=YOUR_DASHBOARD_TOKEN
   ```

5. Pair WhatsApp from the dashboard as described below.

### Render notes

| Topic | What to know |
|---|---|
| **Instance type** | Use a **paid** instance. Free instances sleep after ~15 minutes idle, which drops the WhatsApp socket and makes the bot miss messages. A WhatsApp bot needs a persistent connection. |
| **No disk needed** | Do **not** attach a Render disk. All state (WhatsApp auth, settings, groups, notes) lives in Neon, so a redeploy or container restart reconnects **without a new QR scan**. |
| **PORT** | Render injects `PORT`; the app already binds `0.0.0.0`. Leave `HOST` unset. |
| **Health check** | `/healthz` is public and returns 200 without auth — already set as `healthCheckPath`. |
| **Region** | Pick the Render region closest to your Neon project to keep query latency low. |
| **YouTube cookies** | For `Sign in to confirm you're not a bot` errors, supply a private `cookies.txt`; see `cookies.txt.example`. |

Run the same image locally:

```bash
docker build -t jutts-bot .
docker run --rm -p 5000:5000 \
  -e DATABASE_URL='postgresql://user:pass@ep-xxxx-pooler.REGION.aws.neon.tech/jutts_bot?sslmode=require' \
  -e DASHBOARD_TOKEN="$(openssl rand -hex 32)" \
  jutts-bot
```

## WhatsApp pair karna

1. Setup ke end par print hua protected dashboard URL browser mein kholein.
2. Session ID choose karein aur pairing method select karein.
3. Phone number country code ke saath enter karein, for example `923001234567`.
4. **Get Pairing Code** click karein.
5. WhatsApp → **Settings → Linked Devices → Link a Device → Link with phone number**.
6. Eight-digit code enter karein.

Pairing codes memory mein sirf 2 minutes rehte hain aur connection/delete/logout ke baad clear ho jate hain.

## Manual development setup

Requirements:

- Node.js 20.6 or newer
- npm 9 or newer
- FFmpeg and yt-dlp for media/download commands
- A [Neon](https://neon.tech) Postgres database for persistent sessions and settings (optional during local development)

```bash
git clone https://github.com/fastnuces-sudo/JUTT-HACkING-BOT.git
cd JUTT-HACkING-BOT
npm ci
cp .env.example .env
# Paste your Neon connection string into DATABASE_URL, then:
npm start
```

### Getting your Neon connection string

1. Create a free project at [console.neon.tech](https://console.neon.tech).
2. Open **Connection Details** and copy the **pooled** string (its host contains `-pooler`).
3. Put it in `.env`:

```dotenv
DATABASE_URL=postgresql://user:password@ep-xxxx-pooler.us-east-2.aws.neon.tech/jutts_bot?sslmode=require
```

Every table (`groups`, `settings`, `sessions`, `auth_creds`, `auth_keys`, ...) is created automatically on first start — no migrations or manual SQL required.

Dashboard: `http://localhost:5000`

For a protected local dashboard, generate and add a token:

```bash
openssl rand -hex 32
# Add the output as DASHBOARD_TOKEN=... in .env
```

Without `DATABASE_URL`, settings use memory and WhatsApp auth falls back to the ignored local `session/` directory. Production deployments should always configure Neon.

## Environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `PORT` | No | Dashboard port; default `5000` |
| `HOST` | No | Bind host; Oracle setup uses `127.0.0.1` behind Nginx |
| `DATABASE_URL` | Production | Neon Postgres connection string (`NEON_DATABASE_URL` also accepted) |
| `PGDATABASE` | No | Database-name override when the URL has no path |
| `PGPOOL_MAX` | No | Connection pool size; default `10` |
| `DASHBOARD_TOKEN` | Public deploy | Protects sessions, QR codes, pairing codes and dashboard controls |
| `DASHBOARD_ALLOWED_ORIGINS` | No | Comma-separated origins for a separate frontend |
| `SUPER_OWNER` | No | Main privileged WhatsApp number; first linked number is used when blank |
| `OWNER_NUMBERS` | No | Comma-separated additional owner numbers |
| `TELEGRAM_BOT_TOKEN` | No | Admin/pairing Telegram bot |
| `TELEGRAM_ADMIN_ID` | With admin bot | Numeric Telegram user ID allowed to pair/administer |
| `TELEGRAM_PUBLIC_PAIRING` | No | Defaults false; explicitly enables public Telegram pairing |
| `TELEGRAM_FEATURES_BOT_TOKEN` | No | Telegram feature mirror bot |
| `OPENWEATHER_API_KEY` | No | Weather command |
| `OMDB_API_KEY` | No | Movie command |
| `OCR_SPACE_KEY` | No | OCR command |
| `HF_TOKEN` | No | AI commands |

See [`.env.example`](.env.example) for the complete template.

## Features

| Category | Examples |
|---|---|
| Downloads | YouTube, Instagram, TikTok, Twitter, Spotify, Reddit, Pinterest, Threads |
| Search | Google, YouTube, Wikipedia, news, anime, lyrics, stickers |
| Media | Audio/video conversion, compression, watermark, sticker creation |
| Groups | Anti-spam, anti-call, anti-delete, welcome/goodbye, polls, tag-all |
| Tools | Calculator, currency, weather, OCR, AI chat, translator |
| Islamic | Prayer times, Quran, Hadith, Dua, Hijri calendar |
| Admin | Ban, mute, kick, promote, broadcast, session management |
| Telegram | Admin/pairing bot and feature mirror bot |

## Validation

```bash
npm test               # unit + all-plugin loading tests
npm run check:syntax   # syntax-check every JS/MJS/CJS file
npm run smoke          # starts an isolated server and tests HTTP/auth/CORS
npm run check          # syntax + tests
npm audit --omit=dev   # dependency vulnerability report
```

## PM2 and updates

```bash
pm2 status
pm2 logs jutts-bot
pm2 restart jutts-bot
bash ~/redeploy.sh
```

The update script preserves `.env`, installs from `package-lock.json`, restarts PM2, and checks `/healthz`.

## Troubleshooting

| Problem | Fix |
|---|---|
| Dashboard login fails | Read `DASHBOARD_TOKEN` from `/home/ubuntu/JUTT-HACkING-BOT/.env` |
| Dashboard does not open | `pm2 logs jutts-bot --err` and `sudo nginx -t` |
| Database connection fails | Check `DATABASE_URL` and confirm the Neon project is active in the console |
| YouTube bot-check error | Export a personal `cookies.txt`; see `cookies.txt.example` |
| Port 5000 is not public | Expected: Nginx proxies 80/443 to private `127.0.0.1:5000` |
| Plugin validation fails | Run `npm ci` followed by `npm test` |

For advanced Oracle networking and multi-VM notes, see [`deploy/ORACLE-DEPLOY.md`](deploy/ORACLE-DEPLOY.md).

## Stack

[Baileys](https://github.com/WhiskeySockets/Baileys) · [Neon Postgres](https://neon.tech/) · [Sharp](https://sharp.pixelplumbing.com/) · [yt-dlp](https://github.com/yt-dlp/yt-dlp) · [FFmpeg](https://ffmpeg.org/) · [PM2](https://pm2.keymetrics.io/)

**Developer:** Sajid Jutt — Jutts Mods
