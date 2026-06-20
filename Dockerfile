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
RUN npm install --omit=dev

COPY AA-MD-Bot/ .

RUN mkdir -p session logs temp media

EXPOSE 5000

CMD ["node", "index.js"]
