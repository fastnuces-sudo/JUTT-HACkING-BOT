FROM node:20-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    --no-install-recommends \
    && pip3 install yt-dlp --break-system-packages \
    && rm -rf /var/lib/apt/lists/*

# Install node_modules to /pkg — completely outside /bot so volumes cannot touch them
WORKDIR /pkg
COPY AA-MD-Bot/package.json AA-MD-Bot/package-lock.json ./
RUN npm install --omit=dev

WORKDIR /bot
COPY AA-MD-Bot/ .
RUN mkdir -p session logs temp media

# At startup: volumes mount BEFORE CMD runs.
# If /bot/node_modules was wiped by a volume, symlink it back from /pkg instantly.
CMD ["sh", "-c", "[ ! -d /bot/node_modules ] && ln -s /pkg/node_modules /bot/node_modules; node index.js"]
