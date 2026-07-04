import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { YTDLP, YTDLP_FLAGS, getCookiesFlag, COOKIES_PATH } from '../../lib/ytdlp.js';

const execAsync = promisify(exec);
let _botCheckWarned = false;
function warnIfBotCheck(err) {
  const msg = err?.stderr || err?.message || '';
  if (/sign in to confirm/i.test(msg) && !_botCheckWarned) {
    _botCheckWarned = true;
    console.warn(
      '[ YouTube ] ⚠️  YouTube is bot-checking download requests from this server.\n' +
      `  Fix: add a real cookies.txt at ${COOKIES_PATH} (see cookies.txt.example for steps).`
    );
  }
}
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP = path.join(__dirname, '../../temp');

const YT_REGEX =
  /^(https?:\/\/)?((www|m|music)\.)?(youtube(-nocookie)?\.com\/(watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]+(\S+)?$/i;

const extractUrl = (t) => { if (!t) return null; const m = t.match(YT_REGEX); return m ? m[0] : null; };
const api = axios.create({ timeout: 20000 });

// ── ffmpeg compress helpers ────────────────────────────────────────────────────

// Always transcode to mp3 — used when source format is unknown (webm, m4a, etc.)
// Returns a confirmed mp3 Buffer, or null if ffmpeg fails (caller falls through to Step 3).
async function ensureMp3(inputBuf) {
  await fs.ensureDir(TEMP);
  const id  = Date.now();
  // Give the temp input a .bin extension — ffmpeg auto-probes format regardless of extension
  const inp = path.join(TEMP, `em_${id}_in.bin`);
  const out = path.join(TEMP, `em_${id}_out.mp3`);
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
  return null; // ffmpeg failed — caller must fall through to next step
}

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

// ── Media validation — reject error pages/JSON masquerading as media ─────────
// Flaky third-party APIs sometimes return a "success" URL that actually points
// to an expired link, HTML error page, or JSON blob. Downloading that "works"
// (non-empty buffer) but produces silent, unplayable media on WhatsApp with no
// error surfaced. Verify real magic bytes + minimum size before trusting a buffer.

function looksLikeTextError(buf) {
  const head = buf.slice(0, 32).toString('utf8').trim();
  return head.startsWith('<') || head.startsWith('{') || head.startsWith('[') || /^(error|not found|forbidden)/i.test(head);
}

function isValidAudioBuffer(buf) {
  if (!buf || buf.length < 15000) return false; // real songs are always >15KB
  if (looksLikeTextError(buf)) return false;
  // ID3 tag ('ID3') or raw MPEG frame sync (0xFFEx-0xFFFx)
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true;
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true;
  return false;
}

// Recognizes ANY real audio container (not just mp3) so we don't throw away
// valid audio that third-party APIs return in flac/ogg/wav/m4a — we transcode
// those to mp3 via ffmpeg instead of rejecting them as "invalid".
function isKnownAudioContainer(buf) {
  if (!buf || buf.length < 15000) return false;
  if (looksLikeTextError(buf)) return false;
  if (isValidAudioBuffer(buf)) return true; // mp3
  if (buf[0] === 0x66 && buf[1] === 0x4c && buf[2] === 0x61 && buf[3] === 0x43) return true; // FLAC 'fLaC'
  if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return true; // OGG 'OggS'
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return true; // WAV/RIFF
  const sig = buf.slice(4, 12).toString('ascii'); // mp4/m4a 'ftyp' box at offset 4
  if (sig.includes('ftyp')) return true;
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return true; // webm/mkv EBML
  return false;
}

// Fetches a URL and returns a guaranteed-mp3 { buffer, mime } — accepts any
// real audio container from third-party APIs and transcodes to mp3 if needed.
async function fetchAsMp3(url) {
  const buf = await fetchBuf(url);
  if (!buf) return null;
  if (isValidAudioBuffer(buf)) return { buffer: buf, mime: 'audio/mpeg' };
  if (isKnownAudioContainer(buf)) {
    const mp3 = await ensureMp3(buf);
    if (isValidAudioBuffer(mp3)) return { buffer: mp3, mime: 'audio/mpeg' };
  }
  return null;
}

function isValidVideoBuffer(buf) {
  if (!buf || buf.length < 50000) return false; // real clips are always >50KB
  if (looksLikeTextError(buf)) return false;
  // mp4/mov 'ftyp' box normally sits at byte offset 4
  const sig = buf.slice(4, 12).toString('ascii');
  if (sig.includes('ftyp')) return true;
  // webm/mkv EBML header
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return true;
  return false;
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
  const client = clientOverride || 'android';
  try {
    const { stdout } = await execAsync(
      `${YTDLP} ${YTDLP_FLAGS} "${ytUrl}" ${ck} --extractor-args "youtube:player_client=${client}" -f "${fmt}" --get-url --no-playlist --quiet --no-warnings`,
      { timeout: 25000 }
    );
    const lines = stdout.trim().split('\n').filter(l => l.startsWith('http'));
    if (lines.length) return lines[0].trim();
  } catch (e) { warnIfBotCheck(e); }
  return null;
}

// ── yt-dlp: full audio download → buffer (fallback, slower) ──────────────────

async function tryYtdlpAudio(ytUrl) {
  await fs.ensureDir(TEMP);
  const out = path.join(TEMP, `yta_${Date.now()}.mp3`);
  const ck = getCookiesFlag();
  for (const client of ['android', 'tv_embedded', 'ios']) {
    try {
      await execAsync(
        `${YTDLP} ${YTDLP_FLAGS} "${ytUrl}" ${ck} --extractor-args "youtube:player_client=${client}" -x --audio-format mp3 --audio-quality 128K --postprocessor-args "ffmpeg:-ar 44100 -ac 2" --no-playlist -o "${out}" --quiet --no-warnings`,
        { timeout: 180000 }
      );
      if (await fs.pathExists(out)) {
        const buf = await fs.readFile(out);
        await fs.remove(out).catch(() => {});
        if (buf.length > 0) return buf;
      }
    } catch (e) { warnIfBotCheck(e); }
  }
  await fs.remove(out).catch(() => {});
  return null;
}

// ── yt-dlp: full video download → buffer (fallback, slower) ──────────────────

async function tryYtdlpVideo(ytUrl) {
  await fs.ensureDir(TEMP);
  const outFile = path.join(TEMP, `ytv_${Date.now()}.mp4`);
  const ck = getCookiesFlag();
  for (const client of ['android', 'tv_embedded', 'ios']) {
    for (const fmt of [
      'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]',
      'best[height<=480]',
      'best[height<=720]',
      'best',
    ]) {
      try {
        await execAsync(
          `${YTDLP} ${YTDLP_FLAGS} "${ytUrl}" ${ck} --extractor-args "youtube:player_client=${client}" -f "${fmt}" --merge-output-format mp4 --no-playlist -o "${outFile}" --quiet --no-warnings`,
          { timeout: 180000 }
        );
        if (await fs.pathExists(outFile)) {
          const buf = await fs.readFile(outFile);
          await fs.remove(outFile).catch(() => {});
          if (buf.length > 0) return buf;
        }
      } catch (e) { warnIfBotCheck(e); }
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
    if (u) return await fetchAsMp3(u);
  } catch {}
  return null;
}

async function tryFaaMp3(ytUrl) {
  try {
    const { data: d } = await api.get(`https://api-faa.my.id/faa/ytmp3?url=${encodeURIComponent(ytUrl)}`);
    const u = d?.result?.mp3;
    if (u) return await fetchAsMp3(u);
  } catch {}
  return null;
}

async function tryNexrayMp3(ytUrl) {
  try {
    const { data: d } = await api.get(`https://api.nexray.web.id/downloader/ytmp3?url=${encodeURIComponent(ytUrl)}`);
    const u = d?.result?.url;
    if (u) return await fetchAsMp3(u);
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

// ── Audio from progressive video stream (~6s total) ──────────────────────────
// YouTube DASH audio streams are throttled to playback speed (~107s for 3MB).
// Progressive mp4 streams are NOT throttled — download instantly, then strip
// the video track with ffmpeg -vn. Tested: 2.7s URL + 0.1s fetch + 3.5s ffmpeg = 6.3s
//
// Returns: { buffer, mime } | null

async function downloadAudioFromVideo(ytUrl) {
  const videoUrl = await withTimeout(18000,
    tryYtdlpStreamUrl(ytUrl, 'best[height<=360][ext=mp4]/best[height<=360]/best[ext=mp4]/best')
  );
  if (!videoUrl) return null;

  const vidBuf = await withTimeout(90000, fetchBuf(videoUrl));
  if (!vidBuf?.length) return null;

  await fs.ensureDir(TEMP);
  const id  = Date.now();
  const inp = path.join(TEMP, `avx_${id}_in.mp4`);
  const out = path.join(TEMP, `avx_${id}_out.mp3`);
  try {
    await fs.writeFile(inp, vidBuf);
    // -vn: strip video, keep audio only → mp3 at 128k
    await execAsync(
      `ffmpeg -i "${inp}" -vn -b:a 128k -ar 44100 -ac 2 -y "${out}" -loglevel error`,
      { timeout: 60000 }
    );
    if (await fs.pathExists(out)) {
      const buf = await fs.readFile(out);
      if (buf.length > 0) return { buffer: buf, mime: 'audio/mpeg' };
    }
  } catch {}
  finally {
    await fs.remove(inp).catch(() => {});
    await fs.remove(out).catch(() => {});
  }
  return null;
}

// ── Audio orchestrator ────────────────────────────────────────────────────────
// TRUE parallel race — all sources start simultaneously, first valid buffer wins.
//
// Fast paths (both ~6s):
//   A) Progressive video stream → ffmpeg audio extract (never throttled)
//   B) API sources (Keith/Faa/Nexray) — fastest when online
//   C) yt-dlp full -x download (handles throttling internally, also ~6s)
//
// Returns: { buffer, mime } | null

async function downloadAudio(ytUrl) {
  // All three run simultaneously — no sequential waiting
  const result = await withTimeout(120000, firstSuccess([
    // Path A: video stream → strip audio (~6s, most reliable)
    downloadAudioFromVideo(ytUrl),

    // Path B: dedicated mp3 API sources (fast when online, often down)
    firstSuccess([
      tryKeithMp3(ytUrl),
      tryFaaMp3(ytUrl),
      tryNexrayMp3(ytUrl),
    ]),

    // Path C: yt-dlp full download with built-in throttle handling (~6s)
    tryYtdlpAudio(ytUrl).then(raw =>
      raw ? { buffer: raw, mime: 'audio/mpeg' } : null
    ),
  ]));

  if (isValidAudioBuffer(result?.buffer)) return result;
  return null;
}

// ── Video orchestrator ────────────────────────────────────────────────────────
// Always downloads and sends as a buffer — CDN URLs expire and may not stream.
//
// Step 1: Race for a direct mp4 URL (yt-dlp or API) — fast, ~5-15s
// Step 2: Fetch that URL into a buffer (90s cap)
// Step 3: yt-dlp full video download (guaranteed, ~60-180s)
//
// Returns: { buffer } | null

async function downloadVideo(ytUrl) {
  // Step 1 — Race for the best direct video URL
  const directUrl = await withTimeout(28000, firstSuccess([
    tryYtdlpStreamUrl(ytUrl, 'best[height<=360][ext=mp4]/best[height<=360]/best[ext=mp4]/best'),
    tryGtechMp4Url(ytUrl),
    tryFaaMp4Url(ytUrl),
    tryNexrayMp4Url(ytUrl),
    tryAagatzMp4Url(ytUrl),
  ]));

  if (directUrl) {
    // Step 2 — Download the buffer (90s cap; videos are larger than audio)
    const buf = await withTimeout(90000, fetchBuf(directUrl));
    if (isValidVideoBuffer(buf)) return { buffer: buf };
  }

  // Step 3 — Full yt-dlp download as last resort
  const raw = await withTimeout(180000, tryYtdlpVideo(ytUrl));
  if (!raw?.length || raw.length < 50000) return null;
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
          if (!vdata?.buffer?.length) {
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

          await sock.sendMessage(jid, { video: vdata.buffer, mimetype: 'video/mp4', caption: vcap }, { quoted: msg });
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
          if (!adata?.buffer?.length) return reply('❌ MP3 download failed — all sources returned error.');
          await sock.sendMessage(jid, { audio: adata.buffer, mimetype: adata.mime || 'audio/mpeg', ptt: false }, { quoted: msg });
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
            if (!adata?.buffer?.length) return reply('❌ Download failed — all sources returned error.');
            await sock.sendMessage(jid, { audio: adata.buffer, mimetype: adata.mime || 'audio/mpeg', ptt: false }, { quoted: msg });
            await react('✅');
            break;
          }

          // Search → exact YouTube URL → download
          const meta = await searchYT(query);
          if (!meta?.url) return reply(`❌ Could not find: *${query}*`);

          if (meta.thumbnail) {
            await sock.sendMessage(jid, {
              image: { url: meta.thumbnail },
              caption: `${buildAudioCaption(meta, botName)}\n\n⏳ _Downloading audio..._`,
            }, { quoted: msg });
          }

          const adata = await downloadAudio(meta.url);
          if (!adata?.buffer?.length) return reply(`❌ Found *${meta.title}* but download failed — all sources returned error.`);

          await sock.sendMessage(jid, { audio: adata.buffer, mimetype: adata.mime || 'audio/mpeg', ptt: false }, { quoted: msg });
          await react('✅');
          break;
        }
      }
    } catch (err) {
      console.error('[ YouTube ]', err.message);
      await react('❌').catch(() => {});
      try {
        await reply(`❌ Error: ${err.message}`);
      } catch (replyErr) {
        // Last-resort plain send if the watermarked reply() itself fails —
        // ensures the user is never left with silence and no explanation.
        console.error('[ YouTube ] reply failed too', replyErr.message);
        await sock.sendMessage(jid, { text: `❌ Error: ${err.message}` }, { quoted: msg }).catch(() => {});
      }
    }
  },
};
