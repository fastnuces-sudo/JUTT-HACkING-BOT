#!/bin/bash
# ═══════════════════════════════════════════════════
#  AA MD Bot — Oracle VM MongoDB Setup Script
#  Run: bash oracle-mongo-setup.sh
# ═══════════════════════════════════════════════════

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; }

echo ""
echo "═══════════════════════════════════════"
echo "   AA MD Bot — Oracle MongoDB Setup    "
echo "═══════════════════════════════════════"
echo ""

# ── 1. OS firewall ────────────────────────────────
echo "[ Step 1 ] OS Firewall — port 27017 kholna"

if command -v firewall-cmd &>/dev/null; then
  info "firewalld mila (CentOS/Oracle Linux)"
  sudo firewall-cmd --permanent --add-port=27017/tcp
  sudo firewall-cmd --reload
  ok "firewalld: port 27017 open"

elif command -v ufw &>/dev/null; then
  info "ufw mila (Ubuntu)"
  sudo ufw allow 27017/tcp
  sudo ufw --force enable
  ok "ufw: port 27017 open"

else
  info "iptables use ho raha hai"
  sudo iptables -C INPUT -p tcp --dport 27017 -j ACCEPT 2>/dev/null || \
    sudo iptables -A INPUT -p tcp --dport 27017 -j ACCEPT
  # save rules
  if command -v netfilter-persistent &>/dev/null; then
    sudo netfilter-persistent save
  elif command -v iptables-save &>/dev/null; then
    sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null 2>&1 || true
  fi
  ok "iptables: port 27017 open"
fi

echo ""

# ── 2. MongoDB config — bindIp 0.0.0.0 ───────────
echo "[ Step 2 ] MongoDB — sab IPs pe listen karna"

MONGOD_CONF=""
for f in /etc/mongod.conf /etc/mongodb.conf /usr/local/etc/mongod.conf; do
  [ -f "$f" ] && MONGOD_CONF="$f" && break
done

if [ -z "$MONGOD_CONF" ]; then
  warn "mongod.conf nahi mila — manually check karo"
else
  info "Config file: $MONGOD_CONF"

  # Check current bindIp
  CURRENT=$(grep -E "^\s*bindIp\s*:" "$MONGOD_CONF" | head -1)
  info "Current: $CURRENT"

  if echo "$CURRENT" | grep -q "0\.0\.0\.0"; then
    ok "bindIp pehle se 0.0.0.0 hai — kuch nahi karna"
  else
    # Replace bindIp (handles various formats)
    sudo sed -i 's/^\(\s*bindIp\s*:\s*\).*/\10.0.0.0/' "$MONGOD_CONF"
    ok "bindIp update ho gaya: 0.0.0.0"
  fi
fi

echo ""

# ── 3. MongoDB restart ────────────────────────────
echo "[ Step 3 ] MongoDB restart"

if sudo systemctl restart mongod 2>/dev/null; then
  sleep 2
  if sudo systemctl is-active --quiet mongod; then
    ok "MongoDB running hai"
  else
    fail "MongoDB start nahi hua — logs check karo: sudo journalctl -u mongod -n 50"
    exit 1
  fi
elif sudo systemctl restart mongodb 2>/dev/null; then
  sleep 2
  ok "MongoDB running hai"
else
  warn "systemctl se restart nahi hua — manually try karo: sudo service mongod restart"
fi

echo ""

# ── 4. Connection test ────────────────────────────
echo "[ Step 4 ] Connection test"

IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
info "VM IP: $IP"

# Test if port is listening
if command -v ss &>/dev/null; then
  if ss -tlnp | grep -q ":27017"; then
    ok "Port 27017 listen ho raha hai"
  else
    fail "Port 27017 listen nahi — MongoDB check karo"
  fi
elif command -v netstat &>/dev/null; then
  if netstat -tlnp 2>/dev/null | grep -q ":27017"; then
    ok "Port 27017 listen ho raha hai"
  else
    fail "Port 27017 listen nahi"
  fi
fi

# Quick mongosh test
if command -v mongosh &>/dev/null; then
  info "MongoDB connection test..."
  if mongosh --quiet --eval "db.adminCommand('ping')" "mongodb://admin:StrongPassword123\!@127.0.0.1:27017/admin?authSource=admin" 2>/dev/null | grep -q '"ok"'; then
    ok "MongoDB login test: OK"
  else
    warn "mongosh test fail — credentials check karo ya manually try karo"
  fi
fi

echo ""
echo "═══════════════════════════════════════"
echo "         Setup Complete! ✅             "
echo "═══════════════════════════════════════"
echo ""
echo -e "${YELLOW}IMPORTANT: Ab OCI Console pe bhi port kholna hai!${NC}"
echo ""
echo "OCI Console steps (browser mein karo):"
echo "  1. console.oracle.com kholao"
echo "  2. Networking → Virtual Cloud Networks → apna VCN"
echo "  3. Security Lists → Default Security List"
echo "  4. Add Ingress Rules:"
echo "     Source CIDR:  0.0.0.0/0"
echo "     Protocol:     TCP"
echo "     Port:         27017"
echo "  5. Save"
echo ""
echo -e "${GREEN}Sab ho gaya to Replit pe bot restart karo — MongoDB connect ho jayega!${NC}"
echo ""
