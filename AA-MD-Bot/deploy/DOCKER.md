# 🐳 AA MD Bot — Docker / Railway / VPS Deploy

> Works on any Linux VPS (DigitalOcean, Hetzner, Vultr, AWS, etc.) or Railway.

---

## Option A — Docker (any VPS or local server)

### Prerequisites

- Docker installed: https://docs.docker.com/engine/install/ubuntu/
- A MongoDB URI (Oracle ADB recommended — see [`ORACLE-ADB-GUIDE.md`](ORACLE-ADB-GUIDE.md))

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/AA-MD-Bot.git
cd AA-MD-Bot

# 2. Create your .env
cp .env.example .env
nano .env          # fill in MONGODB_URI, SESSION_SECRET, and optional keys

# 3. Build the image
docker build -t aa-md-bot .

# 4. Run (detached, auto-restart)
docker run -d \
  --name aa-md-bot \
  --restart unless-stopped \
  --env-file .env \
  -p 5000:5000 \
  aa-md-bot
```

### View logs

```bash
docker logs -f aa-md-bot
```

### Restart / update

```bash
# Pull latest code + rebuild
git pull
docker build -t aa-md-bot .
docker stop aa-md-bot && docker rm aa-md-bot
docker run -d --name aa-md-bot --restart unless-stopped --env-file .env -p 5000:5000 aa-md-bot
```

### Open dashboard

`http://YOUR_SERVER_IP:5000` — pair WhatsApp here.

---

## Option B — Docker Compose

Create `docker-compose.yml` next to the repo:

```yaml
version: "3.9"
services:
  aa-md-bot:
    build: .
    restart: unless-stopped
    ports:
      - "5000:5000"
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
```

```bash
docker compose up -d
docker compose logs -f
```

---

## Option C — Railway

Railway auto-detects the `Dockerfile` in the root.

1. **Fork** this repo to your GitHub account
2. Go to **https://railway.app** → **New Project** → **Deploy from GitHub repo**
3. Select your forked repo → Railway builds automatically
4. Go to **Variables** tab → add all env vars from `.env.example`
5. Railway assigns a public URL — open it to access the dashboard
6. Pair your WhatsApp number via the dashboard

> Railway free tier: 500 hours/month. Sufficient for testing; use Oracle Cloud for 24/7 production.

---

## Option D — Plain VPS (no Docker, Ubuntu 22.04)

Use the automated setup script (same as Oracle Cloud guide):

```bash
# One command installs everything: Node 20, ffmpeg, yt-dlp, Deno, PM2
bash <(curl -fsSL https://raw.githubusercontent.com/YOUR_USERNAME/AA-MD-Bot/main/deploy/setup.sh) 1
```

Then edit `.env` and restart:

```bash
nano /home/ubuntu/AA-MD-Bot/.env
pm2 restart aa-md-bot
```

Full guide: [`ORACLE-DEPLOY.md`](ORACLE-DEPLOY.md) (steps apply to any Ubuntu VPS, not just Oracle).

---

## Port / Firewall

The bot dashboard runs on port **5000**. Make sure it is open:

```bash
# UFW (Ubuntu)
sudo ufw allow 5000/tcp

# iptables
sudo iptables -A INPUT -p tcp --dport 5000 -j ACCEPT
```

For cloud providers (AWS, Oracle, Hetzner), also open port 5000 in the web console security group / firewall rules.

---

## Environment Variables

See [`.env.example`](../.env.example) for the full list.  
Minimum required to start:

```env
MONGODB_URI=mongodb://ADMIN:password@...   # Oracle ADB or MongoDB Atlas
SESSION_SECRET=any_random_64_char_string
```

Without `MONGODB_URI` the bot runs with in-memory storage — **data is lost on restart**.
