#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
#  AA MD Bot — Oracle Cloud Ubuntu 22.04 / VPS Setup Script
#
#  Run ONCE on each server after first SSH login:
#
#    Server 1:  bash setup.sh 1
#    Server 2:  bash setup.sh 2
#    Server 3:  bash setup.sh 3
#
#  After running:
#    nano /home/ubuntu/AA-MD-Bot/.env
#    → set MONGODB_URI to your MongoDB connection string
#    → save, then: pm2 restart aa-md-bot
# ══════════════════════════════════════════════════════════════

set -euo pipefail

SERVER_NUM="${1:-1}"
REPO_URL="https://github.com/ahsanaliwadani/AA-MD-Bot.git"
BOT_DIR="/home/ubuntu/AA-MD-Bot"
NODE_VERSION="20"

# ── Colours ───────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
ok()  { echo -e "${GREEN}✔  $*${RESET}"; }
inf() { echo -e "${CYAN}▶  $*${RESET}"; }
war() { echo -e "${YELLOW}⚠  $*${RESET}"; }
hdr() { echo -e "\n${BOLD}${CYAN}── $* ──${RESET}"; }

echo -e "${BOLD}${CYAN}"
echo "╔═══════════════════════════════════════════╗"
echo "║     AA MD Bot — Server ${SERVER_NUM} Setup           ║"
echo "╚═══════════════════════════════════════════╝"
echo -e "${RESET}"

# ── 1. System update ──────────────────────────────────────────
hdr "1. System Update"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -yq
ok "System updated"

# ── 2. System dependencies ────────────────────────────────────
hdr "2. System Dependencies"
sudo apt-get install -yq \
  ffmpeg curl wget git unzip \
  python3 python3-pip \
  build-essential ca-certificates gnupg \
  ufw fail2ban
ok "ffmpeg, git, build tools installed"

# ── 3. Node.js 20 ─────────────────────────────────────────────
hdr "3. Node.js ${NODE_VERSION}"
if node --version 2>/dev/null | grep -q "^v${NODE_VERSION}"; then
  ok "Node.js $(node --version) already installed"
else
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash - >/dev/null 2>&1
  sudo apt-get install -yq nodejs
  ok "Node.js $(node --version) installed"
fi

# ── 4. yt-dlp ─────────────────────────────────────────────────
hdr "4. yt-dlp"
sudo curl -sSL \
  https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
ok "yt-dlp $(yt-dlp --version 2>/dev/null || echo 'installed') ready"

# ── 5. Deno ───────────────────────────────────────────────────
hdr "5. Deno (yt-dlp n-challenge solver)"
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
  ok "Deno already installed"
fi

# ── 6. PM2 ────────────────────────────────────────────────────
hdr "6. PM2 Process Manager"
sudo npm install -g pm2 >/dev/null 2>&1
ok "PM2 $(pm2 --version) installed"

# ── 7. Clone / update repo ────────────────────────────────────
hdr "7. Bot Repository"
if [ -d "$BOT_DIR/.git" ]; then
  inf "Updating existing repo..."
  cd "$BOT_DIR" && git pull
  ok "Repo updated"
else
  inf "Cloning repo..."
  git clone "$REPO_URL" "$BOT_DIR"
  ok "Repo cloned to $BOT_DIR"
fi

# ── 8. Node dependencies ──────────────────────────────────────
hdr "8. Node.js Dependencies"
cd "$BOT_DIR"
npm install --omit=dev --silent
ok "npm packages installed"

# ── 9. Create .env ────────────────────────────────────────────
hdr "9. Environment Config"
if [ ! -f "$BOT_DIR/.env" ]; then
  SESSION_SECRET=$(openssl rand -hex 32)
  cat > "$BOT_DIR/.env" << EOF
# AA MD Bot — Server ${SERVER_NUM}
PORT=5000
SERVER_ID=server-${SERVER_NUM}

# ── Database — FILL THIS IN ───────────────────────────────────
# Self-hosted MongoDB on same VM:
MONGODB_URI=mongodb://aa_bot_user:YourPassword@127.0.0.1:27017/aa_md_bot
# MongoDB on another Oracle VM (replace IP):
# MONGODB_URI=mongodb://aa_bot_user:YourPassword@10.0.0.X:27017/aa_md_bot
# Oracle ADB MongoDB API:
# MONGODB_URI=mongodb://ADMIN:YourPassword@adb-xxxxx.adb.REGION.oraclecloudapps.com:27017/ADMIN?authMechanism=PLAIN&tls=true&tlsAllowInvalidCertificates=true&retryWrites=false&loadBalanced=true

# ── Telegram (optional) ───────────────────────────────────────
TELEGRAM_BOT_TOKEN=
TELEGRAM_FEATURES_BOT_TOKEN=

# ── Optional API Keys ─────────────────────────────────────────
OPENWEATHER_API_KEY=
OMDB_API_KEY=
RAPIDAPI_KEY=
OCR_SPACE_KEY=
HF_TOKEN=
TENOR_API_KEY=

# ── Security ──────────────────────────────────────────────────
SESSION_SECRET=${SESSION_SECRET}
EOF
  ok ".env created"
else
  war ".env already exists — skipping (edit manually)"
fi

# ── 10. Directories ───────────────────────────────────────────
hdr "10. Directories"
mkdir -p "$BOT_DIR/logs" "$BOT_DIR/temp" "$BOT_DIR/session" \
         "$BOT_DIR/downloads" "$BOT_DIR/database" "$BOT_DIR/cache"
ok "All directories ready"

# ── 11. Firewall ──────────────────────────────────────────────
hdr "11. UFW Firewall"
sudo ufw default deny incoming  >/dev/null
sudo ufw default allow outgoing >/dev/null
sudo ufw allow OpenSSH          >/dev/null
sudo ufw allow 5000/tcp         >/dev/null
sudo ufw --force enable         >/dev/null
ok "Firewall active (SSH + port 5000 allowed)"

# ── 12. PM2 startup ───────────────────────────────────────────
hdr "12. PM2 Auto-Start on Reboot"
cd "$BOT_DIR"
pm2 start ecosystem.config.cjs 2>/dev/null || true
PM2_STARTUP=$(pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>&1 | grep "sudo env" || true)
[ -n "$PM2_STARTUP" ] && eval "$PM2_STARTUP" >/dev/null 2>&1 || true
pm2 save >/dev/null 2>&1 || true
ok "PM2 configured for auto-restart on reboot"

# ── Done ──────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}"
echo "╔═══════════════════════════════════════════╗"
echo "║   ✅  Server ${SERVER_NUM} Setup Complete!            ║"
echo "╚═══════════════════════════════════════════╝"
echo -e "${RESET}"

PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo -e "  Dashboard : ${CYAN}http://${PUBLIC_IP}:5000${RESET}"
echo ""
echo -e "${BOLD}  ⚡ Required next step:${RESET}"
echo ""
echo "  Edit .env and set MONGODB_URI:"
echo "    nano $BOT_DIR/.env"
echo ""
echo "  Then restart the bot:"
echo "    pm2 restart aa-md-bot"
echo "    pm2 logs aa-md-bot"
echo ""
echo "  Good startup signs in logs:"
echo "    [DB] ✅ MongoDB loaded"
echo "    ✨ AA MD Bot is ready!"
echo ""
