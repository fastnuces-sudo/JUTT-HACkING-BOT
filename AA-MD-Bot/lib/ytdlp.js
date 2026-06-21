import { existsSync } from 'fs';

// Resolve yt-dlp binary path once — works on Replit, Railway, VPS, Docker
const CANDIDATES = [
  '/home/runner/.local/bin/yt-dlp',   // Replit
  '/usr/local/bin/yt-dlp',            // pip install (Railway/Docker/VPS)
  '/usr/bin/yt-dlp',                   // system package
  '/opt/homebrew/bin/yt-dlp',         // macOS Homebrew
];

function resolveYtdlp() {
  for (const p of CANDIDATES) {
    if (existsSync(p)) return p;
  }
  return 'yt-dlp'; // fallback: rely on PATH
}

export const YTDLP = resolveYtdlp();
