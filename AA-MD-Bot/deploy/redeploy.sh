#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  AA MD Bot — Redeploy Script
#  Oracle Cloud Ubuntu 22.04 ARM64 — Update only (VM already configured)
#
#  Usage:
#    bash ~/redeploy.sh          ← run from anywhere
#    bash /path/to/redeploy.sh   ← full path also works
#
#  What this script does:
#    ✔ Pulls latest code from GitHub
#    ✔ Auto-detects bot directory (handles nested repo structures)
#    ✔ Runs npm install only if package.json changed
#    ✔ Restarts bot via PM2 (--update-env to pick up any new env vars)
#    ✔ Waits for dashboard to come online (HTTP 200 on port 5000)
#    ✔ Reloads nginx if installed
#    ✔ Shows full deployment summary + useful commands
#
#  What this script does NOT touch:
#    ✘ Ubuntu packages / system dependencies
#    ✘ MongoDB
#    ✘ Node.js / npm (only uses existing install)
#    ✘ Nginx config or SSL certificates
#    ✘ Firewall / UFW / iptables
#    ✘ .env file
# ══════════════════════════════════════════════════════════════════════════════

set -Eeuo pipefail

# ── Error trap ────────────────────────────────────────────────────────────────
trap '_err_line=$LINENO; _err_cmd=$BASH_COMMAND; _err_exit=$?
echo ""
echo -e "${RE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}"
echo -e "${RE}❌  Redeploy failed (exit $SCRIPT_NAME:${_err_line}, code $_err_exit)${R}"
echo -e "${RE}    Command: $_err_cmd${R}"
echo -e "${RE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}"
echo ""
echo -e "${Y}💡 Debug tips:${R}"
echo -e "   ${DIM}pm2 logs aa-md-bot --lines 50${R}"
echo -e "   ${DIM}pm2 status${R}"
echo -e "   ${DIM}cd $REPO_CLONE_DIR && git status${R}"
echo ""' ERR

# ── Constants ─────────────────────────────────────────────────────────────────
REPO_CLONE_DIR="/home/ubuntu/AA-MD-Bot-repo"   # git repo root
PM2_APP_NAME="aa-md-bot"
NPM_REGISTRY="https://registry.npmjs.org/"
SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
REDEPLOY_START=$(date +%s)
LOG_FILE="/home/ubuntu/aa-md-bot-redeploy.log"

# ── Colours ───────────────────────────────────────────────────────────────────
G='\033[0;32m'     # green
C='\033[0;36m'     # cyan
Y='\033[1;33m'     # yellow
B='\033[1m'        # bold
R='\033[0m'        # reset
RE='\033[0;31m'    # red
DIM='\033[2m'      # dim

# ── Logging helpers ───────────────────────────────────────────────────────────
_ts()   { date '+%H:%M:%S'; }
_log()  { echo "[$(_ts)] $*" >> "$LOG_FILE" 2>/dev/null || true; }
ok()    { local msg="✔  $*"; echo -e "${G}${msg}${R}"; _log "OK   $*"; }
inf()   { local msg="▶  $*"; echo -e "${C}${msg}${R}"; _log "INF  $*"; }
warn()  { local msg="⚠  $*"; echo -e "${Y}${msg}${R}"; _log "WRN  $*"; }
fail()  { local msg="❌  $*"; echo -e "${RE}${msg}${R}"; _log "ERR  $*"; exit 1; }
hdr()   { echo -e "\n${B}${C}━━━  $*  ━━━${R}${DIM} ($(_ts))${R}"; _log "---  $*  ---"; }
elapsed() { echo $(( $(date +%s) - REDEPLOY_START )); }

# Initialise log
sudo touch "$LOG_FILE" 2>/dev/null && sudo chmod 666 "$LOG_FILE" 2>/dev/null \
  || LOG_FILE="${HOME}/aa-md-bot-redeploy-$(date +%Y%m%d).log"
echo "" >> "$LOG_FILE" 2>/dev/null || LOG_FILE="/tmp/aa-md-bot-redeploy.log" && echo "" >> "$LOG_FILE"
echo "=== Redeploy $(date) ===" >> "$LOG_FILE"

# ── Summary tracking ──────────────────────────────────────────────────────────
# Each step records its status so we can print a clean table at the end
declare -A STEP_STATUS
_pass() { STEP_STATUS["$1"]="${G}✔ $2${R}"; }
_skip() { STEP_STATUS["$1"]="${DIM}⤼ $2 (skipped)${R}"; }
_fail() { STEP_STATUS["$1"]="${RE}✖ $2${R}"; }

# ══════════════════════════════════════════════════════════════════════════════

clear
echo -e "${B}${C}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          AA MD Bot — Redeploy / Update                  ║"
echo "║    Pulls latest code and restarts the bot safely        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${R}"
echo -e "  ${DIM}Log: $LOG_FILE${R}"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Pre-flight checks: verify required tools are available
# ══════════════════════════════════════════════════════════════════════════════
hdr "1. Pre-flight Checks"

_check_cmd() {
  local cmd="$1" label="${2:-$1}"
  if command -v "$cmd" &>/dev/null; then
    ok "$label found: $(command -v "$cmd")"
  else
    fail "$label is not installed or not on PATH.\n     Run the full setup script first:\n     bash <(curl -fsSL https://raw.githubusercontent.com/ahsanaliwadani/AA-MD-Bot/main/AA-MD-Bot/deploy/setup.sh)"
  fi
}

_check_cmd git    "Git"
_check_cmd node   "Node.js"
_check_cmd npm    "npm"
_check_cmd pm2    "PM2"

ok "All required tools are present"
_pass "preflight" "All tools present"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Repository check
# ══════════════════════════════════════════════════════════════════════════════
hdr "2. Repository Check"

if [ ! -d "$REPO_CLONE_DIR" ]; then
  fail "Repository directory not found: $REPO_CLONE_DIR\n\n" \
       "This script only works on a VM already set up with the full deploy script.\n" \
       "Run setup first: bash <(curl -fsSL https://raw.githubusercontent.com/ahsanaliwadani/AA-MD-Bot/main/AA-MD-Bot/deploy/setup.sh)"
fi

if [ ! -d "$REPO_CLONE_DIR/.git" ]; then
  fail "$REPO_CLONE_DIR exists but is not a git repository.\n" \
       "Delete it and re-run the full setup script."
fi

ok "Repository found: $REPO_CLONE_DIR"
_pass "repo" "Repository OK"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — Git: stash uncommitted changes → fetch → pull
# ══════════════════════════════════════════════════════════════════════════════
hdr "3. Git Update"

cd "$REPO_CLONE_DIR"

# Record state of .env.example before pull (for change detection in step 5)
ENV_EXAMPLE_BEFORE=""
_example_file=$(find "$REPO_CLONE_DIR" -maxdepth 4 -name ".env.example" \
  ! -path "*/node_modules/*" | head -1)
if [ -n "$_example_file" ] && [ -f "$_example_file" ]; then
  ENV_EXAMPLE_BEFORE=$(md5sum "$_example_file" | awk '{print $1}')
fi

# Record current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")
COMMIT_BEFORE=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

# Stash any uncommitted local changes so pull won't be blocked
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  warn "Uncommitted changes detected — stashing them to allow git pull..."
  git stash push --include-untracked --message "auto-stash by redeploy.sh $(date)" \
    >/dev/null 2>&1 || true
  warn "Changes stashed — run 'git stash pop' to restore if needed"
fi

# Fetch all branches quietly
inf "git fetch..."
git fetch --all --quiet

# Pull latest — fast-forward only to avoid surprise merges
inf "git pull origin $CURRENT_BRANCH..."
git pull --ff-only origin "$CURRENT_BRANCH" \
  || { warn "Fast-forward failed — resetting to origin/$CURRENT_BRANCH"; \
       git reset --hard "origin/$CURRENT_BRANCH" --quiet; }

COMMIT_AFTER=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

if [ "$COMMIT_BEFORE" = "$COMMIT_AFTER" ]; then
  ok "Already up-to-date ($COMMIT_AFTER)"
  _pass "git" "Already up-to-date ($COMMIT_AFTER)"
else
  ok "Code updated: ${COMMIT_BEFORE} → ${COMMIT_AFTER}"
  inf "Changes:"
  git log --oneline "${COMMIT_BEFORE}..${COMMIT_AFTER}" 2>/dev/null \
    | head -10 | while IFS= read -r line; do inf "  $line"; done
  _pass "git" "Updated $COMMIT_BEFORE → $COMMIT_AFTER"
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Auto-detect correct bot directory
# package.json sometimes at:  AA-MD-Bot-repo/package.json         (flat)
# sometimes at:               AA-MD-Bot-repo/AA-MD-Bot/package.json (nested)
# ══════════════════════════════════════════════════════════════════════════════
hdr "4. Bot Directory Detection"

BOT_DIR=""

# Priority 1: flat — package.json at repo root
[ -f "$REPO_CLONE_DIR/package.json" ] \
  && BOT_DIR="$REPO_CLONE_DIR"

# Priority 2: nested one level
[ -z "$BOT_DIR" ] && [ -f "$REPO_CLONE_DIR/AA-MD-Bot/package.json" ] \
  && BOT_DIR="$REPO_CLONE_DIR/AA-MD-Bot"

# Priority 3: nested two levels (edge case)
[ -z "$BOT_DIR" ] && [ -f "$REPO_CLONE_DIR/AA-MD-Bot/AA-MD-Bot/package.json" ] \
  && BOT_DIR="$REPO_CLONE_DIR/AA-MD-Bot/AA-MD-Bot"

# Fallback: search for package.json, excluding node_modules
if [ -z "$BOT_DIR" ]; then
  _found=$(find "$REPO_CLONE_DIR" -maxdepth 5 -name "package.json" \
            ! -path "*/node_modules/*" | head -1)
  [ -n "$_found" ] && BOT_DIR="$(dirname "$_found")" \
    && warn "package.json auto-detected at: $BOT_DIR (check this is correct)"
fi

# Validate
[ -z "$BOT_DIR" ] && fail "package.json not found anywhere in $REPO_CLONE_DIR\n     Check the repository structure with: ls $REPO_CLONE_DIR/"
[ -f "$BOT_DIR/package.json" ] || fail "Bot directory is invalid: $BOT_DIR"

ok "Bot directory: $BOT_DIR"
_pass "botdir" "$BOT_DIR"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 5 — .env.example change detection (informational only — never modify .env)
# ══════════════════════════════════════════════════════════════════════════════
hdr "5. .env.example Change Check"

# Re-find .env.example now that we know BOT_DIR
_example_after=""
for _ef in "$BOT_DIR/.env.example" "$REPO_CLONE_DIR/.env.example"; do
  if [ -f "$_ef" ]; then
    _example_after=$(md5sum "$_ef" | awk '{print $1}')
    break
  fi
done

if [ -n "$ENV_EXAMPLE_BEFORE" ] && [ -n "$_example_after" ] \
   && [ "$ENV_EXAMPLE_BEFORE" != "$_example_after" ]; then
  echo ""
  echo -e "${Y}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}"
  echo -e "${Y}⚠  .env.example has NEW variables since last deploy!${R}"
  echo -e "${Y}   Review and add missing variables to your .env:${R}"
  echo ""
  echo -e "   ${DIM}diff $BOT_DIR/.env $BOT_DIR/.env.example${R}"
  echo -e "${Y}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${R}"
  echo ""
  STEP_STATUS["env_example"]="${Y}⚠ .env.example changed — review new variables${R}"
else
  ok ".env.example unchanged — no new variables"
  _pass "env_example" "No new variables"
fi

# Verify .env exists in bot dir (do NOT modify it, just warn if missing)
if [ ! -f "$BOT_DIR/.env" ]; then
  warn ".env not found in $BOT_DIR — bot may fail to start."
  warn "Copy from example: cp $BOT_DIR/.env.example $BOT_DIR/.env && nano $BOT_DIR/.env"
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 6 — npm install (only if package.json changed)
# ══════════════════════════════════════════════════════════════════════════════
hdr "6. Dependencies"

cd "$BOT_DIR"

# Set npm registry to official (avoids corporate proxy issues)
npm config set registry "$NPM_REGISTRY" 2>/dev/null || true

# Hash-based change detection — compare current package.json with last install
PKG_HASH_FILE="$BOT_DIR/.npm-install-hash"
CURRENT_PKG_HASH=$(md5sum "$BOT_DIR/package.json" | awk '{print $1}')
STORED_PKG_HASH=$(cat "$PKG_HASH_FILE" 2>/dev/null || echo "none")

if [ "$CURRENT_PKG_HASH" = "$STORED_PKG_HASH" ] && [ -d "$BOT_DIR/node_modules" ]; then
  ok "package.json unchanged — npm install skipped"
  _skip "npm" "package.json unchanged"
else
  if [ "$CURRENT_PKG_HASH" != "$STORED_PKG_HASH" ]; then
    inf "package.json changed — running npm install..."
  else
    inf "node_modules missing — running npm install..."
  fi

  # Helper: run npm install with standard flags
  _npm_install() {
    npm install --omit=dev \
      --registry="$NPM_REGISTRY" \
      --no-audit \
      --no-fund \
      --silent
  }

  if _npm_install; then
    # Success — save hash for next run
    echo "$CURRENT_PKG_HASH" > "$PKG_HASH_FILE"
    ok "npm install completed"
    _pass "npm" "Packages installed"
  else
    warn "npm install failed — removing node_modules + package-lock.json and retrying..."
    rm -rf node_modules package-lock.json
    if _npm_install; then
      echo "$CURRENT_PKG_HASH" > "$PKG_HASH_FILE"
      ok "npm install succeeded on retry"
      _pass "npm" "Packages installed (retry)"
    else
      _fail "npm" "npm install failed"
      fail "npm install failed after retry.\n\nDebug:\n  cd $BOT_DIR && npm install --registry=$NPM_REGISTRY"
    fi
  fi
fi

# ── Verify node_modules exists ────────────────────────────────────────────────
hdr "7. Verify node_modules"

if [ -d "$BOT_DIR/node_modules" ]; then
  _count=$(find "$BOT_DIR/node_modules" -maxdepth 1 -mindepth 1 -type d | wc -l)
  ok "node_modules present ($_count top-level packages)"
else
  fail "node_modules still missing after npm install.\n     Try manually: cd $BOT_DIR && npm install"
fi

# ── Verify ecosystem.config.cjs exists ───────────────────────────────────────
hdr "8. Verify ecosystem.config.cjs"

if [ ! -f "$BOT_DIR/ecosystem.config.cjs" ]; then
  warn "ecosystem.config.cjs not found — generating a default one..."
  cat > "$BOT_DIR/ecosystem.config.cjs" << 'ECOSYSTEM'
// AA MD Bot — PM2 Ecosystem Config (auto-generated by redeploy.sh)
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
  ok "ecosystem.config.cjs generated"
else
  ok "ecosystem.config.cjs found"
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 9 — PM2 restart (or start if not running)
# --update-env picks up any changed .env variables without manual restart
# ══════════════════════════════════════════════════════════════════════════════
hdr "9. PM2 Restart"

cd "$BOT_DIR"

# Check if PM2 process already exists
if pm2 describe "$PM2_APP_NAME" &>/dev/null; then
  inf "PM2 process '$PM2_APP_NAME' found — restarting with --update-env..."
  pm2 restart "$PM2_APP_NAME" --update-env
  ok "PM2: '$PM2_APP_NAME' restarted"
  _pass "pm2" "Restarted with --update-env"
else
  inf "PM2 process '$PM2_APP_NAME' not found — starting via ecosystem.config.cjs..."
  pm2 start "$BOT_DIR/ecosystem.config.cjs"
  ok "PM2: '$PM2_APP_NAME' started"
  _pass "pm2" "Started from ecosystem.config.cjs"
fi

# Save PM2 process list so it survives reboot
pm2 save --force >/dev/null 2>&1
ok "PM2 process list saved"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 10 — Wait for dashboard (HTTP 200 on port 5000, max 90s)
# ══════════════════════════════════════════════════════════════════════════════
hdr "10. Dashboard Health Check"

inf "Waiting for bot dashboard on http://127.0.0.1:5000 (max 90s)..."

_BOT_ONLINE=false
for _i in $(seq 1 30); do
  _http=$(curl -s -o /dev/null -w '%{http_code}' \
     --max-time 3 http://127.0.0.1:5000/ 2>/dev/null || true)
  _http="${_http:-000}"
  if [[ "$_http" == "200" || "$_http" == "301" || "$_http" == "302" ]]; then
    _BOT_ONLINE=true
    ok "Dashboard online — HTTP $_http (attempt $_i/30)"
    _pass "dashboard" "Online (HTTP $_http)"
    break
  fi
  inf "  Attempt $_i/30 — HTTP $_http — waiting 3s..."
  sleep 3
done

if [[ "$_BOT_ONLINE" == "false" ]]; then
  _fail "dashboard" "Did not respond within 90 seconds"
  warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  warn "Bot did not come online within 90 seconds."
  warn "Last 30 lines of PM2 logs:"
  warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  pm2 logs "$PM2_APP_NAME" --lines 30 --nostream 2>/dev/null || true
  echo ""
  warn "Check manually: pm2 logs $PM2_APP_NAME --lines 100"
  fail "Dashboard port 5000 is not responding; redeploy failed"
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 11 — Nginx reload (if nginx is installed and running)
# Does NOT touch nginx.conf or SSL certificates
# ══════════════════════════════════════════════════════════════════════════════
hdr "11. Nginx"

if command -v nginx &>/dev/null; then
  if sudo systemctl is-active nginx &>/dev/null; then
    inf "Nginx is running — reloading (config not changed)..."
    sudo systemctl reload nginx
    ok "Nginx reloaded"
    _pass "nginx" "Reloaded"
  else
    warn "Nginx is installed but not running — skipping reload"
    warn "Start it with: sudo systemctl start nginx"
    _skip "nginx" "Not running"
  fi
else
  inf "Nginx not installed — skipping"
  _skip "nginx" "Not installed"
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 12 — Public IP + URLs (for summary display)
# ══════════════════════════════════════════════════════════════════════════════

PUBLIC_IP=$(curl -s --max-time 8 ifconfig.me 2>/dev/null \
  || curl -s --max-time 8 api.ipify.org 2>/dev/null \
  || curl -s --max-time 5 checkip.amazonaws.com 2>/dev/null \
  || hostname -I | awk '{print $1}')
PUBLIC_IP="${PUBLIC_IP// /}"

HTTP_IP_URL="http://${PUBLIC_IP}:5000"
DOMAIN="${PUBLIC_IP//./-}.nip.io"
HTTP_DOMAIN_URL="http://${DOMAIN}"

# Check if HTTPS cert exists for this domain
HTTPS_URL=""
if command -v certbot &>/dev/null; then
  if sudo certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
    HTTPS_URL="https://${DOMAIN}"
  fi
fi

ELAPSED=$(elapsed)

# ══════════════════════════════════════════════════════════════════════════════
# ✅  REDEPLOY COMPLETE — Summary
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${G}${B}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║            ✅  Redeploy Complete!                        ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${R}"

# ── Step summary table ────────────────────────────────────────────────────────
echo -e "  ${B}━━━ Deployment Summary ━━━${R}"
echo ""
for key in preflight repo git botdir env_example npm dashboard pm2 nginx; do
  if [[ -v "STEP_STATUS[$key]" ]]; then
    echo -e "  ${STEP_STATUS[$key]}"
  fi
done
echo ""

# ── URLs ──────────────────────────────────────────────────────────────────────
echo -e "  ${B}━━━ Access URLs ━━━${R}"
echo -e "  Direct IP   : ${C}${HTTP_IP_URL}${R}"
echo -e "  HTTP Domain : ${C}${HTTP_DOMAIN_URL}${R}"
if [ -n "$HTTPS_URL" ]; then
  echo -e "  HTTPS       : ${C}${HTTPS_URL}${R}"
else
  echo -e "  HTTPS       : ${DIM}(no certificate — run certbot to enable)${R}"
fi
echo ""

# ── Bot info ──────────────────────────────────────────────────────────────────
echo -e "  ${B}━━━ Bot Info ━━━${R}"
echo -e "  Directory   : ${C}${BOT_DIR}${R}"
echo -e "  Git commit  : ${C}${COMMIT_AFTER}${R}"
echo -e "  Deploy time : ${C}${ELAPSED}s${R}"
echo ""

# ── Useful commands ───────────────────────────────────────────────────────────
echo -e "  ${B}━━━ Useful Commands ━━━${R}"
echo -e "  ${DIM}pm2 logs ${PM2_APP_NAME}        ${R}← live logs"
echo -e "  ${DIM}pm2 logs ${PM2_APP_NAME} --lines 100${R}← last 100 lines"
echo -e "  ${DIM}pm2 status                 ${R}← process status"
echo -e "  ${DIM}pm2 restart ${PM2_APP_NAME}    ${R}← restart bot"
echo -e "  ${DIM}pm2 stop ${PM2_APP_NAME}         ${R}← stop bot"
echo -e "  ${DIM}bash ~/redeploy.sh         ${R}← run this script again"
echo ""

# ── PM2 current status ────────────────────────────────────────────────────────
echo -e "  ${B}━━━ PM2 Status ━━━${R}"
pm2 status 2>/dev/null || true
echo ""
