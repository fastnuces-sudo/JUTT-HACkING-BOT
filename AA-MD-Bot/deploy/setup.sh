#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
#  AA MD Bot — Oracle / Ubuntu VPS Deploy Script
#  One command deploy:
#
#  bash <(curl -fsSL https://raw.githubusercontent.com/ahsanaliwadani/AA-MD-Bot/main/deploy/setup.sh)
#
#  Ya directly:
#  bash setup.sh
# ══════════════════════════════════════════════════════════════

set -euo pipefail

REPO_URL="https://github.com/ahsanaliwadani/AA-MD-Bot.git"
BOT_DIR="/home/ubuntu/AA-MD-Bot"
NODE_VERSION="20"

G='\033[0;32m'; C='\033[0;36m'; Y='\033[1;33m'; B='\033[1m'; R='\033[0m'
ok()  { echo -e "${G}✔  $*${R}"; }
inf() { echo -e "${C}▶  $*${R}"; }
hdr() { echo -e "\n${B}${C}── $* ──${R}"; }

clear
echo -e "${B}${C}"
echo "╔══════════════════════════════════════════╗"
echo "║        AA MD Bot — Auto Deploy           ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${R}"

# ── Collect info FIRST — then install everything ──────────────
echo -e "${B}Pehle kuch info chahiye:${R}"
echo ""

# MongoDB URI
if [ -f "$BOT_DIR/.env" ] && grep -q "^MONGODB_URI=.\+" "$BOT_DIR/.env" 2>/dev/null; then
  MONGODB_URI=$(grep "^MONGODB_URI=" "$BOT_DIR/.env" | cut -d= -f2-)
  echo -e "  ${G}✔  MongoDB URI already set in .env — reusing${R}"
else
  echo -e "  ${C}MongoDB connection string (apna URI paste karo):${R}"
  echo -e "  ${Y}Example: mongodb://user:pass@127.0.0.1:27017/aa_md_bot${R}"
  read -r -p "  MONGODB_URI= " MONGODB_URI
  while [ -z "$MONGODB_URI" ]; do
    echo -e "  ${Y}⚠  URI khali nahi ho sakti${R}"
    read -r -p "  MONGODB_URI= " MONGODB_URI
  done
fi

echo ""

# Optional: Telegram tokens
TELEGRAM_TOKEN=""
TELEGRAM_FEATURES_TOKEN=""
read -r -p "  Telegram bot token? (optional — Enter skip karo): " TELEGRAM_TOKEN
if [ -n "$TELEGRAM_TOKEN" ]; then
  read -r -p "  Telegram features bot token? (optional — Enter skip karo): " TELEGRAM_FEATURES_TOKEN
fi

echo ""
inf "Theek hai! Ab sab kuch apne aap install hoga..."
echo ""

# ── 1. System update ──────────────────────────────────────────
hdr "1. System Update"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -yq
ok "System updated"

# ── 2. System dependencies ────────────────────────────────────
hdr "2. System Dependencies (ffmpeg, git, curl)"
sudo apt-get install -yq \
  ffmpeg curl wget git unzip \
  build-essential ca-certificates gnupg
ok "System tools installed"

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
ok "yt-dlp ready"

# ── 5. Deno ───────────────────────────────────────────────────
hdr "5. Deno (YouTube downloads ke liye)"
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
hdr "6. PM2 (process manager)"
sudo npm install -g pm2 >/dev/null 2>&1
ok "PM2 $(pm2 --version) installed"

# ── 7. Bot code ───────────────────────────────────────────────
hdr "7. Bot Code"
if [ -d "$BOT_DIR/.git" ]; then
  inf "Repo already hai — update ho raha hai..."
  cd "$BOT_DIR" && git pull
  ok "Code updated"
else
  inf "Repo clone ho raha hai..."
  git clone "$REPO_URL" "$BOT_DIR"
  ok "Code cloned to $BOT_DIR"
fi

# ── 8. npm install ────────────────────────────────────────────
hdr "8. Node.js Packages"
cd "$BOT_DIR"
npm install --omit=dev --silent
ok "Packages installed"

# ── 9. Directories ────────────────────────────────────────────
mkdir -p logs temp session downloads database cache
ok "Directories ready"

# ── 10. .env — auto write ─────────────────────────────────────
hdr "10. .env Configuration"
SESSION_SECRET=$(openssl rand -hex 32)

cat > "$BOT_DIR/.env" << EOF
PORT=5000
MONGODB_URI=${MONGODB_URI}
TELEGRAM_BOT_TOKEN=${TELEGRAM_TOKEN}
TELEGRAM_FEATURES_BOT_TOKEN=${TELEGRAM_FEATURES_TOKEN}
OPENWEATHER_API_KEY=
OMDB_API_KEY=
RAPIDAPI_KEY=
OCR_SPACE_KEY=
HF_TOKEN=
TENOR_API_KEY=
SESSION_SECRET=${SESSION_SECRET}
EOF

ok ".env written"

# ── 11. Firewall ──────────────────────────────────────────────
hdr "11. Firewall (port 5000 + SSH)"
sudo ufw default deny incoming  >/dev/null
sudo ufw default allow outgoing >/dev/null
sudo ufw allow OpenSSH          >/dev/null
sudo ufw allow 5000/tcp         >/dev/null
sudo ufw --force enable         >/dev/null
ok "Firewall active"

# ── 12. PM2 start + auto-restart on reboot ────────────────────
hdr "12. Bot Start"
cd "$BOT_DIR"
pm2 delete aa-md-bot 2>/dev/null || true
pm2 start ecosystem.config.cjs
PM2_CMD=$(pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>&1 | grep "sudo env" || true)
[ -n "$PM2_CMD" ] && eval "$PM2_CMD" >/dev/null 2>&1 || true
pm2 save >/dev/null 2>&1
ok "Bot started + auto-restart on reboot enabled"

# ── Done ──────────────────────────────────────────────────────
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo -e "${G}${B}"
echo "╔══════════════════════════════════════════╗"
echo "║           ✅  Deploy Complete!           ║"
echo "╚══════════════════════════════════════════╝"
echo -e "${R}"
echo -e "  Dashboard  : ${C}http://${PUBLIC_IP}:5000${R}"
echo ""
echo -e "  ${B}Useful commands:${R}"
echo "    pm2 logs aa-md-bot       ← live logs"
echo "    pm2 status               ← bot status"
echo "    pm2 restart aa-md-bot    ← restart"
echo ""
echo -e "  ${B}WhatsApp connect karne ke liye:${R}"
echo -e "  Browser mein kholo: ${C}http://${PUBLIC_IP}:5000${R}"
echo "  Pairing code enter karo → WhatsApp link karo"
echo ""
