FROM node:20-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    --no-install-recommends \
    && pip3 install yt-dlp --break-system-packages \
    && rm -rf /var/lib/apt/lists/*

# Install to /node_modules at container ROOT level
# Node.js walks UP from /bot/index.js → checks /bot/node_modules/ → checks /node_modules/
# Volume can only ever reach /bot/... paths, never /node_modules/ at root
WORKDIR /tmp/install
COPY AA-MD-Bot/package.json AA-MD-Bot/package-lock.json ./
RUN npm install --omit=dev && cp -r node_modules /node_modules && rm -rf /tmp/install

WORKDIR /bot
COPY AA-MD-Bot/ .
RUN mkdir -p session logs temp media

EXPOSE 5000

CMD ["node", "index.js"]
