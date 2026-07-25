#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
#  AA MD Bot — Oracle Cloud VM Deploy Script
#  Bot + MongoDB SAME VM — Oracle 43 GB storage use karta hai
#
#  Fresh Ubuntu 22.04 VM par ek hi baar chalao:
#  bash <(curl -fsSL https://raw.githubusercontent.com/ahsanaliwadani/AA-MD-Bot/main/AA-MD-Bot/deploy/setup.sh)
# ══════════════════════════════════════════════════════════════

set -euo pipefail

REPO_URL="https://github.com/ahsanaliwadani/AA-MD-Bot.git"
REPO_CLONE_DIR="/home/ubuntu/AA-MD-Bot-repo"   # git clone yahan hoga
BOT_DIR="$REPO_CLONE_DIR/AA-MD-Bot"             # actual bot — package.json yahan
NODE_VERSION="20"

G='\033[0;32m'; C='\033[0;36m'; Y='\033[1;33m'; B='\033[1m'; R='\033[0m'; RE='\033[0;31m'
ok()   { echo -e "${G}✔  $*${R}"; }
inf()  { echo -e "${C}▶  $*${R}"; }
hdr()  { echo -e "\n${B}${C}── $* ──${R}"; }
fail() { echo -e "${RE}❌  $*${R}"; exit 1; }

clear
echo -e "${B}${C}"
echo "╔══════════════════════════════════════════════╗"
echo "║      AA MD Bot — Oracle VM Auto Deploy       ║"
echo "║   Bot + MongoDB — same VM, fully automatic   ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${R}"
inf "Koi input nahi chahiye — sab kuch apne aap hoga..."
echo ""

# ── 1. System update ─────────────────────────────────────────
hdr "1. System Update"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -yq
ok "System updated"

# ── 2. System tools ──────────────────────────────────────────
hdr "2. System Tools"
sudo apt-get install -yq \
  ffmpeg curl wget git unzip gnupg \
  build-essential ca-certificates openssl
ok "System tools ready"

# ── 3. MongoDB 7 — same VM, local storage ────────────────────
hdr "3. MongoDB 7 (local — same VM)"
if ! command -v mongod &>/dev/null; then
  inf "MongoDB install ho raha hai..."
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc \
    | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
    | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
  sudo apt-get update -qq
  sudo apt-get install -y mongodb-org
  ok "MongoDB installed"
else
  ok "MongoDB already installed"
fi

# MongoDB data Oracle VM ki local disk par store hoga (/var/lib/mongodb)
# Enable + start
sudo systemctl enable mongod
sudo systemctl start mongod
sleep 3

# Wait for mongod to be ready
for i in {1..10}; do
  mongosh --quiet --eval "db.runCommand({ping:1})" &>/dev/null && break
  sleep 2
done
ok "MongoDB running (data: /var/lib/mongodb)"

# ── 4. MongoDB user + database ───────────────────────────────
hdr "4. MongoDB — Bot User Setup"

# Generate strong random password
DB_PASS=$(openssl rand -hex 20)

# Check if user already exists
EXISTING=$(mongosh --quiet aa_md_bot --eval \
  "db.getUser('aa_bot_user') ? 'yes' : 'no'" 2>/dev/null || echo "no")

if [ "$EXISTING" = "yes" ]; then
  inf "Bot user already exist karta hai — password reset ho raha hai..."
  mongosh --quiet aa_md_bot --eval \
    "db.updateUser('aa_bot_user', {pwd: '${DB_PASS}'})" &>/dev/null
  ok "Bot user password updated"
else
  mongosh --quiet aa_md_bot --eval "
    db.createUser({
      user: 'aa_bot_user',
      pwd:  '${DB_PASS}',
      roles: [{ role: 'readWrite', db: 'aa_md_bot' }]
    })" &>/dev/null
  ok "Bot user 'aa_bot_user' created"
fi

# Enable MongoDB auth (so user/pass required to connect)
sudo tee /etc/mongod.conf > /dev/null << 'MONGOCFG'
# AA MD Bot — MongoDB config
storage:
  dbPath: /var/lib/mongodb

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

net:
  port: 27017
  bindIp: 127.0.0.1        # Only localhost — bot same VM par hai, public expose nahi

processManagement:
  timeZoneInfo: /usr/share/zoneinfo

security:
  authorization: enabled    # User/pass required
MONGOCFG

sudo systemctl restart mongod
sleep 3
ok "MongoDB auth enabled (localhost only)"

# ── 5. Node.js 20 ────────────────────────────────────────────
hdr "5. Node.js ${NODE_VERSION}"
if node --version 2>/dev/null | grep -q "^v${NODE_VERSION}"; then
  ok "Node.js $(node --version) already installed"
else
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash - >/dev/null 2>&1
  sudo apt-get install -yq nodejs
  ok "Node.js $(node --version) installed"
fi

# ── 6. yt-dlp ────────────────────────────────────────────────
hdr "6. yt-dlp"
sudo curl -sSL \
  https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
ok "yt-dlp ready"

# ── 7. Deno ──────────────────────────────────────────────────
hdr "7. Deno (YouTube downloads)"
if ! command -v deno &>/dev/null; then
  export DENO_INSTALL="/home/ubuntu/.deno"
  curl -fsSL https://deno.land/install.sh | sh >/dev/null 2>&1
  {
    echo 'export DENO_INSTALL="/home/ubuntu/.deno"'
    echo 'export PATH="$DENO_INSTALL/bin:$PATH"'
  } >> /home/ubuntu/.bashrc
  export PATH="/home/ubuntu/.deno/bin:$PATH"
  ok "Deno installed"
else
  ok "Deno already installed ($(deno --version | head -1))"
fi

# ── 8. PM2 ───────────────────────────────────────────────────
hdr "8. PM2"
sudo npm install -g pm2 --registry=https://registry.npmjs.org/ >/dev/null 2>&1
ok "PM2 $(pm2 --version) installed"

# ── 9. Bot code ──────────────────────────────────────────────
hdr "9. Bot Code"
if [ -d "$REPO_CLONE_DIR/.git" ]; then
  inf "Repo update ho raha hai..."
  cd "$REPO_CLONE_DIR" && git pull
  ok "Code updated"
else
  git clone "$REPO_URL" "$REPO_CLONE_DIR"
  ok "Code cloned"
fi

# Verify package.json exists in expected subdirectory
if [ ! -f "$BOT_DIR/package.json" ]; then
  fail "package.json nahi mila: $BOT_DIR\nExpected: $REPO_CLONE_DIR/AA-MD-Bot/package.json\nCheck: ls $REPO_CLONE_DIR/"
fi

# ── 10. npm install (public registry) ────────────────────────
hdr "10. Node.js Packages"
cd "$BOT_DIR"
npm install --omit=dev --registry=https://registry.npmjs.org/ --silent
ok "Packages installed"

# ── 11. Directories ──────────────────────────────────────────
mkdir -p "$BOT_DIR"/{logs,temp,session,downloads,database,cache}
ok "Bot directories ready"

# ── 12. .env — auto write ────────────────────────────────────
hdr "12. .env Configuration"
SESSION_SECRET=$(openssl rand -hex 32)

# MongoDB URI — localhost (same VM)
MONGODB_URI="mongodb://aa_bot_user:${DB_PASS}@127.0.0.1:27017/aa_md_bot?authSource=aa_md_bot"

cat > "$BOT_DIR/.env" << EOF
# ── AA MD Bot — Auto-generated on $(date '+%Y-%m-%d %H:%M:%S') ──
PORT=5000
SERVER_ID=server-1

# Database — MongoDB on this VM (auto-configured)
MONGODB_URI=${MONGODB_URI}

# Security — auto-generated
SESSION_SECRET=${SESSION_SECRET}

# ── Optional — fill in later if needed ────────────────────────
# TELEGRAM_BOT_TOKEN=          # get from @BotFather
# TELEGRAM_FEATURES_BOT_TOKEN= # second bot from @BotFather
# OPENWEATHER_API_KEY=         # openweathermap.org
# OMDB_API_KEY=                # omdbapi.com
# RAPIDAPI_KEY=                # rapidapi.com
# OCR_SPACE_KEY=               # ocr.space
# HF_TOKEN=                    # huggingface.co
# TENOR_API_KEY=               # developers.google.com/tenor
EOF

ok ".env auto-written — koi manual step nahi tha"

# ── 13. Firewall ─────────────────────────────────────────────
hdr "13. Firewall"
sudo ufw default deny incoming  >/dev/null
sudo ufw default allow outgoing >/dev/null
sudo ufw allow OpenSSH          >/dev/null
sudo ufw allow 5000/tcp         >/dev/null
# Port 27017 NOT opened — MongoDB localhost only
sudo ufw --force enable         >/dev/null
ok "Firewall: SSH + 5000 open, MongoDB internal only"

# ── 14. PM2 start ────────────────────────────────────────────
hdr "14. Bot Start"
cd "$BOT_DIR"
pm2 delete aa-md-bot 2>/dev/null || true
pm2 start ecosystem.config.cjs
PM2_CMD=$(pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>&1 | grep "sudo env" || true)
[ -n "$PM2_CMD" ] && eval "$PM2_CMD" >/dev/null 2>&1 || true
pm2 save >/dev/null 2>&1
ok "Bot started + auto-restart enabled"

# ── Done ─────────────────────────────────────────────────────
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo -e "${G}${B}"
echo "╔══════════════════════════════════════════════╗"
echo "║             ✅  Deploy Complete!             ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${R}"
echo -e "  Dashboard  : ${C}http://${PUBLIC_IP}:5000${R}"
echo ""
echo -e "  ${B}MongoDB (local):${R}"
echo -e "    Data path : /var/lib/mongodb"
echo -e "    URI       : ${C}${MONGODB_URI}${R}"
echo ""
echo -e "  ${B}Bot directory:${R} ${C}$BOT_DIR${R}"
echo ""
echo -e "  ${B}Useful commands:${R}"
echo "    pm2 logs aa-md-bot       ← live logs"
echo "    pm2 status               ← bot status"
echo "    pm2 restart aa-md-bot    ← restart"
echo "    sudo systemctl status mongod ← MongoDB status"
echo ""
echo -e "  ${B}WhatsApp connect:${R}"
echo -e "  Browser: ${C}http://${PUBLIC_IP}:5000${R}"
echo "  Pairing code enter karo → WhatsApp link karo"
echo ""
echo -e "  ${Y}⚠  MONGODB URI save kar lo (upar diya hua hai)${R}"
echo -e "  ${Y}   Ye .env mein already write ho gaya hai.${R}"
echo ""
