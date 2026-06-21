FROM node:20-slim

# ── System dependencies ────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    wget \
  && pip3 install yt-dlp --break-system-packages \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# ── Bot directory ──────────────────────────────────────────────────────────────
WORKDIR /bot

# Copy package.json first (layer caching: only re-run npm install when deps change)
COPY AA-MD-Bot/package.json ./

# Install ALL dependencies directly inside /bot/node_modules
# This is the only reliable approach — root /node_modules breaks ESM resolution
RUN npm install --omit=dev --no-audit --no-fund --prefer-offline 2>/dev/null || \
    npm install --omit=dev --no-audit --no-fund

# ── Copy bot source code ───────────────────────────────────────────────────────
COPY AA-MD-Bot/ .

# Create runtime dirs (session, temp, logs persist via Railway Volume if configured)
RUN mkdir -p session temp logs media

# ── Runtime ───────────────────────────────────────────────────────────────────
EXPOSE 5000

# Health check (Railway uses this to detect crashes)
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -fs http://localhost:5000/api/healthz || exit 1

CMD ["node", "index.js"]
