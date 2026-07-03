import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { YTDLP, YTDLP_FLAGS, getCookiesFlag } from '../../lib/ytdlp.js';
import { getPoTokenArgs } from '../../lib/potoken.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP = path.join(__dirname, '../../temp');

const YT_REGEX =
  /^(https?:\/\/)?((www|m|music)\.)?(youtube(-nocookie)?\.com\/(watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]+(\S+)?$/i;

const extractUrl = (t) => { if (!t) return null; const m = t.match(YT_REGEX); return m ? m[0] : null; };
const api = axios.create({ timeout: 20000 });

// ── ffmpeg compress helpers ────────────────────────────────────────────────────

async function compressAudio(inputBuf) {
  if (inputBuf.length < 8 * 1024 * 1024) return inputBuf;
  await fs.ensureDir(TEMP);
  const id  = Date.now();
  const inp = path.join(TEMP, `ca_${id}_in.mp3`);
  const out = path.join(TEMP, `ca_${id}_out.mp3`);
  try {
    await fs.writeFile(inp, inputBuf);
    await execAsync(
      `ffmpeg -i "${inp}" -b:a 128k -ar 44100 -ac 2 -y "${out}" -loglevel error`,
      { timeout: 90000 }
    );
    if (await fs.pathExists(out)) {
      const buf = await fs.readFile(out);
      if (buf.length > 0) return buf;
    }
  } catch {}
  finally {
    await fs.remove(inp).catch(() => {});
    await fs.remove(out).catch(() => {});
  }
  return inputBuf;
}

async function compressVideo(inputBuf) {
  await fs.ensureDir(TEMP);
  const id  = Date.now();
  const inp = path.join(TEMP, `cv_${id}_in.mp4`);
  const out = path.join(TEMP, `cv_${id}_out.mp4`);
  try {
    await fs.writeFile(inp, inputBuf);
    await execAsync(
      `ffmpeg -i "${inp}" -vf "scale=-2:360" -c:v libx264 -crf 28 -preset fast -c:a aac -b:a 64k -movflags +faststart -y "${out}" -loglevel error`,
      { timeout: 180000 }
    );
    if (await fs.pathExists(out)) {
      const buf = await fs.readFile(out);
      if (buf.length > 0) return buf;
    }
  } catch {}
  finally {
    await fs.remove(inp).catch(() => {});
    await fs.remove(out).catch(() => {});
  }
  return inputBuf;
}

// ── Fetch URL → buffer ────────────────────────────────────────────────────────

async function fetchBuf(url) {
  try {
    const resp = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 60000,
      maxContentLength: 200 * 1024 * 1024,
    });
    const buf = Buffer.from(resp.data);
    if (buf.length > 0) return buf;
  } catch {}
  return null;
}

// ── Title similarity scorer ───────────────────────────────────────────────────

function scoreMatch(title, query) {
  if (!title) return 0;
  const t = title.toLowerCase();
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return 0;
  return words.filter(w => t.includes(w)).length / words.length;
}

function fmtViews(n) {
  if (!n) return '';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

// ── Search (top 5 → best title match) ────────────────────────────────────────

async function searchYT(query) {
  try {
    const playdl = (await import('play-dl')).default;
    const res = await playdl.search(query, { source: { youtube: 'video' }, limit: 5 });
    if (res?.length) {
      const scored = res.map(r => ({ r, score: scoreMatch(r.title, query) }));
      scored.sort((a, b) => b.score - a.score);
      const r = scored[0].r;
      const m = Math.floor((r.durationInSec || 0) / 60);
      const s = String((r.durationInSec || 0) % 60).padStart(2, '0');
      return { url: r.url, title: r.title || query, thumbnail: r.thumbnails?.[0]?.url || '', duration: `${m}:${s}`, author: r.channel?.name || '', views: fmtViews(r.views) };
    }
  } catch {}
  try {
    const { data: d } = await api.get(`https://api-faa.my.id/faa/youtube?q=${encodeURIComponent(query)}`);
    if (d.status && d.result?.length) {
      const scored = d.result.slice(0, 3).map(r => ({ r, score: scoreMatch(r.title, query) }));
      scored.sort((a, b) => b.score - a.score);
      const r = scored[0].r;
      return { url: r.link, title: r.title, thumbnail: r.imageUrl, duration: r.duration, author: r.channel || '', views: '' };
    }
  } catch {}
  return null;
}

// ── yt-dlp: fast stream URL (no file download, ~5-8s) ─────────────────────────
// Returns a direct YouTube CDN URL — WhatsApp fetches it directly. Super fast.

// type: 'audio' uses tv_embedded (supports bestaudio), 'video' uses android (fast, progressive mp4)
async function tryYtdlpStreamUrl(ytUrl, fmt, clientOverride) {
  const ck = getCookiesFlag();
  const po = await getPoTokenArgs();
  const client = clientOverride || 'android';
  try {
    const { stdout } = await execAsync(
      `${YTDLP} ${YTDLP_FLAGS} "${ytUrl}" ${ck} ${po} --extractor-args "youtube:player_client=${client}" -f "${fmt}" --get-url --no-playlist --quiet --no-warnings`,
      { timeout: 25000 }
    );
    const lines = stdout.trim().split('\n').filter(l => l.startsWith('http'));
    if (lines.length) return lines[0].trim();
  } catch {}
  return null;
}

// ── yt-dlp: full audio download → buffer (fallback, slower) ──────────────────

async function tryYtdlpAudio(ytUrl) {
  await fs.ensureDir(TEMP);
  const out = path.join(TEMP, `yta_${Date.now()}.mp3`);
  const ck = getCookiesFlag();
  const po = await getPoTokenArgs();
  for (const client of ['android', 'tv_embedded', 'ios']) {
    try {
      await execAsync(
        `${YTDLP} ${YTDLP_FLAGS} "${ytUrl}" ${ck} ${po} --extractor-args "youtube:player_client=${client}" -x --audio-format mp3 --audio-quality 128K --postprocessor-args "ffmpeg:-ar 44100 -ac 2" --no-playlist -o "${out}" --quiet --no-warnings`,
        { timeout: 180000 }
      );
      if (await fs.pathExists(out)) {
        const buf = await fs.readFile(out);
        await fs.remove(out).catch(() => {});
        if (buf.length > 0) return buf;
      }
    } catch {}
  }
  await fs.remove(out).catch(() => {});
  return null;
}

// ── yt-dlp: full video download → buffer (fallback, slower) ──────────────────

async function tryYtdlpVideo(ytUrl) {
  await fs.ensureDir(TEMP);
  const outFile = path.join(TEMP, `ytv_${Date.now()}.mp4`);
  const ck = getCookiesFlag();
  const po = await getPoTokenArgs();
  for (const client of ['android', 'tv_embedded', 'ios']) {
    for (const fmt of [
      'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]',
      'best[height<=480]',
      'best[height<=720]',
      'best',
    ]) {
      try {
        await execAsync(
          `${YTDLP} ${YTDLP_FLAGS} "${ytUrl}" ${ck} ${po} --extractor-args "youtube:player_client=${client}" -f "${fmt}" --merge-output-format mp4 --no-playlist -o "${outFile}" --quiet --no-warnings`,
          { timeout: 180000 }
        );
        if (await fs.pathExists(outFile)) {
          const buf = await fs.readFile(outFile);
          await fs.remove(outFile).catch(() => {});
          if (buf.length > 0) return buf;
        }
      } catch {}
    }
  }
  await fs.remove(outFile).catch(() => {});
  return null;
}

// ── Third-party API sources (kept as parallel race — use first that works) ────
// Note: These may be temporarily down. yt-dlp stream URL is the reliable primary.

async function tryKeithMp3(ytUrl) {
  try {
    const { data: d } = await api.get(`https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(ytUrl)}`);
    const u = d?.result?.data?.downloadUrl;
    if (u) { const buf = await fetchBuf(u); if (buf) return { buffer: buf, mime: 'audio/mpeg' }; }
  } catch {}
  return null;
}

async function tryFaaMp3(ytUrl) {
  try {
    const { data: d } = await api.get(`https://api-faa.my.id/faa/ytmp3?url=${encodeURIComponent(ytUrl)}`);
    const u = d?.result?.mp3;
    if (u) { const buf = await fetchBuf(u); if (buf) return { buffer: buf, mime: 'audio/mpeg' }; }
  } catch {}
  return null;
}

async function tryNexrayMp3(ytUrl) {
  try {
    const { data: d } = await api.get(`https://api.nexray.web.id/downloader/ytmp3?url=${encodeURIComponent(ytUrl)}`);
    const u = d?.result?.url;
    if (u) { const buf = await fetchBuf(u); if (buf) return { buffer: buf, mime: 'audio/mpeg' }; }
  } catch {}
  return null;
}

async function tryGtechMp4Url(ytUrl) {
  try {
    const { data: d } = await axios.get(
      `https://gtech-api-xtp1.onrender.com/api/video/yt?url=${encodeURIComponent(ytUrl)}`,
      { timeout: 18000 }
    );
    if (d?.status && d?.result?.media) {
      const u = (d.result.media.video_hd && d.result.media.video_hd !== 'No HD video URL available')
        ? d.result.media.video_hd
        : d.result.media.video_sd;
      if (u && typeof u === 'string') return u;
    }
  } catch {}
  return null;
}

async function tryFaaMp4Url(ytUrl) {
  try {
    const { data: d } = await api.get(`https://api-faa.my.id/faa/ytmp4?url=${encodeURIComponent(ytUrl)}`);
    const u = d?.result?.download_url || d?.result?.url;
    if (u) return u;
  } catch {}
  return null;
}

async function tryNexrayMp4Url(ytUrl) {
  try {
    const { data: d } = await api.get(`https://api.nexray.web.id/downloader/ytmp4?url=${encodeURIComponent(ytUrl)}`);
    const u = d?.result?.url || d?.data?.url;
    if (u) return u;
  } catch {}
  return null;
}

async function tryAagatzMp4Url(ytUrl) {
  try {
    const { data: d } = await axios.get(
      `https://api.agatz.xyz/api/ytmp4?url=${encodeURIComponent(ytUrl)}`,
      { timeout: 18000 }
    );
    const u = d?.data?.url || d?.url || d?.result;
    if (u && typeof u === 'string') return u;
  } catch {}
  return null;
}

// ── Race helpers ──────────────────────────────────────────────────────────────

function firstSuccess(promises) {
  return new Promise(resolve => {
    let pending = promises.length;
    if (!pending) return resolve(null);
    for (const p of promises) {
      Promise.resolve(p)
        .then(v => { if (v) resolve(v); })
        .catch(() => {})
        .finally(() => { if (--pending === 0) resolve(null); });
    }
  });
}

function withTimeout(ms, promise) {
  return Promise.race([
    promise,
    new Promise(r => setTimeout(() => r(null), ms)),
  ]);
}

// ── Audio orchestrator ────────────────────────────────────────────────────────
// Fast path: yt-dlp --get-url gives a streaming URL in ~5-8s, WhatsApp fetches it directly.
// API race runs in parallel — if any API finishes first, use that.
// Fallback: full yt-dlp download + compress.
//
// Returns: { url, mime } | { buffer, mime } | null

async function downloadAudio(ytUrl) {
  // Primary: race yt-dlp stream URL vs API sources (whichever responds first)
  // tv_embedded client supports bestaudio format; android does not
  const ytdlpStreamPromise = tryYtdlpStreamUrl(ytUrl, 'bestaudio', 'tv_embedded')
    .then(u => u ? { url: u, mime: 'audio/webm' } : null);

  const apiRace = firstSuccess([
    tryKeithMp3(ytUrl),
    tryFaaMp3(ytUrl),
    tryNexrayMp3(ytUrl),
  ]);

  const result = await withTimeout(28000, firstSuccess([ytdlpStreamPromise, apiRace]));
  if (result) return result;

  // Fallback: full download with conversion (slower but guaranteed)
  const raw = await tryYtdlpAudio(ytUrl);
  if (!raw) return null;
  const compressed = await compressAudio(raw);
  return { buffer: compressed, mime: 'audio/mpeg' };
}

// ── Video orchestrator ────────────────────────────────────────────────────────
// Fast path: yt-dlp --get-url gives a direct video URL in ~5-8s.
// API race runs in parallel — if any API finishes first, use that.
// Fallback: full yt-dlp download.
//
// Returns: { url } | { buffer } | null

async function downloadVideo(ytUrl) {
  // Primary: race yt-dlp stream URL vs API sources
  const ytdlpStreamPromise = tryYtdlpStreamUrl(ytUrl, 'best[height<=360][ext=mp4]/best[height<=360]/best[ext=mp4]/best')
    .then(u => u ? u : null);

  const apiRace = firstSuccess([
    tryGtechMp4Url(ytUrl),
    tryFaaMp4Url(ytUrl),
    tryNexrayMp4Url(ytUrl),
    tryAagatzMp4Url(ytUrl),
  ]);

  const directUrl = await withTimeout(28000, firstSuccess([ytdlpStreamPromise, apiRace]));

  if (directUrl) {
    // Try buffer download (35s cap) — if it times out, send URL directly
    const buf = await withTimeout(35000, fetchBuf(directUrl));
    if (buf?.length) return { buffer: buf };
    return { url: directUrl };
  }

  // Fallback: full yt-dlp download
  const raw = await withTimeout(120000, tryYtdlpVideo(ytUrl));
  if (!raw) return null;
  return { buffer: raw };
}

// ── UI captions ───────────────────────────────────────────────────────────────

function buildAudioCaption(meta, botName) {
  const views = meta.views ? ` | 👁 ${meta.views}` : '';
  return (
    `✦✦✦✦✦✦✦✦✦✦\n` +
    `🎵 ${botName} MUSIC\n` +
    `✦✦✦✦✦✦✦✦✦✦\n\n` +
    `🎙 *${meta.title}*\n` +
    `🎤 ${meta.author || 'Unknown'}\n` +
    `⏱ ${meta.duration || '?'}${views}\n\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `> 🤖 Powered by ${botName}\n` +
    `> 👨‍💻 Developed by Ahsan Ali Wadani`
  );
}

function buildVideoCaption(meta, botName) {
  const views = meta.views ? ` | 👁 ${meta.views}` : '';
  return (
    `✦✦✦✦✦✦✦✦✦✦\n` +
    `🎬 ${botName} VIDEO\n` +
    `✦✦✦✦✦✦✦✦✦✦\n\n` +
    `🎙 *${meta.title}*\n` +
    `🎤 ${meta.author || 'Unknown'}\n` +
    `⏱ ${meta.duration || '?'}${views}\n\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `> 🤖 Powered by ${botName}\n` +
    `> 👨‍💻 Developed by Ahsan Ali Wadani`
  );
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default {
  command: 'play',
  alias: ['song', 'yt', 'ytmp3', 'mp3', 'ytmp4', 'video', 'mp4'],
  description: 'Download YouTube audio or video',
  category: 'download',

  execute: async ({ sock, msg, jid, text, command, react, reply, prefix, config }) => {
    const botName = config?.botName || 'AA MD Bot';
    let query = text?.trim();

    if (!query) {
      const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (q) query = (q.conversation || q.extendedTextMessage?.text || '').trim();
    }

    if (!query) {
      return reply(
        `🎬 *YouTube Downloader*\n\n` +
        `📌 *Usage:*\n` +
        `• ${prefix}play <song name>\n` +
        `• ${prefix}mp3 <youtube link>\n` +
        `• ${prefix}video <video name>\n` +
        `• ${prefix}mp4 <youtube link>\n\n` +
        `✨ Reply to a link also works`
      );
    }

    try {
      switch (command) {

        // ── VIDEO ─────────────────────────────────────────────────────────────
        case 'mp4':
        case 'ytmp4':
        case 'video': {
          await react('🎥');
          let ytUrl = extractUrl(query);
          let meta = null;

          if (!ytUrl) {
            meta = await searchYT(query);
            if (!meta?.url) return reply(`❌ No video found for: *${query}*`);
            ytUrl = meta.url;
          }

          if (meta?.thumbnail) {
            await sock.sendMessage(jid, {
              image: { url: meta.thumbnail },
              caption: `${buildVideoCaption(meta, botName)}\n\n⏳ Fetching video...`,
            }, { quoted: msg });
          }

          const vdata = await downloadVideo(ytUrl);
          if (!vdata) {
            await react('❌');
            return reply(
              `❌ *Video download failed*\n\n` +
              `All download sources failed.\n\n` +
              `💡 *Try:*\n` +
              `• Paste the YouTube link directly: ${prefix}video <link>\n` +
              `• Try again after a minute`
            );
          }

          const vcap = meta
            ? buildVideoCaption(meta, botName)
            : `🎬 *Video Downloaded*\n\n> Powered by ${botName}`;

          const videoPayload = vdata.url
            ? { video: { url: vdata.url }, mimetype: 'video/mp4', caption: vcap }
            : { video: vdata.buffer, mimetype: 'video/mp4', caption: vcap };

          await sock.sendMessage(jid, videoPayload, { quoted: msg });
          await react('✅');
          break;
        }

        // ── MP3 by direct URL ─────────────────────────────────────────────────
        case 'mp3':
        case 'ytmp3': {
          await react('🎶');
          const ytUrl = extractUrl(query);
          if (!ytUrl) return reply(`❌ Please provide a valid YouTube URL.\n\nTo search by name: *${prefix}play <song name>*`);
          const adata = await downloadAudio(ytUrl);
          if (!adata) return reply('❌ MP3 download failed — all sources returned error.');
          if (adata.url) {
            await sock.sendMessage(jid, { audio: { url: adata.url }, mimetype: adata.mime || 'audio/mp4', ptt: false }, { quoted: msg });
          } else {
            await sock.sendMessage(jid, { audio: adata.buffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          }
          await react('✅');
          break;
        }

        // ── PLAY / SONG / YT — search by name ────────────────────────────────
        case 'play':
        case 'song':
        case 'yt':
        default: {
          await react('📥');

          // Direct URL pasted
          const directUrl = extractUrl(query);
          if (directUrl) {
            const adata = await downloadAudio(directUrl);
            if (!adata) return reply('❌ Download failed — all sources returned error.');
            if (adata.url) {
              await sock.sendMessage(jid, { audio: { url: adata.url }, mimetype: adata.mime || 'audio/mp4', ptt: false }, { quoted: msg });
            } else {
              await sock.sendMessage(jid, { audio: adata.buffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
            }
            await react('✅');
            break;
          }

          // Search → exact YouTube URL → download
          const meta = await searchYT(query);
          if (!meta?.url) return reply(`❌ Could not find: *${query}*`);

          if (meta.thumbnail) {
            await sock.sendMessage(jid, {
              image: { url: meta.thumbnail },
              caption: buildAudioCaption(meta, botName),
            }, { quoted: msg });
          }

          const adata = await downloadAudio(meta.url);
          if (!adata) return reply(`❌ Found *${meta.title}* but download failed — all sources returned error.`);

          if (adata.url) {
            await sock.sendMessage(jid, { audio: { url: adata.url }, mimetype: adata.mime || 'audio/mp4', ptt: false }, { quoted: msg });
          } else {
            await sock.sendMessage(jid, { audio: adata.buffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
          }
          await react('✅');
          break;
        }
      }
    } catch (err) {
      console.error('[ YouTube ]', err.message);
      await react('❌');
      reply(`❌ Error: ${err.message}`);
    }
  },
};
