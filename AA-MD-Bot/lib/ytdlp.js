import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// Returns --cookies flag string if cookies.txt exists, else empty string
const COOKIES_PATH = path.join(__dirname, '..', 'cookies.txt');
export function getCookiesFlag() {
  return existsSync(COOKIES_PATH) ? `--cookies "${COOKIES_PATH}"` : '';
}
export { COOKIES_PATH };
