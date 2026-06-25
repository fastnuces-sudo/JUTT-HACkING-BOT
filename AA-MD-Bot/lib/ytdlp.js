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

// Resolve Node.js binary for yt-dlp JS extraction engine
function resolveNode() {
  const candidates = [
    process.execPath,                                                    // current Node process
    '/nix/store/1lagpgadaybvs1n2312gysg2phjk89y8-nodejs-20.20.0-wrapped/bin/node',
    '/usr/local/bin/node',
    '/usr/bin/node',
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return 'node';
}

// Common flags for all yt-dlp invocations:
// --js-runtimes node:PATH → use Node.js for JS extraction (proper YouTube support)
// --no-check-certificate  → skip SSL issues in sandboxed environments
const _nodePath = resolveNode();
export const YTDLP_FLAGS = `--js-runtimes "node:${_nodePath}" --no-check-certificate`;

// Returns --cookies flag string if cookies.txt exists, else empty string
const COOKIES_PATH = path.join(__dirname, '..', 'cookies.txt');
export function getCookiesFlag() {
  return existsSync(COOKIES_PATH) ? `--cookies "${COOKIES_PATH}"` : '';
}
export { COOKIES_PATH };
