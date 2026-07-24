# 🟣 AA MD Bot — Heroku Deploy Guide
## Docker Container Stack + Oracle ADB / MongoDB Atlas

> ⚠️ **Monorepo issue — read first**  
> This bot lives inside an `AA-MD-Bot/` subfolder. Pushing the repo root to Heroku  
> picks up the wrong `package.json` and **fails with "Use pnpm instead"**.  
> All methods below correctly deploy **only the subfolder**.

---

## Database — Which to use?

| Database | Storage | Cost | Notes |
|---|---|---|---|
| **Oracle ADB 23ai** ✅ Best | **20 GB** | **Free forever** | Guide: [`ORACLE-ADB-GUIDE.md`](ORACLE-ADB-GUIDE.md) |
| MongoDB Atlas | 512 MB | Free (M0) | [cloud.mongodb.com](https://cloud.mongodb.com) → free cluster → Connect → get URI |

Both give you a `MONGODB_URI` string — paste it into Heroku Config Vars. No code change needed.

---

## Method A — GitHub Actions ✅ Recommended (No CLI needed)

Fully automatic. Every push to `main` triggers a deploy. Uses Docker so ffmpeg + yt-dlp + Deno all work.

### Step 1 — Create Heroku App

Go to **https://dashboard.heroku.com** → **New** → **Create new app**  
Give it a name (e.g. `aa-md-bot-prod`) → Create app.

> Do **not** connect GitHub in the Deploy tab — Actions handles this.

### Step 2 — Set Config Vars on Heroku

Go to your app → **Settings** → **Config Vars** → **Reveal Config Vars**

Add these:

| Key | Value |
|---|---|
| `MONGODB_URI` | Your Oracle ADB or Atlas connection string |
| `SESSION_SECRET` | Any random 64-char string (generate: `openssl rand -hex 32`) |
| `TELEGRAM_BOT_TOKEN` | *(optional)* |
| `TELEGRAM_FEATURES_BOT_TOKEN` | *(optional)* |
| `OPENWEATHER_API_KEY` | *(optional)* |
| `OMDB_API_KEY` | *(optional)* |
| `RAPIDAPI_KEY` | *(optional)* |
| `OCR_SPACE_KEY` | *(optional)* |
| `HF_TOKEN` | *(optional)* |
| `TENOR_API_KEY` | *(optional)* |

### Step 3 — Get Heroku API Key

Heroku Dashboard → click your **profile icon** (top right) → **Account settings**  
Scroll to **API Key** → **Reveal** → copy it.

### Step 4 — Add Secrets to GitHub

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add all three:

| Secret Name | Value |
|---|---|
| `HEROKU_API_KEY` | The API key from Step 3 |
| `HEROKU_APP_NAME` | Your app name (e.g. `aa-md-bot-prod`) |
| `HEROKU_EMAIL` | Your Heroku account email |

### Step 5 — Push to GitHub

The workflow file `.github/workflows/heroku-deploy.yml` is already in the repo.  
Just push your code — GitHub Actions will build and deploy automatically:

```bash
git add .
git commit -m "Deploy to Heroku"
git push origin main
```

Then go to GitHub → **Actions** tab to watch the build progress.

### Step 6 — Check Logs on Heroku

Heroku Dashboard → your app → **More** → **View logs**

Good signs:
```
✨ AA MD Bot is ready!
[DB] ✅ MongoDB loaded — groups:0  settings:0  sessionSettings:0 ...
```

### Step 7 — Pair WhatsApp

Open: `https://your-app-name.herokuapp.com`  
Enter your number → Get Pairing Code → pair on WhatsApp.

---

## Method B — Heroku CLI + git subtree push (local machine)

Use this if you prefer the command line without GitHub Actions.  
Requires [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed locally.

```bash
# Clone the full repo locally
git clone https://github.com/YOUR_USERNAME/AA-MD-Bot.git
cd AA-MD-Bot

# Login to Heroku
heroku login

# Create app (skip if already created)
heroku create your-app-name

# Set container stack (Docker mode — required for ffmpeg/yt-dlp/Deno)
heroku stack:set container -a your-app-name

# Add Heroku remote
heroku git:remote -a your-app-name

# Set config vars
heroku config:set MONGODB_URI="mongodb://ADMIN:..." -a your-app-name
heroku config:set SESSION_SECRET="$(openssl rand -hex 32)" -a your-app-name

# Push ONLY the AA-MD-Bot/ subfolder as the root — fixes the monorepo issue
git subtree push --prefix AA-MD-Bot heroku main
```

For future updates:
```bash
git pull origin main
git subtree push --prefix AA-MD-Bot heroku main
```

> If subtree push fails with "Updates were rejected":
> ```bash
> git push heroku $(git subtree split --prefix AA-MD-Bot main):main --force
> ```

---

## Method C — Separate GitHub Repo (cleanest long-term)

If you want direct GitHub → Heroku deploys without Actions:

```bash
# Clone the repo locally
git clone https://github.com/YOUR_USERNAME/AA-MD-Bot.git
cd AA-MD-Bot

# Extract just the bot folder as a standalone repo
git subtree split --prefix AA-MD-Bot -b heroku-deploy

# Create a new empty GitHub repo: github.com/new → "AA-MD-Bot-Deploy"
# Then push the bot-only branch there:
git checkout heroku-deploy
git remote add deploy https://github.com/YOUR_USERNAME/AA-MD-Bot-Deploy.git
git push deploy heroku-deploy:main
```

Now in Heroku Dashboard → Deploy → connect `AA-MD-Bot-Deploy` repo → enable auto-deploy.

---

## Useful Commands (after deploy)

```bash
# View live logs
heroku logs --tail -a your-app-name

# Restart
heroku restart -a your-app-name

# SSH into container (debug)
heroku run bash -a your-app-name

# Verify yt-dlp + Deno inside container
heroku run "yt-dlp --version && deno --version" -a your-app-name

# Check dyno status
heroku ps -a your-app-name
```

---

## Heroku Dyno Pricing

| Dyno | RAM | Cost | Uptime |
|---|---|---|---|
| Eco | 512 MB | $5/mo | **Sleeps after 30 min idle** ← WhatsApp drops |
| **Basic** | 512 MB | **$7/mo** | **Always on** ✅ Recommended |
| Standard-1X | 512 MB | $25/mo | Always on + metrics |
| Standard-2X | 1 GB | $50/mo | Best for heavy download load |

> Use **Basic ($7/month)** — Eco sleeps and kills the WhatsApp connection.

---

## Important Notes

### Ephemeral Filesystem
Heroku dynos have a **temporary disk** — everything written to disk is lost on restart.  
This bot handles it correctly:
- ✅ WhatsApp session → MongoDB (`mongoAuthState.js`)  
- ✅ Settings / groups / notes → MongoDB  
- ✅ `temp/` → ffmpeg scratch files, safe to lose  

### PORT
Heroku assigns a random port via `$PORT`. The bot already reads `process.env.PORT`. ✅

---

## Troubleshooting

| Problem | Fix |
|---|---|
| **"Use pnpm instead"** build error | You pushed the repo root instead of the subfolder — use Method A or B |
| **"Node.js app detected"** (not Docker) | `heroku stack:set container` wasn't run, OR `heroku.yml` not at root — use Method A |
| `[DB] ⚠️ MONGODB_PASSWORD not set` | `MONGODB_URI` config var is empty on Heroku |
| Dashboard shows "Application Error" | `heroku logs --tail` — usually a missing env var |
| WhatsApp disconnects every day | Eco dyno sleeping — upgrade to Basic |
| GitHub Actions fails: `No such app` | Check `HEROKU_APP_NAME` secret matches exactly |
| GitHub Actions fails: `Unauthorized` | Check `HEROKU_API_KEY` secret is correct |
| `git subtree push` rejected | Use the force-push variant shown in Method B |

---

## Quick Checklist ✅

- [ ] Oracle ADB created → `MONGODB_URI` string ready
- [ ] Heroku app created (dashboard.heroku.com)
- [ ] Heroku Config Vars set (`MONGODB_URI` + `SESSION_SECRET`)
- [ ] **Method A**: GitHub secrets set (`HEROKU_API_KEY`, `HEROKU_APP_NAME`, `HEROKU_EMAIL`) → push to trigger
- [ ] Heroku logs show `✨ AA MD Bot is ready!`
- [ ] Dashboard open → WhatsApp paired
- [ ] Dyno type set to **Basic** (not Eco)
