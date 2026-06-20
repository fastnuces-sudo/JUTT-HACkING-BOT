FROM node:20-slim

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    --no-install-recommends \
    && pip3 install yt-dlp --break-system-packages \
    && rm -rf /var/lib/apt/lists/*

# Install node_modules OUTSIDE /app so volume mounts cannot wipe them
WORKDIR /install
COPY AA-MD-Bot/package.json AA-MD-Bot/package-lock.json ./
RUN npm install --omit=dev && mv node_modules /node_modules

WORKDIR /app
COPY AA-MD-Bot/ .

# Symlink so Node.js resolves modules normally from /app
RUN ln -s /node_modules /app/node_modules

EXPOSE 5000

CMD ["node", "index.js"]
