# AA MD Bot

<p align="center">
  <img src="banner.webp" alt="AA MD Bot" width="600"/>
</p>

<p align="center">
  <b>Multi-Device WhatsApp Bot — 226+ Plugins | Multi-Session | Oracle Cloud / MongoDB</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Platform-WhatsApp-25D366?logo=whatsapp&logoColor=white" />
  <img src="https://img.shields.io/badge/DB-MongoDB-47A248?logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/Deploy-Oracle_Cloud-F80000?logo=oracle&logoColor=white" />
</p>

---

## Deploy on Oracle Cloud (Ubuntu VM)

**Ek hi command — bas itna karo:**

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/ahsanaliwadani/AA-MD-Bot/main/deploy/setup.sh)
```

Script khud poochega:
- `MONGODB_URI` — apna MongoDB connection string paste karo
- Telegram token (optional)

Baaki sab apne aap:
✅ Node.js 20 · ffmpeg · yt-dlp · Deno · PM2 install  
✅ Repo clone · npm install · .env likha  
✅ Firewall set · Bot start · Auto-restart on reboot

**Deploy ke baad dashboard:**
```
http://YOUR_SERVER_IP:5000
```
WhatsApp pairing code wahan se milega.

---

## Manual Deploy (any Ubuntu/Debian VPS)

```bash
git clone https://github.com/ahsanaliwadani/AA-MD-Bot.git
cd AA-MD-Bot
npm install
cp .env.example .env
nano .env          # set MONGODB_URI and other values
npm start          # OR: pm2 start ecosystem.config.cjs
```

Requires: **Node.js >= 20.6**, **ffmpeg**, **yt-dlp** on PATH.

---

## Database Options

Set `MONGODB_URI` in `.env` — pick the one that fits:

| Option | Example URI | Notes |
|---|---|---|
| **Self-hosted MongoDB on same VM** | `mongodb://user:pass@127.0.0.1:27017/aa_md_bot` | Best for single-VM setup |
| **MongoDB on another Oracle VM** | `mongodb://user:pass@10.0.0.X:27017/aa_md_bot` | Use private IP |
| **Oracle ADB 23ai (MongoDB API)** | `mongodb://ADMIN:pass@adb-xxx.oraclecloud.com:27017/ADMIN?authMechanism=PLAIN&tls=true&...` | Full guide: [ORACLE-ADB-GUIDE.md](deploy/ORACLE-ADB-GUIDE.md) |
| **MongoDB Atlas** | `mongodb+srv://user:pass@cluster.mongodb.net/aa_md_bot` | 512 MB free |

---

## Docker

```bash
git clone https://github.com/ahsanaliwadani/AA-MD-Bot.git
cd AA-MD-Bot
cp .env.example .env       # fill in MONGODB_URI
docker build -t aa-md-bot .
docker run -d --env-file .env -p 5000:5000 --name aa-md-bot aa-md-bot
```

Full Docker guide: **[`deploy/DOCKER.md`](deploy/DOCKER.md)**

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

## Configuration

Copy `.env.example` to `.env` and fill in values:

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | **Yes** | MongoDB connection string (see Database Options above) |
| `PORT` | No | Dashboard port (default `5000`) |
| `SERVER_ID` | No | `server-1` / `server-2` / `server-3` |
| `TELEGRAM_BOT_TOKEN` | No | Admin/pairing Telegram bot |
| `TELEGRAM_FEATURES_BOT_TOKEN` | No | Features mirror Telegram bot |
| `OPENWEATHER_API_KEY` | No | Weather plugin |
| `OMDB_API_KEY` | No | Movie/series search plugin |

---

## PM2 Commands

```bash
pm2 status                   # check if running
pm2 restart aa-md-bot        # restart
pm2 logs aa-md-bot           # live logs
pm2 logs aa-md-bot --err     # errors only
pm2 monit                    # live monitor (CPU/RAM)
```

## Updating

```bash
cd /home/ubuntu/AA-MD-Bot
git pull
npm install --omit=dev
pm2 restart aa-md-bot
pm2 logs aa-md-bot
```

---

## Pairing WhatsApp

Open the dashboard in your browser: `http://YOUR_SERVER_IP:5000`

1. Enter your WhatsApp number (with country code, e.g. `923316041183`)
2. Click **Get Pairing Code**
3. In WhatsApp: **Settings → Linked Devices → Link a Device → Link with phone number**
4. Enter the 8-digit code shown on the dashboard

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `MONGODB_URI not set` | Set `MONGODB_URI` in `.env`, then `pm2 restart aa-md-bot` |
| `Connection timeout` | Check MongoDB is running: `sudo systemctl status mongod` |
| `Authentication failed` | Wrong MongoDB user/password in URI |
| Dashboard not loading | `pm2 logs aa-md-bot --err` — check startup errors |
| Port 5000 not reachable | Oracle Console → VCN → Security List → add ingress rule for TCP 5000 |
| yt-dlp not found | `sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod +x /usr/local/bin/yt-dlp` |
| YouTube "sign in to confirm" | Add cookies to `cookies.txt` — see `cookies.txt.example` |
| Bot disconnects | Normal — WhatsApp disconnects idle sessions; PM2 auto-reconnects |

---

## Stack

- **[Baileys](https://github.com/WhiskeySockets/Baileys)** — WhatsApp Web API
- **[MongoDB Node.js Driver](https://www.mongodb.com/docs/drivers/node/current/)** — database
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** + **ffmpeg** — media downloads
- **[PM2](https://pm2.keymetrics.io/)** — process management on Oracle VM

---

**Developer:** Ahsan Ali Wadani — AA Mods
