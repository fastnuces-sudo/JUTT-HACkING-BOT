#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
#  AA MD Bot — Oracle Cloud Ubuntu 22.04 Setup Script
#  Database: Oracle Autonomous Database (cloud-managed, 20 GB free)
#
#  Run ONCE on each VM after first SSH login:
#
#    Server 1:  bash setup.sh 1
#    Server 2:  bash setup.sh 2
#    Server 3:  bash setup.sh 3
#
#  After running: edit .env to add your MONGODB_URI from Oracle ADB
#  Full guide: deploy/ORACLE-ADB-GUIDE.md
# ══════════════════════════════════════════════════════════════

set -euo pipefail

SERVER_NUM="${1:-1}"
REPO_URL="https://github.com/YOUR_USERNAME/AA-MD-Bot.git"   # ← update this
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
echo "╔══════════════════════════════════════════╗"
echo "║    AA MD Bot — Oracle Cloud Setup        ║"
echo "║    Server ${SERVER_NUM}  |  DB: Oracle ADB (cloud)  ║"
echo "╚══════════════════════════════════════════╝"
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
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash - > /dev/null 2>&1
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
  curl -fsSL https://deno.land/install.sh | sh > /dev/null 2>&1
  {
    echo 'export DENO_INSTALL="/home/ubuntu/.deno"'
    echo 'export PATH="$DENO_INSTALL/bin:$PATH"'
  } >> /home/ubuntu/.bashrc
  export PATH="/home/ubuntu/.deno/bin:$PATH"
fi
ok "Deno ready"

# ── 6. PM2 ────────────────────────────────────────────────────
hdr "6. PM2 Process Manager"
sudo npm install -g pm2 > /dev/null 2>&1
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

# ── Oracle Autonomous Database (FILL THIS IN) ─────────────────
# Get from: Oracle Cloud Console → ADB → Database connection → MongoDB API
# Full guide: deploy/ORACLE-ADB-GUIDE.md
MONGODB_URI=

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
mkdir -p "$BOT_DIR/logs" "$BOT_DIR/temp" "$BOT_DIR/session"
ok "Directories ready"

# ── 11. Firewall ──────────────────────────────────────────────
hdr "11. UFW Firewall"
sudo ufw default deny incoming  > /dev/null
sudo ufw default allow outgoing > /dev/null
sudo ufw allow OpenSSH          > /dev/null
sudo ufw allow 5000/tcp         > /dev/null   # Bot dashboard
sudo ufw --force enable         > /dev/null
ok "Firewall active (SSH + 5000 allowed)"

# ── 12. PM2 startup ───────────────────────────────────────────
hdr "12. PM2 Auto-Start"
cd "$BOT_DIR"
pm2 start ecosystem.config.cjs 2>/dev/null || true
# Register PM2 to start on reboot
PM2_STARTUP=$(pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>&1 | grep "sudo")
[ -n "$PM2_STARTUP" ] && eval "$PM2_STARTUP" > /dev/null 2>&1 || true
pm2 save > /dev/null 2>&1 || true
ok "PM2 configured for auto-restart on reboot"

# ── Done ──────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════╗"
echo "║   ✅  Server ${SERVER_NUM} Setup Complete!           ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${RESET}"

PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo -e "  Dashboard URL : ${CYAN}http://${PUBLIC_IP}:5000${RESET}"
echo ""
echo -e "${BOLD}  ⚡ Next — Required steps:${RESET}"
echo ""
echo "  1. Get Oracle ADB connection string:"
echo "     → deploy/ORACLE-ADB-GUIDE.md  (full guide)"
echo "     → Oracle Console → your ADB → Database connection → MongoDB API"
echo ""
echo "  2. Add it to .env:"
echo "     nano $BOT_DIR/.env"
echo "     (paste MONGODB_URI=mongodb://ADMIN:...)"
echo ""
echo "  3. Restart bot:"
echo "     pm2 restart aa-md-bot"
echo "     pm2 logs aa-md-bot"
echo ""
