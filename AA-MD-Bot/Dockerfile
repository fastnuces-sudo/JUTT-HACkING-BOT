FROM node:20-slim

# ── System dependencies ────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg curl wget git unzip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# ── yt-dlp (binary — always latest, no pip needed) ────────────────────────
RUN curl -sSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# ── Deno (required by yt-dlp for YouTube n-challenge / nsig) ──────────────
RUN curl -fsSL https://github.com/denoland/deno/releases/latest/download/deno-x86_64-unknown-linux-gnu.zip \
    -o /tmp/deno.zip \
    && unzip -o /tmp/deno.zip -d /usr/local/bin/ \
    && chmod a+rx /usr/local/bin/deno \
    && rm /tmp/deno.zip

# ── App ───────────────────────────────────────────────────────────────────
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --omit=dev --silent

COPY . .

# Writable temp dir for ffmpeg processing
RUN mkdir -p temp logs

EXPOSE 5000

# --experimental-vm-modules is required for Baileys dynamic imports
CMD ["node", "--experimental-vm-modules", "index.js"]
