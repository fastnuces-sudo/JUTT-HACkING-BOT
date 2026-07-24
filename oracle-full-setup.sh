#!/bin/bash
# ══════════════════════════════════════════════════════════
#   AA MD Bot — Oracle VM Complete MongoDB Setup
#   Run this on a FRESH Oracle VM after SSH login:
#   bash <(curl -fsSL https://your-link/oracle-full-setup.sh)
#   OR: copy-paste this whole file and run: bash oracle-full-setup.sh
# ══════════════════════════════════════════════════════════

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'
ok()    { echo -e "${GREEN}✅  $1${NC}"; }
info()  { echo -e "${BLUE}➜   $1${NC}"; }
warn()  { echo -e "${YELLOW}⚠️   $1${NC}"; }
header(){ echo -e "\n${BOLD}${BLUE}══ $1 ══${NC}\n"; }

echo ""
echo -e "${BOLD}╔════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  AA MD Bot — Oracle MongoDB Setup  ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════╝${NC}"
echo ""

# ── Detect OS ─────────────────────────────────────────────
if [ -f /etc/oracle-release ] || grep -qi "oracle" /etc/os-release 2>/dev/null; then
  OS="oracle"
elif grep -qi "ubuntu\|debian" /etc/os-release 2>/dev/null; then
  OS="ubuntu"
elif grep -qi "centos\|rhel\|fedora" /etc/os-release 2>/dev/null; then
  OS="centos"
else
  OS="ubuntu"
fi
info "Detected OS type: $OS"

# ══════════════════════════════════════════════════
# STEP 1 — System update
# ══════════════════════════════════════════════════
header "STEP 1: System Update"

if [ "$OS" = "ubuntu" ]; then
  sudo apt-get update -y -q
  sudo apt-get install -y -q curl gnupg wget
else
  sudo yum update -y -q 2>/dev/null || sudo dnf update -y -q 2>/dev/null || true
  sudo yum install -y -q curl wget 2>/dev/null || sudo dnf install -y -q curl wget 2>/dev/null || true
fi
ok "System updated"

# ══════════════════════════════════════════════════
# STEP 2 — Install MongoDB 7
# ══════════════════════════════════════════════════
header "STEP 2: Install MongoDB 7"

if command -v mongod &>/dev/null; then
  MONGO_VER=$(mongod --version 2>/dev/null | head -1)
  warn "MongoDB already installed: $MONGO_VER — skipping install"
else
  if [ "$OS" = "ubuntu" ]; then
    # Ubuntu: official MongoDB 7 repo
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
      sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
    UBUNTU_CODENAME=$(lsb_release -cs 2>/dev/null || echo "jammy")
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
https://repo.mongodb.org/apt/ubuntu ${UBUNTU_CODENAME}/mongodb-org/7.0 multiverse" | \
      sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list > /dev/null
    sudo apt-get update -q
    sudo apt-get install -y -q mongodb-org
  else
    # CentOS / Oracle Linux / RHEL
    cat <<'REPO' | sudo tee /etc/yum.repos.d/mongodb-org-7.0.repo > /dev/null
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/$releasever/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://www.mongodb.org/static/pgp/server-7.0.asc
REPO
    sudo yum install -y mongodb-org 2>/dev/null || sudo dnf install -y mongodb-org 2>/dev/null
  fi
  ok "MongoDB 7 installed"
fi

# ══════════════════════════════════════════════════
# STEP 3 — Configure MongoDB (bindIp + auth)
# ══════════════════════════════════════════════════
header "STEP 3: Configure MongoDB"

MONGOD_CONF=$(find /etc -name "mongod.conf" 2>/dev/null | head -1)
[ -z "$MONGOD_CONF" ] && MONGOD_CONF="/etc/mongod.conf"
info "Config file: $MONGOD_CONF"

# Backup original
sudo cp "$MONGOD_CONF" "${MONGOD_CONF}.bak" 2>/dev/null || true

# Write a clean config
sudo tee "$MONGOD_CONF" > /dev/null << 'MONGOCONF'
# AA MD Bot — MongoDB Config
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
MONGOCONF

ok "mongod.conf updated (bindIp: 0.0.0.0, auth: enabled)"

# Make sure data dir exists
sudo mkdir -p /var/lib/mongodb /var/log/mongodb
if id mongod &>/dev/null; then
  sudo chown -R mongod:mongod /var/lib/mongodb /var/log/mongodb 2>/dev/null || true
elif id mongodb &>/dev/null; then
  sudo chown -R mongodb:mongodb /var/lib/mongodb /var/log/mongodb 2>/dev/null || true
fi

# ── First start WITHOUT auth to create admin user ─────────
header "STEP 4: Create Admin User"

info "Starting MongoDB without auth to create user..."

# Stop any running instance
sudo systemctl stop mongod 2>/dev/null || sudo service mongod stop 2>/dev/null || true
sleep 2

# Temp config (no auth)
sudo tee /tmp/mongod-noauth.conf > /dev/null << 'TMPCONF'
storage:
  dbPath: /var/lib/mongodb
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log
net:
  port: 27017
  bindIp: 127.0.0.1
TMPCONF

sudo mongod --config /tmp/mongod-noauth.conf --fork --logpath /var/log/mongodb/mongod.log
sleep 3

# Check if existing admin user exists
EXISTING=$(mongosh --quiet --eval \
  "db.getSiblingDB('admin').getUser('admin')" \
  "mongodb://127.0.0.1:27017/" 2>/dev/null || echo "null")

if echo "$EXISTING" | grep -q '"user"'; then
  warn "Admin user already exists — skipping creation"
else
  info "Creating admin user..."
  mongosh --quiet "mongodb://127.0.0.1:27017/admin" --eval '
    db.createUser({
      user: "admin",
      pwd: "StrongPassword123!",
      roles: [
        { role: "userAdminAnyDatabase", db: "admin" },
        { role: "readWriteAnyDatabase", db: "admin" },
        { role: "dbAdminAnyDatabase",   db: "admin" }
      ]
    })
  ' 2>/dev/null && ok "Admin user created: admin / StrongPassword123!" || warn "User may already exist"
fi

# Stop temp instance
sudo mongod --shutdown --dbpath /var/lib/mongodb 2>/dev/null || \
  sudo pkill mongod 2>/dev/null || true
sleep 2

# ══════════════════════════════════════════════════
# STEP 5 — Start MongoDB with auth
# ══════════════════════════════════════════════════
header "STEP 5: Start MongoDB (with auth)"

sudo systemctl enable mongod 2>/dev/null || true
sudo systemctl start mongod
sleep 3

if sudo systemctl is-active --quiet mongod; then
  ok "MongoDB is running with auth enabled"
else
  # try service
  sudo service mongod start 2>/dev/null || true
  sleep 2
fi

# ══════════════════════════════════════════════════
# STEP 6 — Open OS Firewall (port 27017)
# ══════════════════════════════════════════════════
header "STEP 6: Open OS Firewall — Port 27017"

if command -v firewall-cmd &>/dev/null; then
  info "firewalld detected (Oracle Linux / CentOS)"
  sudo firewall-cmd --permanent --add-port=27017/tcp
  sudo firewall-cmd --reload
  ok "firewalld: port 27017 open"
elif command -v ufw &>/dev/null && sudo ufw status | grep -q "active"; then
  info "ufw detected (Ubuntu)"
  sudo ufw allow 27017/tcp
  ok "ufw: port 27017 open"
else
  info "Using iptables"
  sudo iptables -C INPUT -p tcp --dport 27017 -j ACCEPT 2>/dev/null || \
    sudo iptables -A INPUT -p tcp --dport 27017 -j ACCEPT
  # Persist
  command -v netfilter-persistent &>/dev/null && sudo netfilter-persistent save 2>/dev/null || true
  command -v iptables-save &>/dev/null && \
    { sudo sh -c 'iptables-save > /etc/iptables/rules.v4' 2>/dev/null || true; }
  ok "iptables: port 27017 open"
fi

# ══════════════════════════════════════════════════
# STEP 7 — Verify connection
# ══════════════════════════════════════════════════
header "STEP 7: Connection Test"

sleep 2
VM_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || \
        curl -s --max-time 5 api.ipify.org 2>/dev/null || \
        hostname -I | awk '{print $1}')
info "Your VM public IP: ${VM_IP}"

# Port listening check
if ss -tlnp 2>/dev/null | grep -q ":27017" || \
   netstat -tlnp 2>/dev/null | grep -q ":27017"; then
  ok "Port 27017 is listening"
else
  warn "Port 27017 not found in ss/netstat — check mongod status"
fi

# Auth connection test
if mongosh --quiet \
   "mongodb://admin:StrongPassword123\!@127.0.0.1:27017/admin?authSource=admin" \
   --eval "db.adminCommand('ping')" 2>/dev/null | grep -q "ok"; then
  ok "MongoDB auth login: SUCCESS"
else
  warn "Auth test inconclusive — may still be starting"
fi

# ══════════════════════════════════════════════════
# DONE — Print summary
# ══════════════════════════════════════════════════
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}║              ✅  SETUP COMPLETE!                          ║${NC}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}MongoDB Connection URI (Replit Secret mein dalo):${NC}"
echo -e "${YELLOW}mongodb://admin:StrongPassword123!@${VM_IP}:27017/admin?authSource=admin${NC}"
echo ""
echo -e "${BOLD}${RED}═══ OCI CONSOLE PE BHI KARNA HAI (BROWSER) ═══${NC}"
echo ""
echo "  1. https://cloud.oracle.com kholao"
echo "  2. Networking → Virtual Cloud Networks → apna VCN"
echo "  3. Security Lists → Default Security List"
echo "  4. Add Ingress Rules:"
echo "       Source CIDR : 0.0.0.0/0"
echo "       Protocol    : TCP"
echo "       Port        : 27017"
echo "  5. Save karke Replit pe bot restart karo"
echo ""
echo -e "${BOLD}Credentials:${NC}  admin / StrongPassword123!"
echo -e "${BOLD}Port:${NC}         27017"
echo ""
