FROM node:20-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    --no-install-recommends \
    && pip3 install yt-dlp --break-system-packages \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /bot
COPY AA-MD-Bot/package.json AA-MD-Bot/package-lock.json ./

# Pre-populate npm cache during build so runtime install is fast (~15s offline)
RUN npm install --omit=dev && rm -rf node_modules

COPY AA-MD-Bot/ .
RUN mkdir -p session logs temp media

# At runtime: volume mounts happen before CMD.
# If node_modules missing (wiped by volume), reinstall from cache silently.
CMD ["sh", "-c", "[ ! -d node_modules ] && npm install --omit=dev --prefer-offline --no-audit --silent; node index.js"]
