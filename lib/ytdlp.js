import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve yt-dlp binary path — works on Replit, Heroku, Railway, VPS, Docker
const CANDIDATES = [
  '/home/runner/.local/bin/yt-dlp',   // Replit (workflow installs here)
  '/usr/local/bin/yt-dlp',            // Docker / VPS binary
  '/usr/bin/yt-dlp',                  // system package
  '/opt/homebrew/bin/yt-dlp',         // macOS Homebrew
];

function resolveYtdlp() {
  for (const p of CANDIDATES) {
    if (existsSync(p)) return p;
  }
  return 'yt-dlp'; // fallback: rely on PATH
}

export const YTDLP = resolveYtdlp();

// Resolve Deno binary — yt-dlp's JS challenge engine (EJS) requires Deno.
// Without it, YouTube serves ONLY storyboard (mhtml) formats for many videos.
// Node.js is explicitly "unsupported" by yt-dlp's own runtime check.
function resolveDeno() {
  const candidates = [
    `${process.env.HOME || '/home/runner'}/.deno/bin/deno`, // deno.land/install.sh
    '/usr/local/bin/deno',   // Docker / VPS
    '/usr/bin/deno',
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return 'deno'; // fallback: rely on PATH
}

const _denoPath = resolveDeno();

// ── Common yt-dlp flags ───────────────────────────────────────────────────────
// --js-runtimes          → Deno for YouTube n-challenge (nsig) — required
// --no-check-certificate → skip SSL issues in sandboxed/proxy environments
// --socket-timeout 30    → don't hang forever on blocked connections
// --retries 2            → retry transient network errors, then fall to next source
// --fragment-retries 2   → retry failed fragments in DASH streams
// --no-warnings          → suppress non-error output (logged by bot separately)
export const YTDLP_FLAGS = [
  `--js-runtimes "deno:${_denoPath}"`,
  '--no-check-certificate',
  '--socket-timeout 30',
  '--retries 2',
  '--fragment-retries 2',
  '--no-warnings',
].join(' ');

// Returns --cookies flag string if cookies.txt exists (for exec shell string)
export const COOKIES_PATH = path.join(__dirname, '..', 'cookies.txt');
export function getCookiesFlag() {
  return existsSync(COOKIES_PATH) ? `--cookies "${COOKIES_PATH}"` : '';
}

// Returns ['--cookies', '<path>'] array if cookies.txt exists (for execFile)
export function getCookiesArgs() {
  return existsSync(COOKIES_PATH) ? ['--cookies', COOKIES_PATH] : [];
}
