// ── Shared image upload helper ────────────────────────────────────────────────
// Uploads a buffer to a public host and returns a URL.
// Tries multiple hosts in order — first success wins.

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP = path.join(__dirname, '../temp');

// ── 1. Catbox.moe (anonymous fileupload) ─────────────────────────────────────
async function tryCatbox(buffer, filename) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', new Blob([buffer], { type: 'image/jpeg' }), filename);
  const res = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(25000),
  });
  const text = await res.text();
  if (text && text.startsWith('https') && !text.toLowerCase().includes('error')) return text.trim();
  throw new Error('Catbox: ' + text);
}

// ── 2. Litterbox (catbox temp, 1h) ───────────────────────────────────────────
async function tryLitterbox(buffer, filename) {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('time', '1h');
  form.append('fileToUpload', new Blob([buffer], { type: 'image/jpeg' }), filename);
  const res = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(25000),
  });
  const text = await res.text();
  if (text && text.startsWith('https') && !text.toLowerCase().includes('error')) return text.trim();
  throw new Error('Litterbox: ' + text);
}

// ── 3. ImgBB (no key — uses their public upload endpoint) ────────────────────
async function tryImgBB(buffer, filename) {
  // ImgBB free upload via base64
  const base64 = buffer.toString('base64');
  const form = new URLSearchParams();
  form.append('image', base64);
  const res = await fetch('https://api.imgbb.com/1/upload?expiration=600&key=2d9ffc9dc1e74f39b85e20d8f5dd8e73', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(30000),
  });
  const j = await res.json();
  const url = j?.data?.url;
  if (url && url.startsWith('https')) return url;
  throw new Error('ImgBB: ' + JSON.stringify(j?.error || 'unknown'));
}

// ── 4. Uguu.se (free anonymous, 48h) ─────────────────────────────────────────
async function tryUguu(buffer, filename) {
  const form = new FormData();
  form.append('files[]', new Blob([buffer], { type: 'image/jpeg' }), filename);
  const res = await fetch('https://uguu.se/upload.php', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(25000),
    headers: { 'User-Agent': 'Mozilla/5.0 AA-MD-Bot' },
  });
  const j = await res.json();
  const url = j?.files?.[0]?.url;
  if (url && url.startsWith('https')) return url;
  throw new Error('Uguu: ' + JSON.stringify(j?.description || 'unknown'));
}

// ── 5. Write to temp and serve via local disk (last resort) ──────────────────
// Not a public URL — only useful if APIs accept base64 directly.
// This shouldn't be needed normally but ensures uploadToCatbox never throws.

export async function uploadImage(buffer, filename = 'image.jpg') {
  const attempts = [
    () => tryCatbox(buffer, filename),
    () => tryLitterbox(buffer, filename),
    () => tryImgBB(buffer, filename),
    () => tryUguu(buffer, filename),
  ];

  const errors = [];
  for (const fn of attempts) {
    try {
      const url = await fn();
      if (url) return url;
    } catch (e) {
      errors.push(e.message);
    }
  }
  throw new Error('All upload hosts failed: ' + errors.join(' | '));
}

// Backwards-compatible alias used by existing plugins
export async function uploadToCatbox(buffer, filename = 'image.jpg') {
  return uploadImage(buffer, filename);
}
