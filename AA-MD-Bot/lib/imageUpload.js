// ── Shared image upload helper ────────────────────────────────────────────────
// Uploads a buffer to a public host and returns a URL.
// Tries multiple hosts in order — first success wins.
// tmpfiles.org confirmed working from Replit (200).

// ── 1. tmpfiles.org (confirmed working from Replit, 24h) ─────────────────────
async function tryTmpfiles(buffer, filename) {
  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'image/jpeg' }), filename);
  const res = await fetch('https://tmpfiles.org/api/v1/upload', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(25000),
  });
  const j = await res.json();
  // Response: {"status":"success","data":{"url":"https://tmpfiles.org/XXXXX/filename"}}
  let url = j?.data?.url;
  if (url && url.startsWith('https://tmpfiles.org/')) {
    // Convert to direct download URL
    url = url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
    return url;
  }
  throw new Error('tmpfiles: ' + JSON.stringify(j));
}

// ── 2. Catbox.moe (anonymous fileupload) ─────────────────────────────────────
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

// ── 3. Litterbox (catbox temp, 1h) ───────────────────────────────────────────
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

export async function uploadImage(buffer, filename = 'image.jpg') {
  const attempts = [
    () => tryTmpfiles(buffer, filename),
    () => tryCatbox(buffer, filename),
    () => tryLitterbox(buffer, filename),
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
