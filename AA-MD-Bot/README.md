# AA MD Bot

<p align="center">
  <img src="banner.webp" alt="AA MD Bot" width="600"/>
</p>

<p align="center">
  <b>Multi-Device WhatsApp Bot — 226+ Plugins | Multi-Session | Oracle ADB / MongoDB</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Platform-WhatsApp-25D366?logo=whatsapp&logoColor=white" />
  <img src="https://img.shields.io/badge/DB-Oracle_ADB_|_MongoDB-F80000?logo=oracle&logoColor=white" />
  <img src="https://img.shields.io/badge/Deploy-Oracle_|_Railway_|_Docker-blue" />
</p>

---

## Features

| Category | Highlights |
|---|---|
| 📥 Downloads | YouTube, Instagram, TikTok, Twitter, Spotify, Reddit, Pinterest, Threads |
| 🔍 Search | Google, YouTube, Wikipedia, News, Anime, Lyrics, Stickers |
| 🎵 Media | Audio convert, video convert, compress, watermark, sticker maker |
| 👥 Groups | Anti-spam, anti-call, anti-delete, welcome/goodbye, poll, tagall |
| 🛠 Tools | Calculator, currency, weather, OCR, AI chat, translator |
| 🕌 Islamic | Prayer times, Quran, Hadith, Dua, Hijri calendar |
| ⚙️ Admin | Ban, mute, kick, promote, broadcast, session manage |
| 🤖 Telegram | Mirror bot — download & search commands via Telegram |

---

## Deploy Options

### Option 1 — Oracle Cloud (Free, Recommended)

**3 ARM VMs + Oracle ADB 23ai — totally free forever.**

Full step-by-step guide: **[`deploy/ORACLE-DEPLOY.md`](deploy/ORACLE-DEPLOY.md)**  
Database setup: **[`deploy/ORACLE-ADB-GUIDE.md`](deploy/ORACLE-ADB-GUIDE.md)**

Quick summary:
```
Oracle Always Free:
 ├── 3 × ARM VM (1 OCPU, 6–8 GB RAM each)   ← runs the bot
 └── Oracle ADB 23ai (20 GB)                 ← shared database
```

```bash
# On each VM — run once after first SSH login:
bash <(curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/AA-MD-Bot/main/deploy/setup.sh) 1
# (use 2 or 3 for the second/third VM)
```

---

### Option 2 — Heroku

**[`deploy/HEROKU.md`](deploy/HEROKU.md)** — full Heroku guide (Docker container stack).

```bash
# Quick deploy via Heroku CLI
heroku create your-app-name
heroku stack:set container -a your-app-name
heroku config:set MONGODB_URI="mongodb://ADMIN:..." -a your-app-name
heroku config:set SESSION_SECRET="$(openssl rand -hex 32)" -a your-app-name
git push heroku main
```

Or via **Heroku Dashboard** → New App → connect GitHub → set Config Vars → deploy.

> Recommended dyno: **Basic ($7/month)** — always on. Eco sleeps and drops the WhatsApp connection.

---

### Option 3 — Docker / Railway / VPS

**[`deploy/DOCKER.md`](deploy/DOCKER.md)** — full guide for Docker, Docker Compose, Railway, and any VPS.

```bash
# Docker (quick start)
git clone https://github.com/YOUR_USERNAME/AA-MD-Bot.git
cd AA-MD-Bot
cp .env.example .env        # fill in your values
docker build -t aa-md-bot .
docker run -d --env-file .env -p 5000:5000 aa-md-bot
```

Railway: fork the repo → connect to Railway → it auto-detects the `Dockerfile`.

---

### Option 4 — Replit (Development / Testing)

Fork/clone into Replit, set secrets in the Secrets panel (same keys as `.env.example`), then run the **AA MD Bot** workflow. No installation needed.

---

## Configuration

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
nano .env
```

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Dashboard port (default `5000`) |
| `SERVER_ID` | No | `server-1` / `server-2` / `server-3` |
| `MONGODB_URI` | **Yes*** | Oracle ADB or MongoDB connection string |
| `MONGODB_PASSWORD` | Legacy | Old Atlas shorthand — use `MONGODB_URI` instead |
| `SESSION_SECRET` | **Yes** | Random 64-char string for dashboard auth |
| `TELEGRAM_BOT_TOKEN` | No | Admin/pairing bot (from @BotFather) |
| `TELEGRAM_FEATURES_BOT_TOKEN` | No | Features bot (download, search, etc.) |
| `OPENWEATHER_API_KEY` | No | Weather commands |
| `OMDB_API_KEY` | No | Movie info commands |
| `RAPIDAPI_KEY` | No | Some search plugins |
| `OCR_SPACE_KEY` | No | Image-to-text (`.ocr`) |
| `HF_TOKEN` | No | Hugging Face AI commands |
| `TENOR_API_KEY` | No | GIF search |

> \* Without `MONGODB_URI` the bot runs with **in-memory storage** — data is lost on restart.  
> Get a free Oracle ADB → [`deploy/ORACLE-ADB-GUIDE.md`](deploy/ORACLE-ADB-GUIDE.md)

---

## First-Time Setup (Pairing WhatsApp)

1. Start the bot and open the dashboard: `http://SERVER_IP:5000`
2. Enter your WhatsApp number (with country code, e.g. `923316041183`)
3. Click **Get Pairing Code**
4. On WhatsApp: **Settings → Linked Devices → Link a Device → Link with phone number**
5. Enter the 8-character code shown on the dashboard

The bot reconnects automatically on restart — you only pair once.

---

## Plugin Categories

```
plugins/
├── admin/      — 28 plugins  (ban, mute, kick, warn, broadcast …)
├── download/   — 14 plugins  (yt, ig, tiktok, spotify, reddit …)
├── fun/        — 26 plugins  (meme, dare, truth, roast, ship …)
├── gb/         — 14 plugins  (GBWhatsApp tools)
├── group/      — 18 plugins  (tagall, poll, welcome, antidelete …)
├── islamic/    — 61 plugins  (prayer, quran, hadith, dua …)
├── media/      — 22 plugins  (sticker, video convert, compress …)
├── owner/      — 29 plugins  (session, settings, mode, prefix …)
├── search/     — 35 plugins  (google, wiki, news, anime, lyrics …)
├── tools/      — 23 plugins  (calc, currency, weather, ocr, ai …)
└── utility/    — 20 plugins  (ping, info, help, uptime …)
```

---

## Updating the Bot

```bash
# On any server VM:
cd /home/ubuntu/AA-MD-Bot
git pull
npm install --omit=dev
pm2 restart aa-md-bot
pm2 logs aa-md-bot
```

---

## Telegram Mirror Bot (Optional)

Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_FEATURES_BOT_TOKEN` in `.env`.

- **Admin bot** — pairing, session management, restart via Telegram
- **Features bot** — `/yt`, `/ig`, `/twitter`, `/spotify`, `/reddit`, `/pin`, `/threads`, `/weather`, `/calc`, and more

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `MONGODB_PASSWORD not set` | Set `MONGODB_URI` in `.env` |
| Video won't play on WhatsApp | Bot re-encodes automatically — update to latest code |
| Port 5000 not reachable | Open port in firewall/security list |
| Bot crashes on start | `pm2 logs aa-md-bot --err` — check for missing env vars |
| yt-dlp not found | `sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod +x /usr/local/bin/yt-dlp` |
| YouTube "sign in to confirm" | Add cookies to `cookies.txt` — see `cookies.txt.example` |
| Bot disconnects often | Normal — WhatsApp disconnects idle sessions; PM2 auto-reconnects |

---

## Stack

- **[Baileys](https://github.com/WhiskeySockets/Baileys)** — WhatsApp Web API
- **[MongoDB Node.js Driver](https://www.mongodb.com/docs/drivers/node/current/)** — database (works with Oracle ADB 23ai)
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** + **ffmpeg** — media downloads
- **[Telegraf](https://telegraf.js.org/)** — Telegram mirror bot
- **[PM2](https://pm2.keymetrics.io/)** — process management

---

## Developer

**Ahsan Ali Wadani** — AA Mods
