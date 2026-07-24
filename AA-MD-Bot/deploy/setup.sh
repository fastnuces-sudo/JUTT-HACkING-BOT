#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════
#  AA MD Bot — Oracle Cloud Ubuntu 22.04 Setup Script
#  Run ONCE on each VM after first SSH login
#
#  Usage:
#    Server 1 (also hosts MongoDB):
#      bash setup.sh 1 install-mongo
#
#    Server 2 & 3 (connect to Server 1's MongoDB):
#      bash setup.sh 2 10.0.0.X      # replace X with VM1 private IP
#      bash setup.sh 3 10.0.0.X
# ══════════════════════════════════════════════════════════════

set -euo pipefail

SERVER_NUM="${1:-1}"
MONGO_ARG="${2:-install-mongo}"   # 'install-mongo' OR private IP of VM1

REPO_URL="https://github.com/YOUR_USERNAME/AA-MD-Bot.git"   # ← change this
BOT_DIR="/home/ubuntu/AA-MD-Bot"
NODE_VERSION="20"

# ── Colours ───────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
ok()  { echo -e "${GREEN}✔ $*${RESET}"; }
inf() { echo -e "${CYAN}▶ $*${RESET}"; }
war() { echo -e "${YELLOW}⚠ $*${RESET}"; }

echo -e "${BOLD}${CYAN}"
echo "══════════════════════════════════════════════"
echo "   AA MD Bot — Oracle Cloud Setup"
echo "   Server : ${SERVER_NUM}"
if [ "$MONGO_ARG" = "install-mongo" ]; then
  echo "   MongoDB: localhost (installing now)"
else
  echo "   MongoDB: ${MONGO_ARG} (remote)"
fi
echo "══════════════════════════════════════════════"
echo -e "${RESET}"

# ── 1. System update ──────────────────────────────────────────
inf "Updating system packages..."
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -yq
ok "System updated"

# ── 2. System dependencies ────────────────────────────────────
inf "Installing system dependencies..."
sudo apt-get install -yq \
  ffmpeg curl wget git unzip python3 python3-pip \
  build-essential ca-certificates gnupg lsb-release \
  ufw fail2ban
ok "System deps installed"

# ── 3. Node.js 20 ─────────────────────────────────────────────
inf "Installing Node.js ${NODE_VERSION}..."
if ! node --version 2>/dev/null | grep -q "^v${NODE_VERSION}"; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash - > /dev/null 2>&1
  sudo apt-get install -yq nodejs
fi
ok "Node $(node --version) installed"

# ── 4. yt-dlp ─────────────────────────────────────────────────
inf "Installing yt-dlp..."
sudo curl -sSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
  -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
ok "yt-dlp $(yt-dlp --version) installed"

# ── 5. Deno (yt-dlp n-challenge solver) ───────────────────────
inf "Installing Deno..."
if ! command -v deno &>/dev/null; then
  export DENO_INSTALL="/home/ubuntu/.deno"
  curl -fsSL https://deno.land/install.sh | sh > /dev/null 2>&1
  echo 'export DENO_INSTALL="/home/ubuntu/.deno"' >> /home/ubuntu/.bashrc
  echo 'export PATH="$DENO_INSTALL/bin:$PATH"'    >> /home/ubuntu/.bashrc
  export PATH="$DENO_INSTALL/bin:$PATH"
fi
ok "Deno installed"

# ── 6. PM2 ────────────────────────────────────────────────────
inf "Installing PM2..."
sudo npm install -g pm2 > /dev/null 2>&1
ok "PM2 $(pm2 --version) installed"

# ── 7. dotenv CLI (for .env loading) ─────────────────────────
sudo npm install -g dotenv-cli > /dev/null 2>&1

# ── 8. MongoDB (Server 1 only) ────────────────────────────────
if [ "$MONGO_ARG" = "install-mongo" ]; then
  inf "Installing MongoDB 7.0..."
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
    sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
    https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
    sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list > /dev/null
  sudo apt-get update -qq
  sudo apt-get install -yq mongodb-org
  sudo systemctl enable mongod
  sudo systemctl start mongod
  sleep 3

  # Create bot database user
  inf "Creating MongoDB bot user..."
  MONGO_BOT_PASS=$(openssl rand -base64 24 | tr -d '/+=')
  mongosh --quiet --eval "
    use admin
    db.createUser({
      user: 'admin',
      pwd:  '${MONGO_BOT_PASS}Admin',
      roles: [{ role: 'userAdminAnyDatabase', db: 'admin' }]
    })
    use aa_md_bot
    db.createUser({
      user: 'aa_bot_user',
      pwd:  '${MONGO_BOT_PASS}',
      roles: [{ role: 'readWrite', db: 'aa_md_bot' }]
    })
  " 2>/dev/null || true

  # Enable auth + bind to 0.0.0.0 so other VMs can connect
  sudo tee /etc/mongod.conf > /dev/null << EOF
storage:
  dbPath: /var/lib/mongodb
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log
net:
  port: 27017
  bindIp: 0.0.0.0
security:
  authorization: enabled
processManagement:
  timeZoneInfo: /usr/share/zoneinfo
EOF

  sudo systemctl restart mongod
  ok "MongoDB installed and configured"

  MONGO_URI="mongodb://aa_bot_user:${MONGO_BOT_PASS}@localhost:27017/aa_md_bot"
  echo ""
  echo -e "${YELLOW}══════════════════════════════════════════════${RESET}"
  echo -e "${BOLD}  SAVE THESE CREDENTIALS (shown only once):${RESET}"
  echo -e "${YELLOW}  MONGO_BOT_PASS : ${MONGO_BOT_PASS}${RESET}"
  echo -e "${YELLOW}  MONGODB_URI    : ${MONGO_URI}${RESET}"
  echo -e "${YELLOW}══════════════════════════════════════════════${RESET}"
  echo ""
else
  MONGO_URI="mongodb://aa_bot_user:REPLACE_WITH_PASSWORD@${MONGO_ARG}:27017/aa_md_bot"
  war "Set your MongoDB password in the MONGODB_URI line of .env after setup"
fi

# ── 9. Clone / update repo ────────────────────────────────────
inf "Setting up bot directory..."
if [ -d "$BOT_DIR/.git" ]; then
  cd "$BOT_DIR" && git pull
  ok "Repo updated"
else
  git clone "$REPO_URL" "$BOT_DIR"
  ok "Repo cloned"
fi

cd "$BOT_DIR"

# ── 10. Install Node dependencies ─────────────────────────────
inf "Installing Node.js dependencies..."
npm install --omit=dev --silent
ok "Dependencies installed"

# ── 11. Create .env ───────────────────────────────────────────
if [ ! -f "$BOT_DIR/.env" ]; then
  inf "Creating .env from template..."
  SESSION_SECRET=$(openssl rand -hex 32)
  cat > "$BOT_DIR/.env" << EOF
# AA MD Bot — Server ${SERVER_NUM}
PORT=5000
SERVER_ID=server-${SERVER_NUM}

# MongoDB (Oracle Cloud self-hosted)
MONGODB_URI=${MONGO_URI}

# Telegram (fill in if using)
TELEGRAM_BOT_TOKEN=
TELEGRAM_FEATURES_BOT_TOKEN=

# Optional API Keys
OPENWEATHER_API_KEY=
OMDB_API_KEY=
RAPIDAPI_KEY=
OCR_SPACE_KEY=
HF_TOKEN=
TENOR_API_KEY=

# Security
SESSION_SECRET=${SESSION_SECRET}
EOF
  ok ".env created"
else
  war ".env already exists — skipping (edit manually if needed)"
fi

# ── 12. Create logs directory ─────────────────────────────────
mkdir -p "$BOT_DIR/logs" "$BOT_DIR/temp" "$BOT_DIR/session"

# ── 13. Firewall ──────────────────────────────────────────────
inf "Configuring UFW firewall..."
sudo ufw default deny incoming > /dev/null
sudo ufw default allow outgoing > /dev/null
sudo ufw allow OpenSSH > /dev/null
sudo ufw allow 5000/tcp > /dev/null              # Bot dashboard
if [ "$MONGO_ARG" = "install-mongo" ]; then
  sudo ufw allow from 10.0.0.0/24 to any port 27017 > /dev/null   # MongoDB — internal only
fi
sudo ufw --force enable > /dev/null
ok "Firewall configured"

# ── 14. PM2 startup ───────────────────────────────────────────
inf "Configuring PM2 auto-start on reboot..."
cd "$BOT_DIR"
pm2 start ecosystem.config.cjs --env production 2>/dev/null || true
pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>/dev/null | grep "sudo" | bash || true
pm2 save
ok "PM2 configured"

# ── Done ──────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}"
echo "══════════════════════════════════════════════"
echo "  ✅  Server ${SERVER_NUM} Setup Complete!"
echo "══════════════════════════════════════════════"
echo -e "${RESET}"
echo -e "  Bot dashboard : ${CYAN}http://$(hostname -I | awk '{print $1}'):5000${RESET}"
echo ""
echo -e "  ${BOLD}Next steps:${RESET}"
echo "  1. Edit .env with your tokens:  nano $BOT_DIR/.env"
echo "  2. Restart bot:                 pm2 restart aa-md-bot"
echo "  3. View logs:                   pm2 logs aa-md-bot"
echo ""
