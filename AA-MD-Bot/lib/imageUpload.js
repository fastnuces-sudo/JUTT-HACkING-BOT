// ── Shared image upload helper ────────────────────────────────────────────────
// Uploads a buffer to Catbox.moe and returns a public URL.
// Used by rembg, remini, and any plugin that needs a public image URL.

export async function uploadToCatbox(buffer, filename = 'image.jpg') {
  const form = new FormData();
  form.append('reqtype', 'fileupload');
  form.append('fileToUpload', new Blob([buffer]), filename);

  const res = await fetch('https://catbox.moe/user/api.php', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  if (!text || text.toLowerCase().includes('error') || !text.startsWith('https')) {
    throw new Error('Catbox upload error: ' + text);
  }
  return text.trim();
}
