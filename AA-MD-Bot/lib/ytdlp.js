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

// Resolve Deno binary for yt-dlp's JS challenge solver (nsig/"n" parameter).
// IMPORTANT: yt-dlp's JS challenge engine (EJS) only supports Deno right now —
// Node.js (even v20/v22) is explicitly marked "unsupported" by yt-dlp's own
// runtime check. Without a working JS runtime, YouTube serves ONLY storyboard
// (mhtml) formats for many videos — no audio/video streams at all. This is
// what caused "all sources returned error" for real-world/less-popular videos.
function resolveDeno() {
  const candidates = [
    `${process.env.HOME || '/home/runner'}/.deno/bin/deno`, // installed via deno.land/install.sh
    '/usr/local/bin/deno',
    '/usr/bin/deno',
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return 'deno'; // fallback: rely on PATH
}

// Common flags for all yt-dlp invocations:
// --js-runtimes deno:PATH → required for YouTube's "n" challenge (nsig) —
//   without this, only images/storyboards are returned for many videos.
// --no-check-certificate  → skip SSL issues in sandboxed environments
const _denoPath = resolveDeno();
export const YTDLP_FLAGS = `--js-runtimes "deno:${_denoPath}" --no-check-certificate`;

// Returns --cookies flag string if cookies.txt exists, else empty string
const COOKIES_PATH = path.join(__dirname, '..', 'cookies.txt');
export function getCookiesFlag() {
  return existsSync(COOKIES_PATH) ? `--cookies "${COOKIES_PATH}"` : '';
}
export { COOKIES_PATH };
