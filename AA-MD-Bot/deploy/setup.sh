#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  AA MD Bot — Oracle Cloud Ubuntu 22.04 ARM64 Auto-Deploy Script
#  Bot + MongoDB + Nginx + Let's Encrypt — SAME VM, fully automatic
#
#  Fresh VM par ek hi baar chalao (ya dobara bhi — idempotent hai):
#  bash <(curl -fsSL https://raw.githubusercontent.com/ahsanaliwadani/AA-MD-Bot/main/AA-MD-Bot/deploy/setup.sh)
#
#  Features:
#   ✔ Oracle ARM64 (Ampere) compatible — koi x86 package nahi
#   ✔ Idempotent — safely re-run on existing deployment
#   ✔ MongoDB 7 local — localhost only, auth enabled
#   ✔ Nginx reverse proxy + Let's Encrypt HTTPS (nip.io domain)
#   ✔ Oracle iptables REJECT fix — ports 80/443/5000 auto-opened
#   ✔ UFW firewall configured automatically
#   ✔ PM2 with systemd startup
#   ✔ Auto-detects bot directory (handles nested repo structures)
#   ✔ .env merge — never overwrites user's custom values
#   ✔ redeploy.sh generated for future updates
#   ✔ Fully unattended — only optional Telegram tokens asked
# ══════════════════════════════════════════════════════════════════════════════

set -Eeuo pipefail

# ── Script-level error trap ───────────────────────────────────────────────────
trap 'STEP_ERR=$?; echo -e "\n${RE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}"; \
  echo -e "${RE}❌  Unexpected error at line ${BASH_LINENO[0]} (exit code: $STEP_ERR)${R}"; \
  echo -e "${RE}    Last command: ${BASH_COMMAND}${R}"; \
  echo -e "${RE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}\n"; exit $STEP_ERR' ERR

# ── Constants ─────────────────────────────────────────────────────────────────
REPO_URL="https://github.com/ahsanaliwadani/AA-MD-Bot.git"
REPO_CLONE_DIR="/home/ubuntu/AA-MD-Bot-repo"   # git clone yahan hoga
NODE_VERSION="20"
PM2_APP_NAME="aa-md-bot"
NPM_REGISTRY="https://registry.npmjs.org/"
DEPLOY_LOG="/tmp/aa-md-bot-deploy.log"   # default: always writable
SCRIPT_START=$(date +%s)

# ── Colours ───────────────────────────────────────────────────────────────────
G='\033[0;32m'   # green
C='\033[0;36m'   # cyan
Y='\033[1;33m'   # yellow
B='\033[1m'      # bold
R='\033[0m'      # reset
RE='\033[0;31m'  # red
DIM='\033[2m'    # dim

# ── Logging helpers ───────────────────────────────────────────────────────────
_ts()   { date '+%H:%M:%S'; }
ok()    { echo -e "${G}✔  $*${R}";            echo "[OK]  $*" >> "$DEPLOY_LOG" 2>/dev/null || true; }
inf()   { echo -e "${C}▶  $*${R}";            echo "[INF] $*" >> "$DEPLOY_LOG" 2>/dev/null || true; }
warn()  { echo -e "${Y}⚠  $*${R}";            echo "[WRN] $*" >> "$DEPLOY_LOG" 2>/dev/null || true; }
fail()  { echo -e "${RE}❌  $*${R}"; exit 1;  }
hdr()   { echo -e "\n${B}${C}━━━  $*  ━━━${R}${DIM} ($(_ts))${R}"; \
           echo "--- $* ---" >> "$DEPLOY_LOG" 2>/dev/null || true; }
elapsed() { echo $(( $(date +%s) - SCRIPT_START )); }

# Initialise deploy log (always /tmp — no root needed)
echo "=== AA MD Bot Deploy $(date) ===" >> "$DEPLOY_LOG"

# ── Architecture guard ────────────────────────────────────────────────────────
ARCH=$(uname -m)  # aarch64 on Oracle ARM, x86_64 on Intel
inf "Architecture detected: $ARCH"
[[ "$ARCH" == "aarch64" || "$ARCH" == "x86_64" ]] || fail "Unsupported architecture: $ARCH"

clear
echo -e "${B}${C}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║        AA MD Bot — Oracle Cloud ARM64 Auto Deploy        ║"
echo "║   Bot + MongoDB + Nginx + HTTPS — same VM, automatic     ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${R}"
echo -e "  ${DIM}Architecture : $ARCH${R}"
echo -e "  ${DIM}User         : $(whoami)${R}"
echo -e "  ${DIM}Log          : $DEPLOY_LOG${R}"
echo ""
inf "Koi input nahi chahiye — sab kuch apne aap hoga..."
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 — System Update
# ══════════════════════════════════════════════════════════════════════════════
hdr "1. System Update"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -yq \
     -o Dpkg::Options::="--force-confdef" \
     -o Dpkg::Options::="--force-confold"
ok "System packages updated"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Essential System Tools
# ══════════════════════════════════════════════════════════════════════════════
hdr "2. System Tools"
sudo DEBIAN_FRONTEND=noninteractive apt-get install -yq \
  ffmpeg curl wget git unzip gnupg \
  build-essential ca-certificates openssl \
  nginx certbot python3-certbot-nginx \
  iptables-persistent netfilter-persistent \
  software-properties-common apt-transport-https
ok "System tools + nginx + certbot + iptables-persistent ready"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — MongoDB 7 (ARM64-compatible, localhost only)
# ══════════════════════════════════════════════════════════════════════════════
hdr "3. MongoDB 7 (local — $ARCH)"
if ! command -v mongod &>/dev/null; then
  inf "MongoDB 7 install ho raha hai ($ARCH)..."
  # Keyring
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc \
    | sudo gpg --batch --yes -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

  # Both amd64 and arm64 supported by MongoDB 7 official repo
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
    | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list > /dev/null

  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y mongodb-org
  ok "MongoDB 7 installed"
else
  ok "MongoDB already installed — skipping ($(mongod --version 2>/dev/null | head -1 || echo 'unknown version'))"
fi

# MongoDB config — localhost only, auth enabled, WAL storage engine
sudo tee /etc/mongod.conf > /dev/null << 'MONGOCFG'
# AA MD Bot — MongoDB Configuration
# Binds ONLY to localhost — never exposed to internet
storage:
  dbPath: /var/lib/mongodb
  wiredTiger:
    engineConfig:
      journalCompressor: snappy

systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

net:
  port: 27017
  bindIp: 127.0.0.1        # localhost only — bot same VM par hai

processManagement:
  timeZoneInfo: /usr/share/zoneinfo

security:
  authorization: enabled    # username/password required

operationProfiling:
  mode: slowOp
  slowOpThresholdMs: 500
MONGOCFG

sudo systemctl enable mongod
sudo systemctl restart mongod

# Wait for mongod to be ready (up to 30s)
inf "MongoDB start hone ka wait kar rahe hain..."
for i in $(seq 1 15); do
  mongosh --quiet --eval "db.runCommand({ping:1})" &>/dev/null && break
  [[ $i -eq 15 ]] && fail "MongoDB 30 seconds mein start nahi hua"
  sleep 2
done
ok "MongoDB running (data: /var/lib/mongodb)"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 — MongoDB User + Database
# ══════════════════════════════════════════════════════════════════════════════
hdr "4. MongoDB User Setup"

# Strong random password (32 hex = 64 chars)
DB_PASS=$(openssl rand -hex 32)

# First restart mongod WITHOUT auth to create/update user (auth restart done after)
# Temporarily disable auth to manage users
sudo tee /tmp/mongod-noauth.conf > /dev/null << 'NOAUTHCFG'
storage:
  dbPath: /var/lib/mongodb
net:
  port: 27017
  bindIp: 127.0.0.1
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log
processManagement:
  timeZoneInfo: /usr/share/zoneinfo
NOAUTHCFG

sudo systemctl stop mongod
sudo mongod --config /tmp/mongod-noauth.conf --fork \
  --logpath /var/log/mongodb/setup.log &>/dev/null || true
sleep 3

# Check if user already exists
EXISTING=$(mongosh --quiet aa_md_bot --eval \
  "db.getUser('aa_bot_user') ? 'yes' : 'no'" 2>/dev/null || echo "no")

if [ "$EXISTING" = "yes" ]; then
  inf "Bot user already exist karta hai — password update ho raha hai..."
  mongosh --quiet aa_md_bot --eval \
    "db.updateUser('aa_bot_user', {pwd: '${DB_PASS}', \
     roles: [{role:'readWrite',db:'aa_md_bot'}]})" &>/dev/null
  ok "MongoDB user password updated"
else
  inf "MongoDB bot user create ho raha hai..."
  mongosh --quiet aa_md_bot --eval "
    db.createUser({
      user: 'aa_bot_user',
      pwd:  '${DB_PASS}',
      roles: [{ role: 'readWrite', db: 'aa_md_bot' }]
    })" &>/dev/null
  ok "MongoDB user 'aa_bot_user' created"
fi

# Stop temp mongod, restore auth config, start via systemd
sudo pkill -f "mongod --config /tmp/mongod-noauth" 2>/dev/null || true
sleep 2
sudo systemctl start mongod
sleep 3

# Verify auth works
VERIFY=$(mongosh --quiet \
  "mongodb://aa_bot_user:${DB_PASS}@127.0.0.1:27017/aa_md_bot?authSource=aa_md_bot" \
  --eval "db.runCommand({ping:1}).ok" 2>/dev/null || echo "0")
[[ "$VERIFY" == "1" ]] && ok "MongoDB auth verified ✔" \
  || warn "MongoDB auth verification failed — check manually"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 5 — Node.js 20
# ══════════════════════════════════════════════════════════════════════════════
hdr "5. Node.js ${NODE_VERSION}"
_current_node=$(node --version 2>/dev/null || echo "none")
if echo "$_current_node" | grep -q "^v${NODE_VERSION}"; then
  ok "Node.js $_current_node already installed"
else
  inf "Node.js $NODE_VERSION install ho raha hai..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" \
    | sudo -E bash - >/dev/null 2>&1
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -yq nodejs
  ok "Node.js $(node --version) installed"
fi

# Ensure npm is up-to-date
npm install -g npm@latest --registry="$NPM_REGISTRY" --silent 2>/dev/null || true

# ══════════════════════════════════════════════════════════════════════════════
# STEP 6 — yt-dlp (ARM64 aware — uses the universal Python binary)
# ══════════════════════════════════════════════════════════════════════════════
hdr "6. yt-dlp"
# yt-dlp_linux is x86 only. For ARM64 we install via pip (universal).
# For x86_64 we can use the prebuilt binary directly.
if [[ "$ARCH" == "aarch64" ]]; then
  inf "ARM64 detected — installing yt-dlp via pip (universal)..."
  sudo apt-get install -yq python3-pip python3-venv >/dev/null 2>&1
  sudo pip3 install --break-system-packages -U yt-dlp 2>/dev/null \
    || sudo pip3 install -U yt-dlp 2>/dev/null \
    || { sudo apt-get install -yq python3-pip; sudo pip3 install -U yt-dlp; }
  # Ensure it's on PATH for ubuntu user
  YT_DLP_PATH=$(which yt-dlp 2>/dev/null || echo "/usr/local/bin/yt-dlp")
  if [ ! -f /usr/local/bin/yt-dlp ] && [ -f "$YT_DLP_PATH" ]; then
    sudo ln -sf "$YT_DLP_PATH" /usr/local/bin/yt-dlp
  fi
else
  inf "x86_64 detected — installing yt-dlp prebuilt binary..."
  sudo curl -sSL \
    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" \
    -o /usr/local/bin/yt-dlp
fi
sudo chmod a+rx /usr/local/bin/yt-dlp
ok "yt-dlp ready ($(yt-dlp --version 2>/dev/null || echo 'installed'))"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 7 — Deno (ARM64 aware)
# ══════════════════════════════════════════════════════════════════════════════
hdr "7. Deno (YouTube n-challenge / nsig)"
DENO_INSTALL_DIR="/home/ubuntu/.deno"
DENO_BIN="$DENO_INSTALL_DIR/bin/deno"

_install_deno() {
  inf "Deno install ho raha hai ($ARCH)..."
  export DENO_INSTALL="$DENO_INSTALL_DIR"
  mkdir -p "$DENO_INSTALL_DIR/bin"

  if [[ "$ARCH" == "aarch64" ]]; then
    # ARM64 binary from official releases
    _deno_url="https://github.com/denoland/deno/releases/latest/download/deno-aarch64-unknown-linux-gnu.zip"
  else
    _deno_url="https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip"
  fi

  curl -fsSL "$_deno_url" -o /tmp/deno.zip
  unzip -o /tmp/deno.zip -d "$DENO_INSTALL_DIR/bin/" >/dev/null
  chmod +x "$DENO_BIN"
  rm -f /tmp/deno.zip
}

if command -v deno &>/dev/null; then
  ok "Deno already installed ($(deno --version 2>/dev/null | head -1))"
else
  _install_deno
  ok "Deno installed ($(deno --version 2>/dev/null | head -1 || echo 'installed'))"
fi

# Ensure Deno is in PATH for ubuntu user
_deno_bashrc_line='export PATH="$HOME/.deno/bin:$PATH"'
grep -qF "$_deno_bashrc_line" /home/ubuntu/.bashrc 2>/dev/null \
  || echo "$_deno_bashrc_line" >> /home/ubuntu/.bashrc
export PATH="$DENO_INSTALL_DIR/bin:$PATH"

# Also make deno available system-wide via symlink
if [ -f "$DENO_BIN" ] && [ ! -f /usr/local/bin/deno ]; then
  sudo ln -sf "$DENO_BIN" /usr/local/bin/deno
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 8 — PM2 (install or update)
# ══════════════════════════════════════════════════════════════════════════════
hdr "8. PM2 (Process Manager)"
if command -v pm2 &>/dev/null; then
  inf "PM2 already installed — updating to latest..."
  sudo npm install -g pm2@latest --registry="$NPM_REGISTRY" --silent 2>/dev/null || true
else
  inf "PM2 install ho raha hai..."
  sudo npm install -g pm2@latest --registry="$NPM_REGISTRY" --silent
fi
ok "PM2 $(pm2 --version 2>/dev/null || echo 'installed') ready"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 9 — Bot Code (git pull or clone)
# ══════════════════════════════════════════════════════════════════════════════
hdr "9. Bot Code"
if [ -d "$REPO_CLONE_DIR/.git" ]; then
  inf "Repository already exists — git pull kar rahe hain..."
  cd "$REPO_CLONE_DIR"
  # Reset any local changes that might block pull
  git fetch --all --quiet
  git reset --hard "origin/$(git rev-parse --abbrev-ref HEAD)" --quiet
  git pull --ff-only --quiet
  ok "Code updated ($(git log -1 --format='%h %s' 2>/dev/null || echo 'latest'))"
else
  inf "Repository clone ho raha hai..."
  git clone "$REPO_URL" "$REPO_CLONE_DIR"
  ok "Code cloned successfully"
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 10 — Auto-detect Bot Directory
# package.json sometimes at:  AA-MD-Bot/package.json
# and sometimes at:           AA-MD-Bot/AA-MD-Bot/package.json
# ══════════════════════════════════════════════════════════════════════════════
hdr "10. Bot Directory Detection"

BOT_DIR=""

# Priority 1: direct (repo root is the bot)
if [ -f "$REPO_CLONE_DIR/package.json" ]; then
  BOT_DIR="$REPO_CLONE_DIR"
fi

# Priority 2: nested AA-MD-Bot/ subfolder
if [ -z "$BOT_DIR" ] && [ -f "$REPO_CLONE_DIR/AA-MD-Bot/package.json" ]; then
  BOT_DIR="$REPO_CLONE_DIR/AA-MD-Bot"
fi

# Priority 3: double-nested AA-MD-Bot/AA-MD-Bot/
if [ -z "$BOT_DIR" ] && [ -f "$REPO_CLONE_DIR/AA-MD-Bot/AA-MD-Bot/package.json" ]; then
  BOT_DIR="$REPO_CLONE_DIR/AA-MD-Bot/AA-MD-Bot"
fi

# Fallback: find the first package.json anywhere in the repo
if [ -z "$BOT_DIR" ]; then
  _found=$(find "$REPO_CLONE_DIR" -maxdepth 4 -name "package.json" \
            ! -path "*/node_modules/*" | head -1)
  if [ -n "$_found" ]; then
    BOT_DIR="$(dirname "$_found")"
    warn "package.json auto-detected at: $BOT_DIR"
  fi
fi

[ -z "$BOT_DIR" ] && fail "package.json kahi bhi nahi mila — repo structure check karo:\n  ls $REPO_CLONE_DIR/"
[ -f "$BOT_DIR/package.json" ] || fail "Bot directory invalid: $BOT_DIR"

ok "Bot directory detected: $BOT_DIR"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 11 — npm install (with registry fix + auto-retry on failure)
# ══════════════════════════════════════════════════════════════════════════════
hdr "11. Node.js Packages"
cd "$BOT_DIR"

# Set npm registry explicitly
npm config set registry "$NPM_REGISTRY"
ok "npm registry set: $NPM_REGISTRY"

_npm_install() {
  npm install --omit=dev \
    --registry="$NPM_REGISTRY" \
    --no-audit \
    --no-fund \
    --prefer-offline \
    --silent
}

inf "npm install running..."
if ! _npm_install; then
  warn "npm install failed — node_modules + package-lock.json hata ke retry ho raha hai..."
  rm -rf node_modules package-lock.json
  # Try without --prefer-offline on retry
  npm install --omit=dev \
    --registry="$NPM_REGISTRY" \
    --no-audit \
    --no-fund \
    --silent \
  || fail "npm install second attempt bhi fail hua — logs check karo"
fi
ok "Node.js packages installed"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 12 — Required Bot Directories
# ══════════════════════════════════════════════════════════════════════════════
hdr "12. Bot Directories"
mkdir -p "$BOT_DIR"/{logs,temp,session,downloads,database,cache}
sudo chown -R ubuntu:ubuntu "$BOT_DIR"
ok "Bot directories ready: logs temp session downloads database cache"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 13 — Public IP + Domain
# ══════════════════════════════════════════════════════════════════════════════
hdr "13. Public IP + Domain"
PUBLIC_IP=$(curl -s --max-time 10 ifconfig.me 2>/dev/null \
  || curl -s --max-time 10 api.ipify.org 2>/dev/null \
  || curl -s --max-time 10 checkip.amazonaws.com 2>/dev/null \
  || hostname -I | awk '{print $1}')
PUBLIC_IP="${PUBLIC_IP// /}"  # trim whitespace

[[ -z "$PUBLIC_IP" ]] && fail "Public IP detect nahi hua — network check karo"
inf "Public IP: $PUBLIC_IP"

# nip.io domain — free wildcard DNS, no DNS config needed
DOMAIN="${PUBLIC_IP//./-}.nip.io"
inf "Domain: $DOMAIN (nip.io — no DNS config needed)"
ok "IP=$PUBLIC_IP  DOMAIN=$DOMAIN"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 14 — .env Configuration (merge — never overwrite user values)
# ══════════════════════════════════════════════════════════════════════════════
hdr "14. .env Configuration"

# MongoDB URI — localhost, auth-enabled
MONGODB_URI="mongodb://aa_bot_user:${DB_PASS}@127.0.0.1:27017/aa_md_bot?authSource=aa_md_bot"

# Helper: add a key=value to .env only if key doesn't already exist
_env_merge() {
  local KEY="$1" VALUE="$2" ENVFILE="$3"
  if grep -q "^${KEY}=" "$ENVFILE" 2>/dev/null; then
    inf ".env: $KEY already set — skip kiya"
  else
    echo "${KEY}=${VALUE}" >> "$ENVFILE"
    ok ".env: $KEY added"
  fi
}

ENV_FILE="$BOT_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  # Fresh .env — create it
  cat > "$ENV_FILE" << EOF
# ══════════════════════════════════════════════════════════════
#  AA MD Bot — Auto-generated on $(date '+%Y-%m-%d %H:%M:%S')
#  IMPORTANT: MONGODB_URI aur SESSION_SECRET save kar lo!
# ══════════════════════════════════════════════════════════════

# ── Server ────────────────────────────────────────────────────
PORT=5000
SERVER_ID=server-1

# ── Database — MongoDB on this VM (auto-configured) ──────────
MONGODB_URI=${MONGODB_URI}

# ── Security — auto-generated ─────────────────────────────────
SESSION_SECRET=$(openssl rand -hex 32)

# ── Optional — fill in later if needed ────────────────────────
# TELEGRAM_BOT_TOKEN=          # @BotFather se lena
# TELEGRAM_FEATURES_BOT_TOKEN= # second bot from @BotFather
# OPENWEATHER_API_KEY=         # openweathermap.org
# OMDB_API_KEY=                # omdbapi.com
# RAPIDAPI_KEY=                # rapidapi.com
# OCR_SPACE_KEY=               # ocr.space
# HF_TOKEN=                    # huggingface.co
# TENOR_API_KEY=               # developers.google.com/tenor
EOF
  ok ".env freshly created"
else
  ok ".env already exists — merging missing variables only"
  # Merge only keys that are missing
  _env_merge "PORT"           "5000"             "$ENV_FILE"
  _env_merge "SERVER_ID"      "server-1"         "$ENV_FILE"
  _env_merge "MONGODB_URI"    "$MONGODB_URI"     "$ENV_FILE"
  _env_merge "SESSION_SECRET" "$(openssl rand -hex 32)" "$ENV_FILE"
fi

# Optional: Telegram tokens — ask with timeout
echo ""
echo -e "  ${Y}━━━ Optional: Telegram Bot Tokens ━━━${R}"
echo -e "  ${DIM}(30 saniye mein Enter dabao skip karne ke liye)${R}"
echo ""

TELEGRAM_BOT_TOKEN=""
TELEGRAM_FEATURES_BOT_TOKEN=""

if [ -t 0 ]; then
  # Only prompt if running interactively
  read -r -t 30 -p "  TELEGRAM_BOT_TOKEN (Enter to skip): " TELEGRAM_BOT_TOKEN || true
  if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    _env_merge "TELEGRAM_BOT_TOKEN" "$TELEGRAM_BOT_TOKEN" "$ENV_FILE"
    read -r -t 30 -p "  TELEGRAM_FEATURES_BOT_TOKEN (Enter to skip): " TELEGRAM_FEATURES_BOT_TOKEN || true
    [ -n "$TELEGRAM_FEATURES_BOT_TOKEN" ] && \
      _env_merge "TELEGRAM_FEATURES_BOT_TOKEN" "$TELEGRAM_FEATURES_BOT_TOKEN" "$ENV_FILE"
  fi
fi
echo ""
ok ".env configuration complete"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 15 — ecosystem.config.cjs (auto-generate if missing)
# ══════════════════════════════════════════════════════════════════════════════
hdr "15. PM2 Ecosystem Config"
ECOSYSTEM_FILE="$BOT_DIR/ecosystem.config.cjs"

if [ ! -f "$ECOSYSTEM_FILE" ]; then
  inf "ecosystem.config.cjs nahi mila — auto-generate ho raha hai..."
  cat > "$ECOSYSTEM_FILE" << 'ECOSYSTEM'
// AA MD Bot — PM2 Ecosystem Config (auto-generated)
module.exports = {
  apps: [{
    name: 'aa-md-bot',
    script: 'index.js',
    interpreter: 'node',
    interpreter_args: '--experimental-vm-modules',
    env_file: '.env',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    restart_delay: 3000,
    max_restarts: 20,
    min_uptime: '10s',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    env: {
      NODE_ENV: 'production',
    },
  }],
};
ECOSYSTEM
  ok "ecosystem.config.cjs auto-generated"
else
  ok "ecosystem.config.cjs already exists — kept as is"
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 16 — Oracle Cloud iptables Fix
# Oracle images have a REJECT rule that blocks ports 80/443/5000
# We detect the REJECT line number and insert ACCEPT rules BEFORE it
# ══════════════════════════════════════════════════════════════════════════════
hdr "16. Oracle Cloud iptables Fix"

_iptables_allow_port() {
  local PORT="$1" PROTO="${2:-tcp}"
  # Check if ACCEPT rule already exists
  if sudo iptables -C INPUT -p "$PROTO" --dport "$PORT" -j ACCEPT &>/dev/null; then
    inf "iptables: port $PORT already ACCEPT — skip"
    return
  fi

  # Find the REJECT rule line number (insert BEFORE it)
  REJECT_LINE=$(sudo iptables -L INPUT --line-numbers -n 2>/dev/null \
    | grep -E '\bREJECT\b' | awk '{print $1}' | head -1)

  if [ -n "$REJECT_LINE" ]; then
    # Insert ACCEPT before REJECT
    sudo iptables -I INPUT "$REJECT_LINE" -p "$PROTO" --dport "$PORT" -j ACCEPT
    ok "iptables: port $PORT ($PROTO) ACCEPT inserted before REJECT (line $REJECT_LINE)"
  else
    # No REJECT rule — just append
    sudo iptables -A INPUT -p "$PROTO" --dport "$PORT" -j ACCEPT
    ok "iptables: port $PORT ($PROTO) ACCEPT appended"
  fi
}

_iptables_allow_port 22  tcp   # SSH
_iptables_allow_port 80  tcp   # HTTP
_iptables_allow_port 443 tcp   # HTTPS
_iptables_allow_port 5000 tcp  # Dashboard

# Save iptables rules permanently
inf "iptables rules save ho rahi hain (netfilter-persistent)..."
sudo netfilter-persistent save >/dev/null 2>&1 \
  || { sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null; \
       ok "iptables rules saved to /etc/iptables/rules.v4"; }
ok "iptables rules permanently saved"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 17 — UFW Firewall
# Allow SSH/HTTP/HTTPS/5000, block MongoDB from internet
# ══════════════════════════════════════════════════════════════════════════════
hdr "17. UFW Firewall"
sudo ufw --force reset >/dev/null 2>&1 || true  # fresh start
sudo ufw default deny incoming  >/dev/null
sudo ufw default allow outgoing >/dev/null
sudo ufw allow 22/tcp   comment 'SSH'             >/dev/null
sudo ufw allow 80/tcp   comment 'HTTP'            >/dev/null
sudo ufw allow 443/tcp  comment 'HTTPS'           >/dev/null
sudo ufw allow 5000/tcp comment 'AA-MD-Bot dashboard' >/dev/null
# Port 27017 (MongoDB) is intentionally NOT opened — localhost only
sudo ufw --force enable >/dev/null
ok "UFW: SSH(22) HTTP(80) HTTPS(443) Dashboard(5000) open | MongoDB(27017) blocked"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 18 — Nginx Configuration (reverse proxy → 127.0.0.1:5000)
# ══════════════════════════════════════════════════════════════════════════════
hdr "18. Nginx Configuration"

NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${DOMAIN}"

# Remove default site if it conflicts
sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

sudo tee "$NGINX_CONF" > /dev/null << NGINXCONF
# AA MD Bot — Nginx Config for ${DOMAIN}
# Reverse proxy to Node.js dashboard on port 5000
# HTTPS/SSL added by certbot automatically

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy to bot dashboard
    location / {
        proxy_pass         http://127.0.0.1:5000;
        proxy_http_version 1.1;

        # WebSocket support (needed for real-time dashboard)
        proxy_set_header Upgrade    \$http_upgrade;
        proxy_set_header Connection 'upgrade';

        proxy_set_header Host             \$host;
        proxy_set_header X-Real-IP        \$remote_addr;
        proxy_set_header X-Forwarded-For  \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_cache_bypass \$http_upgrade;

        # Timeouts
        proxy_connect_timeout  60s;
        proxy_send_timeout     60s;
        proxy_read_timeout     60s;
    }

    # Large file uploads (media sharing)
    client_max_body_size 200M;
}
NGINXCONF

# Enable site
sudo ln -sf "$NGINX_CONF" "$NGINX_ENABLED"
ok "Nginx site config created: $NGINX_CONF"

# Test config
inf "Nginx config test..."
sudo nginx -t 2>&1 | while IFS= read -r line; do inf "$line"; done
ok "Nginx config valid"

# Reload nginx
sudo systemctl enable nginx >/dev/null
sudo systemctl restart nginx
ok "Nginx running and enabled"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 19 — PM2 Start Bot
# (Start bot BEFORE certbot so certbot can verify port 80)
# ══════════════════════════════════════════════════════════════════════════════
hdr "19. Bot Start (PM2)"
cd "$BOT_DIR"

# Delete existing instance if running (for idempotency)
pm2 delete "$PM2_APP_NAME" 2>/dev/null || true
sleep 1

# Start via ecosystem config
pm2 start "$ECOSYSTEM_FILE"
ok "PM2: bot started"

# PM2 startup (auto-start on reboot)
inf "PM2 systemd startup configure ho raha hai..."
PM2_STARTUP_CMD=$(pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>&1 \
  | grep -E "^sudo " || true)
if [ -n "$PM2_STARTUP_CMD" ]; then
  eval "$PM2_STARTUP_CMD" >/dev/null 2>&1
  ok "PM2 systemd startup registered"
else
  warn "PM2 startup command detect nahi hua — manually check karo: pm2 startup"
fi

# Save PM2 process list
pm2 save >/dev/null 2>&1
ok "PM2 process list saved"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 20 — Wait for Port 5000 (HTTP 200)
# ══════════════════════════════════════════════════════════════════════════════
hdr "20. Waiting for Bot (port 5000)"
inf "Bot ke ready hone ka wait kar rahe hain (max 90s)..."

_PORT_READY=false
for i in $(seq 1 30); do
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
    --max-time 3 http://127.0.0.1:5000/ 2>/dev/null || echo "000")
  if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "301" || "$HTTP_CODE" == "302" ]]; then
    _PORT_READY=true
    ok "Bot ready! HTTP $HTTP_CODE on port 5000 (attempt $i)"
    break
  fi
  inf "Attempt $i/30 — HTTP $HTTP_CODE — 3 seconds wait..."
  sleep 3
done

if [[ "$_PORT_READY" == "false" ]]; then
  warn "Bot 90 seconds mein ready nahi hua — PM2 logs check karo:"
  warn "  pm2 logs $PM2_APP_NAME --lines 50"
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 21 — Let's Encrypt HTTPS (via certbot)
# Uses nip.io domain — no DNS config needed
# If certbot fails, bot still works over HTTP
# ══════════════════════════════════════════════════════════════════════════════
hdr "21. Let's Encrypt HTTPS"
HTTPS_URL=""
CERTBOT_SUCCESS=false

inf "Certbot se HTTPS certificate generate ho raha hai..."
inf "Domain: $DOMAIN"

# Run certbot non-interactively
# --register-unsafely-without-email keeps it fully unattended
if sudo certbot --nginx \
     --non-interactive \
     --agree-tos \
     --register-unsafely-without-email \
     --domains "$DOMAIN" \
     --redirect \
     2>&1 | tee /tmp/certbot-output.log | while IFS= read -r line; do
       inf "certbot: $line"
     done; then

  CERTBOT_SUCCESS=true
  HTTPS_URL="https://${DOMAIN}"
  ok "HTTPS certificate generated ✔"
  ok "HTTP → HTTPS redirect enabled ✔"

  # Auto-renewal (certbot adds a cron/systemd timer automatically)
  # Verify it exists
  if systemctl is-active certbot.timer &>/dev/null 2>&1; then
    ok "Certbot auto-renewal timer active"
  else
    # Fallback: add cron for renewal
    (crontab -l 2>/dev/null | grep -v certbot; \
     echo "0 3 * * * certbot renew --quiet --nginx 2>&1 | logger -t certbot") \
     | crontab -
    ok "Certbot auto-renewal cron added (daily at 3am)"
  fi
else
  CERTBOT_EXIT=$?
  warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  warn "Certbot fail hua (exit code: $CERTBOT_EXIT)"
  warn "Reason:"
  grep -E "(error|Error|fail|Fail)" /tmp/certbot-output.log 2>/dev/null \
    | while IFS= read -r line; do warn "  $line"; done || true
  warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  warn "Bot HTTP par kaam karta rahega: http://${PUBLIC_IP}:5000"
  warn "HTTPS baad mein manually add karo: sudo certbot --nginx -d $DOMAIN"
fi

# Reload nginx after certbot (certbot modifies nginx config)
sudo nginx -t >/dev/null 2>&1 && sudo systemctl reload nginx 2>/dev/null || true

# ══════════════════════════════════════════════════════════════════════════════
# STEP 22 — Generate redeploy.sh
# ══════════════════════════════════════════════════════════════════════════════
hdr "22. redeploy.sh"
REDEPLOY_SCRIPT="/home/ubuntu/redeploy.sh"

cat > "$REDEPLOY_SCRIPT" << REDEPLOY_EOF
#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
#  AA MD Bot — Redeploy Script (auto-generated by setup.sh)
#  Usage: bash ~/redeploy.sh
#  Idempotent — safe to run anytime to update the bot
# ══════════════════════════════════════════════════════════════
set -Eeuo pipefail

# ── Colours ──────────────────────────────────────────────────
G='\033[0;32m'; C='\033[0;36m'; Y='\033[1;33m'; B='\033[1m'; R='\033[0m'; RE='\033[0;31m'
ok()   { echo -e "\${G}✔  \$*\${R}"; }
inf()  { echo -e "\${C}▶  \$*\${R}"; }
warn() { echo -e "\${Y}⚠  \$*\${R}"; }
hdr()  { echo -e "\n\${B}\${C}━━━  \$*  ━━━\${R}"; }

REPO_CLONE_DIR="${REPO_CLONE_DIR}"
NPM_REGISTRY="${NPM_REGISTRY}"
PM2_APP_NAME="${PM2_APP_NAME}"

echo -e "\${B}\${C}"
echo "╔══════════════════════════════════════════════╗"
echo "║       AA MD Bot — Redeploy / Update          ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "\${R}"

# ── 1. Git pull ───────────────────────────────────────────────
hdr "1. Git Pull"
cd "\$REPO_CLONE_DIR"
git fetch --all --quiet
git reset --hard "origin/\$(git rev-parse --abbrev-ref HEAD)" --quiet
git pull --ff-only --quiet
ok "Code updated: \$(git log -1 --format='%h %s')"

# ── 2. Auto-detect bot directory ─────────────────────────────
hdr "2. Bot Directory"
BOT_DIR=""
[ -f "\$REPO_CLONE_DIR/package.json" ]                && BOT_DIR="\$REPO_CLONE_DIR"
[ -z "\$BOT_DIR" ] && [ -f "\$REPO_CLONE_DIR/AA-MD-Bot/package.json" ] \
  && BOT_DIR="\$REPO_CLONE_DIR/AA-MD-Bot"
[ -z "\$BOT_DIR" ] && [ -f "\$REPO_CLONE_DIR/AA-MD-Bot/AA-MD-Bot/package.json" ] \
  && BOT_DIR="\$REPO_CLONE_DIR/AA-MD-Bot/AA-MD-Bot"
[ -z "\$BOT_DIR" ] && {
  _f=\$(find "\$REPO_CLONE_DIR" -maxdepth 4 -name package.json ! -path '*/node_modules/*' | head -1)
  [ -n "\$_f" ] && BOT_DIR="\$(dirname "\$_f")"
}
[ -z "\$BOT_DIR" ] && { echo -e "\${RE}❌ package.json nahi mila\${R}"; exit 1; }
ok "Bot dir: \$BOT_DIR"

# ── 3. npm install (only if package.json changed) ────────────
hdr "3. npm install"
cd "\$BOT_DIR"
npm config set registry "\$NPM_REGISTRY"

# Check if package.json changed since last install
PKG_HASH_FILE="\$BOT_DIR/.npm-install-hash"
CURRENT_HASH=\$(md5sum "\$BOT_DIR/package.json" | awk '{print \$1}')
STORED_HASH=\$(cat "\$PKG_HASH_FILE" 2>/dev/null || echo "")

if [ "\$CURRENT_HASH" = "\$STORED_HASH" ] && [ -d "\$BOT_DIR/node_modules" ]; then
  ok "package.json unchanged — npm install skip kiya"
else
  inf "package.json changed — npm install ho raha hai..."
  if ! npm install --omit=dev --registry="\$NPM_REGISTRY" --no-audit --no-fund --silent; then
    warn "npm install failed — retry kar rahe hain..."
    rm -rf node_modules package-lock.json
    npm install --omit=dev --registry="\$NPM_REGISTRY" --no-audit --no-fund --silent
  fi
  echo "\$CURRENT_HASH" > "\$PKG_HASH_FILE"
  ok "npm install complete"
fi

# ── 4. PM2 restart + save ────────────────────────────────────
hdr "4. PM2 Restart"
pm2 restart "\$PM2_APP_NAME" 2>/dev/null \
  || pm2 start "\$BOT_DIR/ecosystem.config.cjs"
pm2 save >/dev/null 2>&1
ok "Bot restarted"

# ── 5. Show logs ─────────────────────────────────────────────
echo ""
ok "Redeploy complete! Live logs:"
echo ""
pm2 logs "\$PM2_APP_NAME" --lines 30
REDEPLOY_EOF

chmod +x "$REDEPLOY_SCRIPT"
chown ubuntu:ubuntu "$REDEPLOY_SCRIPT"
ok "redeploy.sh created: $REDEPLOY_SCRIPT"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 23 — Final Status Check
# ══════════════════════════════════════════════════════════════════════════════
hdr "23. Final Status"
inf "PM2 status..."
pm2 status 2>/dev/null || true

inf "Nginx status..."
sudo systemctl is-active nginx &>/dev/null && ok "Nginx: running" || warn "Nginx: not running"

inf "MongoDB status..."
sudo systemctl is-active mongod &>/dev/null && ok "MongoDB: running" || warn "MongoDB: not running"

ELAPSED=$(elapsed)

# ══════════════════════════════════════════════════════════════════════════════
# ✅  DEPLOY COMPLETE — Summary
# ══════════════════════════════════════════════════════════════════════════════
HTTP_URL="http://${PUBLIC_IP}:5000"
HTTP_DOMAIN_URL="http://${DOMAIN}"
HTTPS_URL_DISPLAY="${HTTPS_URL:-"(certbot failed — HTTP only)"}"

echo ""
echo -e "${G}${B}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ✅  AA MD Bot — Deploy Complete!            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${R}"

echo -e "  ${B}━━━ Access URLs ━━━${R}"
echo -e "  Direct IP     : ${C}${HTTP_URL}${R}"
echo -e "  HTTP Domain   : ${C}${HTTP_DOMAIN_URL}${R}"
echo -e "  HTTPS         : ${C}${HTTPS_URL_DISPLAY}${R}"
echo ""

echo -e "  ${B}━━━ MongoDB ━━━${R}"
echo -e "  Status        : $(sudo systemctl is-active mongod 2>/dev/null || echo 'unknown')"
echo -e "  Data path     : /var/lib/mongodb"
echo -e "  URI           : ${C}${MONGODB_URI}${R}"
echo ""

echo -e "  ${B}━━━ Bot ━━━${R}"
echo -e "  Directory     : ${C}${BOT_DIR}${R}"
echo -e "  Config        : ${C}${ECOSYSTEM_FILE}${R}"
echo -e "  .env          : ${C}${ENV_FILE}${R}"
echo ""

echo -e "  ${B}━━━ Nginx ━━━${R}"
echo -e "  Status        : $(sudo systemctl is-active nginx 2>/dev/null || echo 'unknown')"
echo -e "  Config        : /etc/nginx/sites-available/${DOMAIN}"
echo ""

echo -e "  ${B}━━━ PM2 Commands ━━━${R}"
echo -e "  ${DIM}pm2 logs ${PM2_APP_NAME}       ${R}← live logs"
echo -e "  ${DIM}pm2 status                 ${R}← all processes"
echo -e "  ${DIM}pm2 restart ${PM2_APP_NAME}    ${R}← restart bot"
echo -e "  ${DIM}pm2 stop ${PM2_APP_NAME}        ${R}← stop bot"
echo ""

echo -e "  ${B}━━━ Other Commands ━━━${R}"
echo -e "  ${DIM}bash ~/redeploy.sh         ${R}← update + restart bot"
echo -e "  ${DIM}sudo systemctl status mongod${R}← MongoDB status"
echo -e "  ${DIM}sudo systemctl status nginx ${R}← Nginx status"
echo -e "  ${DIM}sudo tail -f /var/log/nginx/error.log${R}← Nginx logs"
echo ""

echo -e "  ${B}━━━ WhatsApp Pairing ━━━${R}"
echo -e "  1. Browser mein kholo: ${C}${HTTP_URL}${R}"
echo -e "     ya: ${C}${HTTP_DOMAIN_URL}${R}"
echo -e "  2. Phone number enter karo (with country code, e.g. 923XXXXXXXXX)"
echo -e "  3. ${B}Get Pairing Code${R} click karo"
echo -e "  4. WhatsApp → Settings → Linked Devices → Link with phone number"
echo -e "  5. 8-digit code enter karo — ho gaya ✅"
echo ""

echo -e "  ${Y}⚠  MONGODB URI aur SESSION_SECRET save kar lo!${R}"
echo -e "  ${Y}   Ye .env mein already write ho gaya hai.${R}"
echo -e "  ${DIM}   cat ${ENV_FILE}${R}"
echo ""
echo -e "  ${DIM}Total deploy time: ${ELAPSED}s${R}"
echo ""
