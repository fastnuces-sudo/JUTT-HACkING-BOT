# ══════════════════════════════════════════════════════════════════════════════
#  Jutts Bot — container image (Render, Fly.io, Railway, any Docker host)
#
#  Render's native Node runtime cannot install system packages, and this bot
#  shells out to ffmpeg, yt-dlp and deno for media/download commands. Docker is
#  therefore the supported way to deploy with every feature working.
# ══════════════════════════════════════════════════════════════════════════════
FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    DEBIAN_FRONTEND=noninteractive \
    DENO_INSTALL=/usr/local \
    # yt-dlp writes a cache; keep it inside the writable app dir.
    XDG_CACHE_HOME=/app/cache

WORKDIR /app

# ── System dependencies ───────────────────────────────────────────────────────
# ffmpeg  : sticker/audio/video conversion
# python3 : required by yt-dlp
# unzip/curl/ca-certificates : fetching yt-dlp + deno
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      python3 \
      curl \
      unzip \
      ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# ── yt-dlp (standalone binary — no pip, works on arm64 and amd64) ─────────────
RUN curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
      -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp \
 && yt-dlp --version

# ── Deno (needed for YouTube's nsig/n-challenge; without it yt-dlp silently
#    returns storyboard-only formats for real videos) ───────────────────────────
RUN curl -fsSL https://deno.land/install.sh | sh -s -- --yes \
 && deno --version

# ── App dependencies (cached layer — only re-runs when lockfile changes) ──────
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Application code ──────────────────────────────────────────────────────────
COPY . .

# Runtime scratch dirs. Auth/settings live in Neon, so these stay disposable —
# nothing here needs to survive a restart.
RUN mkdir -p logs temp session downloads database cache

# Render injects PORT; this is only the local/default value.
ENV PORT=5000 \
    HOST=0.0.0.0
EXPOSE 5000

# Run as the unprivileged user that the node image already provides.
RUN chown -R node:node /app
USER node

CMD ["node", "index.js"]
