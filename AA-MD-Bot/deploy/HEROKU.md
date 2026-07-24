# 🟣 AA MD Bot — Heroku Deploy Guide
## Docker Container Stack + Oracle ADB / MongoDB Atlas

> Heroku supports two deploy methods. **Method A (Docker)** is recommended for this bot  
> because it needs ffmpeg, yt-dlp, and Deno — which only work reliably inside a container.

---

## Database Options

| Database | Storage | Cost | Setup |
|---|---|---|---|
| **Oracle ADB 23ai** ✅ Recommended | **20 GB** | **Free forever** | [`ORACLE-ADB-GUIDE.md`](ORACLE-ADB-GUIDE.md) |
| MongoDB Atlas | 512 MB | Free (M0) | [atlas.mongodb.com](https://cloud.mongodb.com) |

Both give you a `MONGODB_URI` — paste it into Heroku config vars. No code change needed.

> **Oracle ADB setup guide → [`deploy/ORACLE-ADB-GUIDE.md`](ORACLE-ADB-GUIDE.md)**  
> Takes ~5 minutes. You get 20 GB free vs 512 MB on Atlas.

---

## Method A — Docker Container Stack (Recommended)

This uses the `Dockerfile` in the repo root — ffmpeg, yt-dlp, and Deno are all installed inside the container automatically.

### Step 1 — Install Heroku CLI

```bash
# macOS
brew tap heroku/brew && brew install heroku

# Ubuntu / Debian
curl https://cli-assets.heroku.com/install.sh | sh

# Windows — download from:
# https://devcenter.heroku.com/articles/heroku-cli
```

Verify: `heroku --version`

### Step 2 — Login

```bash
heroku login
# Opens browser — log in there
```

### Step 3 — Fork & Clone the Repo

```bash
git clone https://github.com/YOUR_USERNAME/AA-MD-Bot.git
cd AA-MD-Bot
```

### Step 4 — Create Heroku App

```bash
heroku create aa-md-bot
# Or with a custom name:
heroku create your-app-name
```

### Step 5 — Switch to Container Stack

```bash
heroku stack:set container -a aa-md-bot
```

> This tells Heroku to use the `heroku.yml` + `Dockerfile` instead of the Node.js buildpack.

### Step 6 — Set Config Vars (Environment Variables)

```bash
# Required — Oracle ADB (recommended)
heroku config:set MONGODB_URI="mongodb://ADMIN:YourPassword@adb-xxxxx.adb.REGION.oraclecloudapps.com:27017/ADMIN?authMechanism=PLAIN&tls=true&tlsAllowInvalidCertificates=true&retryWrites=false&loadBalanced=true" -a aa-md-bot

# Required — security
heroku config:set SESSION_SECRET="$(openssl rand -hex 32)" -a aa-md-bot

# Optional Telegram bots
heroku config:set TELEGRAM_BOT_TOKEN="your_token" -a aa-md-bot
heroku config:set TELEGRAM_FEATURES_BOT_TOKEN="your_token" -a aa-md-bot

# Optional API keys
heroku config:set OPENWEATHER_API_KEY="key" -a aa-md-bot
heroku config:set OMDB_API_KEY="key" -a aa-md-bot
heroku config:set RAPIDAPI_KEY="key" -a aa-md-bot
heroku config:set OCR_SPACE_KEY="key" -a aa-md-bot
heroku config:set HF_TOKEN="token" -a aa-md-bot
heroku config:set TENOR_API_KEY="key" -a aa-md-bot
```

Or set them in the Heroku Dashboard:  
**https://dashboard.heroku.com/apps/aa-md-bot/settings** → **Config Vars** section.

### Step 7 — Deploy

```bash
git push heroku main
```

Heroku builds the Docker image automatically. Takes 3–5 minutes.  
Watch the build log — at the end you'll see: `✨ AA MD Bot is ready!`

### Step 8 — Pair WhatsApp

```bash
# Get your app URL
heroku open -a aa-md-bot
# Or manually: https://aa-md-bot.herokuapp.com
```

On the dashboard:
1. Enter your WhatsApp number (with country code e.g. `923316041183`)
2. Click **Get Pairing Code**
3. On WhatsApp → **Settings → Linked Devices → Link a Device → Link with phone number**
4. Enter the 8-digit code

---

## Method B — Node.js Buildpack (Simpler, Limited)

> ⚠️ yt-dlp and Deno won't work with the basic buildpack.  
> Download commands (`.play`, `.video`, `.ig`, etc.) will be limited.  
> Use Method A (Docker) for full functionality.

### Step 1–4 same as above, then:

```bash
# Do NOT run heroku stack:set container — leave it on heroku-22

# Add buildpacks for ffmpeg
heroku buildpacks:add https://github.com/jonathanong/heroku-buildpack-ffmpeg-latest.git -a aa-md-bot
heroku buildpacks:add heroku/nodejs -a aa-md-bot

# Set config vars (same as Step 6 above)
heroku config:set MONGODB_URI="..." -a aa-md-bot
heroku config:set SESSION_SECRET="$(openssl rand -hex 32)" -a aa-md-bot

# Deploy
git push heroku main
```

> The `Procfile` in the repo handles the start command automatically:  
> `web: node --experimental-vm-modules index.js`

---

## Useful Commands

```bash
# View live logs
heroku logs --tail -a aa-md-bot

# Restart the bot
heroku restart -a aa-md-bot

# Open dashboard
heroku open -a aa-md-bot

# Check dyno status
heroku ps -a aa-md-bot

# SSH into the container (for debugging)
heroku run bash -a aa-md-bot

# Update after code change
git pull
git push heroku main
```

---

## Heroku Pricing (2025)

| Dyno Type | RAM | Cost | Notes |
|---|---|---|---|
| **Eco** | 512 MB | $5/month | Sleeps after 30 min idle — not ideal |
| **Basic** | 512 MB | $7/month | Always on — recommended |
| **Standard-1X** | 512 MB | $25/month | More reliable |
| **Standard-2X** | 1 GB | $50/month | Best for heavy download usage |

> **Recommended: Basic ($7/month)** — always on, 512 MB is enough for normal bot usage.  
> If bot crashes under heavy download load (ffmpeg), upgrade to Standard-2X.

---

## Important Notes for Heroku

### Ephemeral Filesystem
Heroku dynos have a **temporary filesystem** — files written to disk are lost on restart/redeploy.  
This bot is already designed for this:
- ✅ WhatsApp session → stored in MongoDB (`mongoAuthState.js`)
- ✅ Settings, groups, notes → stored in MongoDB
- ✅ `temp/` folder → ffmpeg temp files, auto-cleaned, fine to lose

### PORT
Heroku assigns a random `PORT` via env var.  
This bot already reads `process.env.PORT` — no changes needed. ✅

### Sleep (Eco Dyno)
Eco dynos sleep after 30 minutes of inactivity. WhatsApp connection drops on sleep.  
Use **Basic dyno** ($7/month) to keep the bot always online.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Build fails | `heroku logs --tail` — check for npm install errors |
| `[DB] ⚠️ MONGODB_PASSWORD not set` | Set `MONGODB_URI` in config vars |
| Bot crashes immediately | Check `SESSION_SECRET` is set |
| Dashboard shows "Application Error" | `heroku logs --tail` — usually env var missing |
| WhatsApp disconnects daily | Normal on Eco dyno (sleeps) — upgrade to Basic |
| yt-dlp not found (Method B) | Switch to Method A (Docker) |
| `Cannot find module` error | `heroku run npm install -a aa-md-bot` then restart |

---

## Quick Checklist ✅

**Before deploying:**
- [ ] Oracle ADB created and `MONGODB_URI` ready (or MongoDB Atlas URI)
- [ ] Repo pushed to your GitHub account
- [ ] Heroku CLI installed and logged in

**Deploy:**
- [ ] `heroku create your-app-name`
- [ ] `heroku stack:set container` (Method A only)
- [ ] All config vars set (`MONGODB_URI`, `SESSION_SECRET`)
- [ ] `git push heroku main`

**After deploy:**
- [ ] `heroku logs --tail` — verify `✨ AA MD Bot is ready!`
- [ ] Dashboard open → WhatsApp paired
- [ ] Dyno set to **Basic** (not Eco) for 24/7 uptime
