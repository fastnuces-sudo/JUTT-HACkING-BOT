#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  Jutts Bot — Oracle Cloud Ubuntu 22.04 ARM64 Auto-Deploy Script
#  Bot + Neon Postgres + Nginx + Let's Encrypt — fully automatic
#
#  Fresh VM par ek hi baar chalao (ya dobara bhi — idempotent hai):
#  bash <(curl -fsSL https://raw.githubusercontent.com/fastnuces-sudo/JUTT-HACkING-BOT/main/deploy/setup.sh)
#
#  Features:
#   ✔ Oracle ARM64 (Ampere) compatible — koi x86 package nahi
#   ✔ Idempotent — safely re-run on existing deployment
#   ✔ Neon Postgres (managed cloud) — no database server on this VM
#   ✔ Nginx reverse proxy + Let's Encrypt HTTPS (nip.io domain)
#   ✔ Oracle iptables REJECT fix — only SSH/HTTP/HTTPS are exposed
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
REPO_URL="https://github.com/fastnuces-sudo/JUTT-HACkING-BOT.git"
REPO_CLONE_DIR="/home/ubuntu/JUTT-HACkING-BOT"   # git clone yahan hoga
NODE_VERSION="20"
PM2_APP_NAME="jutts-bot"
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
echo "=== Jutts Bot Deploy $(date) ===" >> "$DEPLOY_LOG"

# ── Architecture guard ────────────────────────────────────────────────────────
ARCH=$(uname -m)  # aarch64 on Oracle ARM, x86_64 on Intel
inf "Architecture detected: $ARCH"
[[ "$ARCH" == "aarch64" || "$ARCH" == "x86_64" ]] || fail "Unsupported architecture: $ARCH"

clear
echo -e "${B}${C}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║        Jutts Bot — Oracle Cloud ARM64 Auto Deploy        ║"
echo "║   Bot + Neon Postgres + Nginx + HTTPS — automatic        ║"
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
# STEP 3 — Neon Postgres (managed cloud database — nothing installed locally)
# ══════════════════════════════════════════════════════════════════════════════
hdr "3. Neon Postgres (managed)"

# The database is Neon (https://neon.tech), a serverless Postgres service, so no
# database server is installed on this VM. We only need a connection string.
#
# Resolution order:
#   1. DATABASE_URL already exported in the environment (non-interactive installs)
#   2. DATABASE_URL already present in an existing .env (reruns keep it)
#   3. Prompt the operator to paste it from the Neon Console
#
# NEON_DATABASE_URL is accepted as an alias throughout.
NEON_URL="${DATABASE_URL:-${NEON_DATABASE_URL:-}}"

_existing_env=""
for _candidate in \
  "$REPO_CLONE_DIR/AA-MD-Bot/.env" \
  "$REPO_CLONE_DIR/.env"; do
  if [ -f "$_candidate" ]; then
    _existing_env="$_candidate"
    break
  fi
done

_url_is_valid() {
  # Must be a postgres URL and must not still contain an example placeholder.
  [[ "$1" =~ ^postgres(ql)?:// ]] || return 1
  [[ "$1" == *:PASSWORD@* || "$1" == *change_this* || "$1" == *"<"* ]] && return 1
  return 0
}

if [ -z "$NEON_URL" ] && [ -n "$_existing_env" ]; then
  _existing_url=$(sed -n 's/^DATABASE_URL=//p' "$_existing_env" | head -1)
  _existing_url="${_existing_url%\"}"; _existing_url="${_existing_url#\"}"
  if _url_is_valid "$_existing_url"; then
    NEON_URL="$_existing_url"
    inf "Existing DATABASE_URL preserved from .env (safe rerun)"
  fi
fi

if [ -z "$NEON_URL" ]; then
  echo
  echo -e "  ${B}${C}Neon Postgres connection string chahiye${R}"
  echo -e "  ${DIM}1. https://console.neon.tech kholo (free tier kaafi hai)${R}"
  echo -e "  ${DIM}2. Apna project select karo → 'Connection Details'${R}"
  echo -e "  ${DIM}3. Pooled connection string copy karo (host mein '-pooler' hota hai)${R}"
  echo -e "  ${DIM}   e.g. postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/jutts_bot?sslmode=require${R}"
  echo
  # Read from the terminal even when the script itself is piped via curl.
  if [ -r /dev/tty ]; then
    read -r -p "  DATABASE_URL: " NEON_URL < /dev/tty || true
  else
    read -r -p "  DATABASE_URL: " NEON_URL || true
  fi
  NEON_URL="$(echo "$NEON_URL" | tr -d '[:space:]')"
fi

_url_is_valid "$NEON_URL" \
  || fail "Valid Neon connection string nahi mila.\n  Format: postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/dbname?sslmode=require\n  Ya pehle export karo: export DATABASE_URL='postgresql://...' aur script dobara chalao"

# Neon requires TLS; add sslmode=require when the operator omitted it.
if [[ "$NEON_URL" != *sslmode=* ]]; then
  if [[ "$NEON_URL" == *"?"* ]]; then NEON_URL="${NEON_URL}&sslmode=require"
  else NEON_URL="${NEON_URL}?sslmode=require"; fi
  inf "sslmode=require connection string mein add kiya gaya"
fi

DATABASE_URL="$NEON_URL"
export DATABASE_URL
ok "Neon Postgres connection string ready (host: $(printf '%s' "$DATABASE_URL" | sed -E 's#^postgres(ql)?://[^@]*@([^/?]+).*#\2#'))"
inf "Tables bot ke pehle start par automatically ban jayengi — koi manual SQL nahi chahiye"


# ══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Node.js 20
# ══════════════════════════════════════════════════════════════════════════════
hdr "4. Node.js ${NODE_VERSION}"
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
npm install -g npm@latest --registry="$NPM_REGISTRY" 2>/dev/null || true

# ══════════════════════════════════════════════════════════════════════════════
# STEP 5 — yt-dlp (ARM64 aware — uses the universal Python binary)
# ══════════════════════════════════════════════════════════════════════════════
hdr "5. yt-dlp"
# yt-dlp_linux is x86 only. For ARM64 we install via pip (universal).
# For x86_64 we can use the prebuilt binary directly.
if [[ "$ARCH" == "aarch64" ]]; then
  inf "ARM64 detected — installing yt-dlp via pip (universal)..."
  sudo apt-get install -yq python3-pip python3-venv >/dev/null 2>&1
  sudo pip3 install --break-system-packages -U yt-dlp 2>/dev/null \
    || sudo pip3 install -U yt-dlp 2>/dev/null \
    || { sudo apt-get install -yq python3-pip; sudo pip3 install -U yt-dlp; }
  # pip can install the module without creating /usr/local/bin/yt-dlp
  # (notably when the distro Python and pip have different script paths).
  # Resolve an existing executable first; otherwise create a stable wrapper
  # that invokes the installed universal Python module.
  YT_DLP_PATH=$(command -v yt-dlp 2>/dev/null || true)
  if [[ -z "$YT_DLP_PATH" || ! -x "$YT_DLP_PATH" ]]; then
    PYTHON_BIN=$(command -v python3 2>/dev/null || true)
    if [[ -z "$PYTHON_BIN" ]] || ! "$PYTHON_BIN" -c 'import yt_dlp' >/dev/null 2>&1; then
      fail "yt-dlp Python module install hua lekin import nahi ho raha"
    fi
    sudo tee /usr/local/bin/yt-dlp > /dev/null <<YTDLP_WRAPPER
#!/usr/bin/env bash
exec "$PYTHON_BIN" -m yt_dlp "\$@"
YTDLP_WRAPPER
    YT_DLP_PATH="/usr/local/bin/yt-dlp"
  elif [[ "$YT_DLP_PATH" != "/usr/local/bin/yt-dlp" ]]; then
    sudo ln -sf "$YT_DLP_PATH" /usr/local/bin/yt-dlp
    YT_DLP_PATH="/usr/local/bin/yt-dlp"
  fi
else
  inf "x86_64 detected — installing yt-dlp prebuilt binary..."
  YT_DLP_PATH="/usr/local/bin/yt-dlp"
  sudo curl -sSL \
    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" \
    -o /usr/local/bin/yt-dlp
fi

if [[ ! -f "$YT_DLP_PATH" ]]; then
  fail "yt-dlp executable create nahi hua: $YT_DLP_PATH"
fi
sudo chmod a+rx "$YT_DLP_PATH"
if [[ "$YT_DLP_PATH" != "/usr/local/bin/yt-dlp" ]]; then
  sudo ln -sf "$YT_DLP_PATH" /usr/local/bin/yt-dlp
fi
command -v yt-dlp >/dev/null 2>&1 \
  || fail "yt-dlp PATH par available nahi hai"
YT_DLP_VERSION=$(yt-dlp --version 2>/dev/null || true)
[[ -n "$YT_DLP_VERSION" ]] \
  || fail "yt-dlp installed hai lekin execute nahi ho raha"
ok "yt-dlp ready ($YT_DLP_VERSION)"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 6 — Deno (ARM64 aware)
# ══════════════════════════════════════════════════════════════════════════════
hdr "6. Deno (YouTube n-challenge / nsig)"
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
# STEP 7 — PM2 (install or update)
# ══════════════════════════════════════════════════════════════════════════════
hdr "7. PM2 (Process Manager)"
if command -v pm2 &>/dev/null; then
  inf "PM2 already installed — updating to latest..."
  sudo npm install -g pm2@latest --registry="$NPM_REGISTRY" 2>/dev/null || true
else
  inf "PM2 install ho raha hai..."
  sudo npm install -g pm2@latest --registry="$NPM_REGISTRY"
fi
ok "PM2 $(pm2 --version 2>/dev/null || echo 'installed') ready"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 8 — Bot Code (git pull or clone)
# ══════════════════════════════════════════════════════════════════════════════
hdr "8. Bot Code"
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
# STEP 9 — Auto-detect Bot Directory
# package.json sometimes at:  AA-MD-Bot/package.json
# and sometimes at:           AA-MD-Bot/AA-MD-Bot/package.json
# ══════════════════════════════════════════════════════════════════════════════
hdr "9. Bot Directory Detection"

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
# STEP 10 — npm install (with registry fix + auto-retry on failure)
# ══════════════════════════════════════════════════════════════════════════════
hdr "10. Node.js Packages"
cd "$BOT_DIR"

# Install exactly the dependency graph committed in package-lock.json.
npm config set registry "$NPM_REGISTRY"
ok "npm registry set: $NPM_REGISTRY"
rm -rf node_modules

_npm_install() {
  if [ -f "$BOT_DIR/package-lock.json" ]; then
    timeout 600 npm ci --omit=dev --registry="$NPM_REGISTRY" --no-audit --no-fund
  else
    timeout 600 npm install --omit=dev --registry="$NPM_REGISTRY" --no-audit --no-fund
  fi
}

inf "Dependencies install ho rahi hain (lockfile se reproducible install)..."
if ! _npm_install; then
  warn "Dependency install failed — npm cache verify karke ek baar retry..."
  npm cache verify >/dev/null 2>&1 || true
  rm -rf node_modules
  _npm_install || fail "npm install second attempt bhi fail hua — logs check karo: $DEPLOY_LOG"
fi
ok "Node.js packages installed"

# Fail early when a required runtime dependency is genuinely unavailable.
for pkg in fs-extra axios @whiskeysockets/baileys sharp node-webpmux; do
  node -e "require.resolve('${pkg}')" >/dev/null 2>&1 \
    || fail "Required dependency resolve nahi hui: ${pkg}"
done
ok "Critical dependencies verified"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 11 — Required Bot Directories
# ══════════════════════════════════════════════════════════════════════════════
hdr "11. Bot Directories"
mkdir -p "$BOT_DIR"/{logs,temp,session,downloads,database,cache}
sudo chown -R ubuntu:ubuntu "$BOT_DIR"
ok "Bot directories ready: logs temp session downloads database cache"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 12 — Public IP + Domain
# ══════════════════════════════════════════════════════════════════════════════
hdr "12. Public IP + Domain"
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
# STEP 13 — .env Configuration (merge — never overwrite user values)
# ══════════════════════════════════════════════════════════════════════════════
hdr "13. .env Configuration"

# DATABASE_URL was resolved and validated in step 3 (Neon Postgres).

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
GENERATED_DASHBOARD_TOKEN=$(openssl rand -hex 32)

if [ ! -f "$ENV_FILE" ]; then
  # Fresh .env — create it
  cat > "$ENV_FILE" << EOF
# ══════════════════════════════════════════════════════════════
#  Jutts Bot — Auto-generated on $(date '+%Y-%m-%d %H:%M:%S')
#  IMPORTANT: DATABASE_URL, SESSION_SECRET aur DASHBOARD_TOKEN private rakho!
# ══════════════════════════════════════════════════════════════

# ── Server ────────────────────────────────────────────────────
PORT=5000
HOST=127.0.0.1
SERVER_ID=server-1

# ── Database — Neon Postgres (managed cloud) ─────────────────
DATABASE_URL=${DATABASE_URL}

# ── Security — auto-generated ─────────────────────────────────
SESSION_SECRET=$(openssl rand -hex 32)
DASHBOARD_TOKEN=${GENERATED_DASHBOARD_TOKEN}

# ── Optional — fill in later if needed ────────────────────────
# SUPER_OWNER=                 # first linked number is used when blank
# OWNER_NUMBERS=               # comma-separated international numbers
# TELEGRAM_BOT_TOKEN=          # @BotFather se lena
# TELEGRAM_ADMIN_ID=            # your numeric Telegram user ID
# TELEGRAM_PUBLIC_PAIRING=false # secure default
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
  # npm's prepare hook or a manual copy may have left the example placeholders
  # in place. Replace only those placeholders; preserve all real user values.
  # Replace only an empty/example placeholder. Preserve a real Neon URL (or any
  # other Postgres URL) that the operator configured intentionally.
  _current_url=$(sed -n 's/^DATABASE_URL=//p' "$ENV_FILE" | head -1)
  if [[ -z "$_current_url" || "$_current_url" == *:PASSWORD@* || "$_current_url" == *change_this* ]]; then
    if grep -q '^DATABASE_URL=' "$ENV_FILE"; then
      sed -i "s#^DATABASE_URL=.*#DATABASE_URL=${DATABASE_URL}#" "$ENV_FILE"
    else
      echo "DATABASE_URL=${DATABASE_URL}" >> "$ENV_FILE"
    fi
    ok ".env: DATABASE_URL placeholder replaced with the Neon connection string"
  fi
  # A leftover MongoDB URI from an older deployment is now unused — drop it so
  # nobody mistakes it for live configuration.
  if grep -q '^MONGODB_URI=' "$ENV_FILE"; then
    sed -i '/^MONGODB_URI=/d;/^MONGODB_DB=/d' "$ENV_FILE"
    ok ".env: obsolete MONGODB_URI removed (bot ab Neon Postgres use karta hai)"
  fi
  if grep -q '^SESSION_SECRET=change_this_to_a_random_64_char_string$' "$ENV_FILE"; then
    sed -i "s#^SESSION_SECRET=.*#SESSION_SECRET=$(openssl rand -hex 32)#" "$ENV_FILE"
    ok ".env: placeholder SESSION_SECRET replaced with generated secret"
  fi
  # Merge only keys that are missing
  _env_merge "PORT"            "5000"             "$ENV_FILE"
  _env_merge "HOST"            "127.0.0.1"        "$ENV_FILE"
  _env_merge "SERVER_ID"       "server-1"         "$ENV_FILE"
  _env_merge "DATABASE_URL"    "$DATABASE_URL"    "$ENV_FILE"
  _env_merge "SESSION_SECRET"  "$(openssl rand -hex 32)" "$ENV_FILE"
  _env_merge "DASHBOARD_TOKEN" "$GENERATED_DASHBOARD_TOKEN" "$ENV_FILE"
fi

# Empty/placeholder dashboard tokens are unsafe on an internet-facing VM.
if ! grep -Eq '^DASHBOARD_TOKEN=[A-Za-z0-9_-]{32,}$' "$ENV_FILE"; then
  sed -i '/^DASHBOARD_TOKEN=/d' "$ENV_FILE"
  echo "DASHBOARD_TOKEN=${GENERATED_DASHBOARD_TOKEN}" >> "$ENV_FILE"
  ok ".env: secure DASHBOARD_TOKEN generated"
fi
DASHBOARD_TOKEN=$(sed -n 's/^DASHBOARD_TOKEN=//p' "$ENV_FILE" | head -1)

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
    read -r -t 30 -p "  TELEGRAM_ADMIN_ID (numeric ID, Enter to skip): " TELEGRAM_ADMIN_ID || true
    if [[ "${TELEGRAM_ADMIN_ID:-}" =~ ^[0-9]+$ ]]; then
      _env_merge "TELEGRAM_ADMIN_ID" "$TELEGRAM_ADMIN_ID" "$ENV_FILE"
      _env_merge "TELEGRAM_PUBLIC_PAIRING" "false" "$ENV_FILE"
    fi
    read -r -t 30 -p "  TELEGRAM_FEATURES_BOT_TOKEN (Enter to skip): " TELEGRAM_FEATURES_BOT_TOKEN || true
    [ -n "$TELEGRAM_FEATURES_BOT_TOKEN" ] && \
      _env_merge "TELEGRAM_FEATURES_BOT_TOKEN" "$TELEGRAM_FEATURES_BOT_TOKEN" "$ENV_FILE"
  fi
fi
echo ""
ok ".env configuration complete"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 14 — ecosystem.config.cjs (always write fresh — never keep old)
# Why: repo version uses complex dotenv-at-ecosystem-load that can fail silently.
# Setup.sh version uses env_file (PM2 native) + absolute path → always reliable.
# ══════════════════════════════════════════════════════════════════════════════
hdr "14. PM2 Ecosystem Config"
ECOSYSTEM_FILE="$BOT_DIR/ecosystem.config.cjs"
LOGS_DIR="$BOT_DIR/logs"

inf "ecosystem.config.cjs fresh likh rahe hain (dotenv explicit load — PM2 v7 env_file workaround)..."
cat > "$ECOSYSTEM_FILE" << ECOSYSTEM
// Jutts Bot — PM2 Ecosystem Config
// Auto-written by setup.sh — safe to re-run anytime
// Uses dotenv explicitly at ecosystem load time — reliable on PM2 v7.x
// (PM2 v7.0.3 ka env_file option process config mein sirf reference store karta hai
//  lekin actual key-value pairs environment mein load nahi hoti — isliye dotenv use karo)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const BOT_DIR = __dirname;

// .env se saare variables load hue — spread karo env block mein
let _dotenvVars = {};
try {
  const _r = require('dotenv').config({ path: path.join(__dirname, '.env') });
  if (_r.parsed) _dotenvVars = _r.parsed;
} catch {}

module.exports = {
  apps: [{
    name        : 'jutts-bot',
    script      : path.join(BOT_DIR, 'index.js'),
    cwd         : BOT_DIR,
    interpreter : 'node',

    // Restart policy
    instances     : 1,
    autorestart   : true,
    watch         : false,
    max_restarts  : 10,
    restart_delay : 5000,
    min_uptime    : '30s',

    // Memory guard
    max_memory_restart: '1500M',

    // Logs — absolute paths
    log_date_format : 'YYYY-MM-DD HH:mm:ss',
    out_file        : path.join(BOT_DIR, 'logs', 'pm2-out.log'),
    error_file      : path.join(BOT_DIR, 'logs', 'pm2-err.log'),
    merge_logs      : true,

    // All .env vars explicitly spread — process.env mein sab kuch milega
    env: {
      NODE_ENV  : 'production',
      PORT      : _dotenvVars.PORT      || '5000',
      HOST      : _dotenvVars.HOST      || '127.0.0.1',
      SERVER_ID : _dotenvVars.SERVER_ID || 'server-1',
      ..._dotenvVars,
    },
  }],
};
ECOSYSTEM
ok "ecosystem.config.cjs written ($(wc -l < "$ECOSYSTEM_FILE") lines)"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 15 — Oracle Cloud iptables Fix
# Oracle images have a REJECT rule that blocks public web ports.
# We expose Nginx only; the Node dashboard remains on 127.0.0.1:5000.
# ══════════════════════════════════════════════════════════════════════════════
hdr "15. Oracle Cloud iptables Fix"

_iptables_allow_port() {
  local PORT="$1" PROTO="${2:-tcp}"
  # Check if ACCEPT rule already exists
  if sudo iptables -C INPUT -p "$PROTO" --dport "$PORT" -j ACCEPT &>/dev/null; then
    inf "iptables: port $PORT already ACCEPT — skip"
    return
  fi

  # Find the REJECT rule line number (insert BEFORE it)
  # || true : grep exits 1 when no match — under set -Eeuo pipefail this kills the script
  REJECT_LINE=$(sudo iptables -L INPUT --line-numbers -n 2>/dev/null \
    | grep -E '\bREJECT\b' | awk '{print $1}' | head -1 || true)

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
# Remove a legacy public-dashboard rule from earlier versions of this script.
while sudo iptables -C INPUT -p tcp --dport 5000 -j ACCEPT &>/dev/null; do
  sudo iptables -D INPUT -p tcp --dport 5000 -j ACCEPT
done

# Save iptables rules permanently
inf "iptables rules save ho rahi hain (netfilter-persistent)..."
sudo netfilter-persistent save >/dev/null 2>&1 \
  || { sudo iptables-save | sudo tee /etc/iptables/rules.v4 > /dev/null; \
       ok "iptables rules saved to /etc/iptables/rules.v4"; }
ok "iptables rules permanently saved"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 16 — UFW Firewall
# Allow SSH/HTTP/HTTPS; keep the Node.js port off the internet
# ══════════════════════════════════════════════════════════════════════════════
hdr "16. UFW Firewall"
# Do not reset UFW on reruns; preserve unrelated operator-managed firewall rules.
sudo ufw default deny incoming  >/dev/null
sudo ufw default allow outgoing >/dev/null
sudo ufw allow 22/tcp   comment 'SSH'   >/dev/null
sudo ufw allow 80/tcp   comment 'HTTP'  >/dev/null
sudo ufw allow 443/tcp  comment 'HTTPS' >/dev/null
# Port 5000 (Node) intentionally remains private — Nginx proxies to it.
sudo ufw --force enable >/dev/null
ok "UFW: SSH(22) HTTP(80) HTTPS(443) open | Node(5000) private"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 17 — Nginx Configuration (fully idempotent, assumes nothing exists)
# ══════════════════════════════════════════════════════════════════════════════
hdr "17. Nginx Configuration"

NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${DOMAIN}"

# ── 1. Ensure nginx binary is present ────────────────────────────────────────
if ! command -v nginx &>/dev/null; then
  inf "nginx install ho raha hai..."
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -yq nginx nginx-common nginx-core
  ok "nginx installed"
fi

# ── 2. Ensure nginx-common is installed (it owns mime.types and nginx.conf) ──
# Reinstalling nginx (meta-package) does NOT restore these files — nginx-common does.
if [ ! -f /etc/nginx/mime.types ]; then
  inf "mime.types missing — nginx-common reinstall kar rahe hain..."
  sudo DEBIAN_FRONTEND=noninteractive apt-get install --reinstall -yq nginx-common
  ok "nginx-common reinstalled"
fi

# ── 3. If mime.types STILL missing, generate a minimal one ───────────────────
if [ ! -f /etc/nginx/mime.types ]; then
  inf "mime.types still missing — generating minimal mime.types..."
  sudo tee /etc/nginx/mime.types > /dev/null << 'MIMETYPES'
types {
    text/html                             html htm shtml;
    text/css                              css;
    text/xml                              xml;
    image/gif                             gif;
    image/jpeg                            jpeg jpg;
    application/javascript                js;
    application/json                      json;
    image/png                             png;
    image/svg+xml                         svg svgz;
    image/webp                            webp;
    font/woff                             woff;
    font/woff2                            woff2;
    application/octet-stream              bin exe dll;
    audio/mpeg                            mp3;
    video/mp4                             mp4;
    video/webm                            webm;
    application/zip                       zip;
}
MIMETYPES
  ok "mime.types generated"
fi

# ── 4. Ensure all required directories exist ─────────────────────────────────
sudo mkdir -p /etc/nginx/sites-available \
              /etc/nginx/sites-enabled \
              /etc/nginx/conf.d \
              /etc/nginx/modules-enabled \
              /var/log/nginx

# ── 5. Generate nginx.conf if missing ────────────────────────────────────────
if [ ! -f /etc/nginx/nginx.conf ]; then
  inf "nginx.conf missing — generating..."
  sudo tee /etc/nginx/nginx.conf > /dev/null << 'MAINNGINX'
user www-data;
worker_processes auto;
pid /run/nginx.pid;

events {
    worker_connections 768;
    multi_accept on;
}

http {
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;
    gzip on;
    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
MAINNGINX
  ok "nginx.conf generated"
fi

# ── 6. Ensure sites-enabled is included in nginx.conf ────────────────────────
if ! sudo grep -q 'sites-enabled' /etc/nginx/nginx.conf 2>/dev/null; then
  inf "nginx.conf: sites-enabled include add kar rahe hain..."
  echo "    include /etc/nginx/sites-enabled/*;" \
    | sudo tee -a /etc/nginx/nginx.conf > /dev/null
  ok "sites-enabled include added"
fi

# ── 7. Remove default site ────────────────────────────────────────────────────
sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

# ── 8. Write site config ──────────────────────────────────────────────────────
sudo tee "$NGINX_CONF" > /dev/null << NGINXCONF
# Jutts Bot — Nginx reverse proxy for ${DOMAIN}
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location = /events {
        proxy_pass         http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host              \$host;
        proxy_set_header X-Real-IP         \$remote_addr;
        proxy_set_header X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 1h;
    }

    location / {
        proxy_pass         http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host             \$host;
        proxy_set_header X-Real-IP        \$remote_addr;
        proxy_set_header X-Forwarded-For  \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_connect_timeout  60s;
        proxy_send_timeout     60s;
        proxy_read_timeout     60s;
    }

    client_max_body_size 64K;
}
NGINXCONF

# ── 9. Create symlink ─────────────────────────────────────────────────────────
sudo ln -sf "$NGINX_CONF" "$NGINX_ENABLED"
ok "Nginx site config created: $NGINX_CONF"

# ── 10. Test — abort ONLY if nginx -t fails ───────────────────────────────────
inf "Nginx config test..."
NGINX_TEST_OUT=$(sudo nginx -t 2>&1 || true)
echo "$NGINX_TEST_OUT" | while IFS= read -r line; do inf "$line"; done
if echo "$NGINX_TEST_OUT" | grep -q 'failed'; then
  fail "nginx -t failed — config fix karo phir dobara run karo"
fi
ok "Nginx config valid"

# ── 11. Enable and start ──────────────────────────────────────────────────────
sudo systemctl enable nginx >/dev/null
sudo systemctl restart nginx
ok "Nginx running and enabled"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 18 — PM2 Start Bot
# (Start bot BEFORE certbot so certbot can verify port 80)
# ══════════════════════════════════════════════════════════════════════════════
hdr "18. Bot Start (PM2)"
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
# STEP 19 — Wait for Port 5000 (HTTP 200)
# ══════════════════════════════════════════════════════════════════════════════
hdr "19. Waiting for Bot (port 5000)"
inf "Bot ke ready hone ka wait kar rahe hain (max 90s)..."

_PORT_READY=false
for i in $(seq 1 30); do
  HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' \
    --max-time 3 http://127.0.0.1:5000/healthz 2>/dev/null || true)
  HTTP_CODE="${HTTP_CODE:-000}"
  if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "301" || "$HTTP_CODE" == "302" ]]; then
    _PORT_READY=true
    ok "Bot ready! HTTP $HTTP_CODE on port 5000 (attempt $i)"
    break
  fi
  inf "Attempt $i/30 — HTTP $HTTP_CODE — 3 seconds wait..."
  sleep 3
done

if [[ "$_PORT_READY" == "false" ]]; then
  # WARNING only — never stop deploy because of port check
  # Bot may still be loading sessions / connecting to Neon Postgres
  warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  warn "Bot 90 seconds mein port 5000 pe respond nahi kiya."
  warn "Deployment JAARI RAHEGA — certbot skip hoga agar port down hai."
  warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  inf "Last 30 PM2 log lines:"
  pm2 logs "$PM2_APP_NAME" --lines 30 --nostream 2>/dev/null || true
  inf "Debug: pm2 logs $PM2_APP_NAME --lines 100"
fi

# ══════════════════════════════════════════════════════════════════════════════
# STEP 20 — Let's Encrypt HTTPS (via certbot)
# Uses nip.io domain — no DNS config needed
# If certbot fails, bot still works over HTTP
# ══════════════════════════════════════════════════════════════════════════════
hdr "20. Let's Encrypt HTTPS"
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
  warn "Bot HTTP par kaam karta rahega: http://${DOMAIN}"
  warn "HTTPS baad mein manually add karo: sudo certbot --nginx -d $DOMAIN"
fi

# Reload nginx after certbot (certbot modifies nginx config)
sudo nginx -t >/dev/null 2>&1 && sudo systemctl reload nginx 2>/dev/null || true

# ══════════════════════════════════════════════════════════════════════════════
# STEP 21 — Generate redeploy.sh
# ══════════════════════════════════════════════════════════════════════════════
hdr "21. redeploy.sh"
REDEPLOY_SCRIPT="/home/ubuntu/redeploy.sh"

if [ ! -f "$BOT_DIR/deploy/redeploy.sh" ]; then
  fail "Maintained deploy/redeploy.sh repository mein nahi mili"
fi
cp "$BOT_DIR/deploy/redeploy.sh" "$REDEPLOY_SCRIPT"
chmod +x "$REDEPLOY_SCRIPT"
chmod 600 "$ENV_FILE"
chown ubuntu:ubuntu "$REDEPLOY_SCRIPT"
ok "redeploy.sh created: $REDEPLOY_SCRIPT"

# ══════════════════════════════════════════════════════════════════════════════
# STEP 22 — Final Status Check
# ══════════════════════════════════════════════════════════════════════════════
hdr "22. Final Status"
inf "PM2 status..."
pm2 status 2>/dev/null || true

inf "Nginx status..."
sudo systemctl is-active nginx &>/dev/null && ok "Nginx: running" || warn "Nginx: not running"

inf "Neon Postgres reachability..."
if node -e '
  const { Client } = require("pg");
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true }, connectionTimeoutMillis: 15000 });
  c.connect().then(() => c.query("select 1")).then(() => c.end()).then(() => process.exit(0)).catch(() => process.exit(1));
' --input-type=commonjs 2>/dev/null; then
  ok "Neon Postgres: reachable"
else
  warn "Neon Postgres: not reachable — DATABASE_URL aur Neon project status check karo"
fi

ELAPSED=$(elapsed)

# ══════════════════════════════════════════════════════════════════════════════
# ✅  DEPLOY COMPLETE — Summary
# ══════════════════════════════════════════════════════════════════════════════
HTTP_DOMAIN_URL="http://${DOMAIN}"
HTTPS_URL_DISPLAY="${HTTPS_URL:-"(certbot failed — HTTP only)"}"
DASHBOARD_BASE_URL="${HTTPS_URL:-$HTTP_DOMAIN_URL}"
# URL fragments are not sent to web-server access logs. The login page exchanges
# this token for a signed HttpOnly cookie.
DASHBOARD_URL="${DASHBOARD_BASE_URL}/#token=${DASHBOARD_TOKEN}"

echo ""
echo -e "${G}${B}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║              ✅  Jutts Bot — Deploy Complete!            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${R}"

echo -e "  ${B}━━━ Access URLs ━━━${R}"
echo -e "  Dashboard     : ${C}${DASHBOARD_URL}${R}"
echo -e "  HTTP Domain   : ${C}${HTTP_DOMAIN_URL}${R}"
echo -e "  HTTPS         : ${C}${HTTPS_URL_DISPLAY}${R}"
echo -e "  Health check  : ${C}${DASHBOARD_BASE_URL}/healthz${R}"
echo ""

echo -e "  ${B}━━━ Database (Neon Postgres) ━━━${R}"
echo -e "  Provider      : Neon — https://console.neon.tech"
MASKED_DATABASE_URL=$(printf '%s' "$DATABASE_URL" \
  | sed -E 's#(postgres(ql)?://[^:]+:)[^@]+@#\1********@#')
echo -e "  URL           : ${C}${MASKED_DATABASE_URL}${R}"
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
echo -e "  ${DIM}sudo systemctl status nginx ${R}← Nginx status"
echo -e "  ${DIM}sudo tail -f /var/log/nginx/error.log${R}← Nginx logs"
echo ""

echo -e "  ${B}━━━ WhatsApp Pairing ━━━${R}"
echo -e "  1. Browser mein protected URL kholo:"
echo -e "     ${C}${DASHBOARD_URL}${R}"
echo -e "  2. Phone number enter karo (with country code, e.g. 923XXXXXXXXX)"
echo -e "  3. ${B}Get Pairing Code${R} click karo"
echo -e "  4. WhatsApp → Settings → Linked Devices → Link with phone number"
echo -e "  5. 8-digit code enter karo — ho gaya ✅"
echo ""

echo -e "  ${Y}⚠  DATABASE_URL, SESSION_SECRET aur DASHBOARD_TOKEN .env mein private rakho.${R}"
echo -e "  ${DIM}   sudo chmod 600 ${ENV_FILE}${R}"
echo ""
echo -e "  ${DIM}Total deploy time: ${ELAPSED}s${R}"
echo ""
