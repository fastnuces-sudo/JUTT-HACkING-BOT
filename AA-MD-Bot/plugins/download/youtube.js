import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { YTDLP, getCookiesFlag } from '../../lib/ytdlp.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const YT_REGEX =
  /^(https?:\/\/)?((www|m|music)\.)?(youtube(-nocookie)?\.com\/(watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]+(\S+)?$/i;

const extractUrl = (t) => { if (!t) return null; const m = t.match(YT_REGEX); return m ? m[0] : null; };
const api = axios.create({ timeout: 25000 });

function fmtViews(n) {
  if (!n) return '';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

// ── Title similarity scorer ───────────────────────────────────────────────────
function scoreMatch(title, query) {
  if (!title) return 0;
  const t = title.toLowerCase();
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return 0;
  return words.filter(w => t.includes(w)).length / words.length;
}

// ── Search (top 5 results + best-match scoring for accuracy) ──────────────────
async function searchYT(query) {
  // Primary: play-dl — fetch top 5, pick best title match
  try {
    const playdl = (await import('play-dl')).default;
    const res = await playdl.search(query, { source: { youtube: 'video' }, limit: 5 });
    if (res?.length) {
      // Score each result against query words, pick best
      const scored = res.map(r => ({ r, score: scoreMatch(r.title, query) }));
      scored.sort((a, b) => b.score - a.score);
      const r = scored[0].r;
      const m = Math.floor((r.durationInSec || 0) / 60);
      const s = String((r.durationInSec || 0) % 60).padStart(2, '0');
      return {
        url: r.url,
        title: r.title || query,
        thumbnail: r.thumbnails?.[0]?.url || '',
        duration: `${m}:${s}`,
        author: r.channel?.name || '',
        views: fmtViews(r.views),
      };
    }
  } catch {}
  // Fallback: api-faa.my.id search (top 3, best match)
  try {
    const { data: d } = await api.get(`https://api-faa.my.id/faa/youtube?q=${encodeURIComponent(query)}`);
    if (d.status && d.result?.length) {
      const top = d.result.slice(0, 3);
      const scored = top.map(r => ({ r, score: scoreMatch(r.title, query) }));
      scored.sort((a, b) => b.score - a.score);
      const r = scored[0].r;
      return { url: r.link, title: r.title, thumbnail: r.imageUrl, duration: r.duration, author: r.channel || '', views: '' };
    }
  } catch {}
  return null;
}

// ── Audio download sources ────────────────────────────────────────────────────

const MAX_AUDIO_MB = 18;
const MAX_VIDEO_MB = 18;

// Download a URL into a Buffer; returns null if unreachable or over size limit
async function fetchBuffer(url, maxMB) {
  try {
    const resp = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 60000,
      maxContentLength: maxMB * 1024 * 1024,
      maxBodyLength: maxMB * 1024 * 1024,
    });
    const buf = Buffer.from(resp.data);
    if (buf.length > maxMB * 1024 * 1024) return null;
    return buf;
  } catch {}
  return null;
}

// ── Audio sources (each returns a Buffer or null) ─────────────────────────────

async function tryFaaMp3(ytUrl) {
  try {
    const { data: d } = await api.get(`https://api-faa.my.id/faa/ytmp3?url=${encodeURIComponent(ytUrl)}`);
    if (!d.status || !d.result?.mp3) return null;
    const buf = await fetchBuffer(d.result.mp3, MAX_AUDIO_MB);
    return buf ? { buffer: buf, mime: 'audio/mpeg' } : null;
  } catch {}
  return null;
}

async function tryNexrayMp3(ytUrl) {
  try {
    const { data: d } = await api.get(`https://api.nexray.web.id/downloader/ytmp3?url=${encodeURIComponent(ytUrl)}`);
    if (!d.status || !d.result?.url) return null;
    const buf = await fetchBuffer(d.result.url, MAX_AUDIO_MB);
    return buf ? { buffer: buf, mime: 'audio/mpeg' } : null;
  } catch {}
  return null;
}

async function trySiputzxMp3(ytUrl) {
  try {
    const { data: d } = await api.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(ytUrl)}`);
    if (!d.status || !d.data?.url) return null;
    const buf = await fetchBuffer(d.data.url, MAX_AUDIO_MB);
    return buf ? { buffer: buf, mime: 'audio/mpeg' } : null;
  } catch {}
  return null;
}

async function trySoundCloud(query) {
  try {
    const playdl = (await import('play-dl')).default;
    const scRes = await playdl.search(query, { source: { soundcloud: 'tracks' }, limit: 1 });
    if (!scRes?.length) return null;
    const sc = scRes[0];
    const stream = await playdl.stream(sc.url, { quality: 0 });
    const chunks = [];
    for await (const chunk of stream.stream) chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    if (buf.length > MAX_AUDIO_MB * 1024 * 1024) return null;
    return { buffer: buf, mime: 'audio/mpeg', title: sc.name || query, author: sc.publisher?.artist || sc.user?.name || 'SoundCloud', thumbnail: sc.thumbnail || '' };
  } catch {}
  return null;
}

// yt-dlp audio: 64K m4a — guaranteed small (~1 MB/min)
async function tryYtdlpAudio(ytUrl) {
  const tempDir = path.join(__dirname, '../../temp');
  await fs.ensureDir(tempDir);
  const out = path.join(tempDir, `yta_${Date.now()}.m4a`);
  const ck = getCookiesFlag();
  for (const client of ['tv_embedded', 'android', 'ios']) {
    try {
      await execAsync(
        `${YTDLP} "${ytUrl}" ${ck} --extractor-args "youtube:player_client=${client}" -x --audio-format m4a --audio-quality 64K --max-filesize ${MAX_AUDIO_MB}m --no-playlist -o "${out}" --quiet --no-warnings --no-check-certificate`,
        { timeout: 120000 }
      );
      if (await fs.pathExists(out)) {
        const buf = await fs.readFile(out);
        await fs.remove(out).catch(() => {});
        return { buffer: buf, mime: 'audio/mp4' };
      }
    } catch {}
  }
  await fs.remove(out).catch(() => {});
  return null;
}

// ── Video sources ─────────────────────────────────────────────────────────────

// API sources: get URL, download+size-check
async function tryFaaMp4(ytUrl) {
  try {
    const { data: d } = await api.get(`https://api-faa.my.id/faa/ytmp4?url=${encodeURIComponent(ytUrl)}`);
    if (!d.status || !d.result?.download_url) return null;
    const buf = await fetchBuffer(d.result.download_url, MAX_VIDEO_MB);
    return buf ? { buffer: buf } : null;
  } catch {}
  return null;
}

async function tryNexrayMp4(ytUrl) {
  try {
    const { data: d } = await api.get(`https://api.nexray.web.id/downloader/ytmp4?url=${encodeURIComponent(ytUrl)}`);
    if (!d.status || !d.result?.url) return null;
    const buf = await fetchBuffer(d.result.url, MAX_VIDEO_MB);
    return buf ? { buffer: buf } : null;
  } catch {}
  return null;
}

async function trySiputzxMp4(ytUrl) {
  try {
    const { data: d } = await api.get(`https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(ytUrl)}`);
    if (!d.status || !d.data?.url) return null;
    const buf = await fetchBuffer(d.data.url, MAX_VIDEO_MB);
    return buf ? { buffer: buf } : null;
  } catch {}
  return null;
}

// yt-dlp video: download 360p mp4 to temp — ~3 MB for a 5-min video
async function tryYtdlpVideo(ytUrl) {
  const tempDir = path.join(__dirname, '../../temp');
  await fs.ensureDir(tempDir);
  const uid = `ytv_${Date.now()}`;
  const outTpl = path.join(tempDir, `${uid}.%(ext)s`);
  const ck = getCookiesFlag();
  for (const client of ['tv_embedded', 'android', 'ios']) {
    for (const fmt of ['best[height<=360][ext=mp4]', 'best[height<=480][ext=mp4]', 'best[height<=360]', 'best']) {
      try {
        await execAsync(
          `${YTDLP} "${ytUrl}" ${ck} --extractor-args "youtube:player_client=${client}" -f "${fmt}" --max-filesize ${MAX_VIDEO_MB}m --no-playlist -o "${outTpl}" --quiet --no-warnings --no-check-certificate`,
          { timeout: 120000 }
        );
        const files = await fs.readdir(tempDir);
        const found = files.find(f => f.startsWith(uid));
        if (found) {
          const buf = await fs.readFile(path.join(tempDir, found));
          await fs.remove(path.join(tempDir, found)).catch(() => {});
          return { buffer: buf };
        }
      } catch {}
    }
  }
  return null;
}

// ── Orchestrators ─────────────────────────────────────────────────────────────

// All audio sources now return { buffer, mime } — build unified audioMsg from any result
function makeAudioMsg(r) {
  return { audioBuffer: r.buffer, audioMime: r.mime };
}

async function downloadAudioByUrl(ytUrl) {
  const r1 = await tryFaaMp3(ytUrl);     if (r1) return makeAudioMsg(r1);
  const r2 = await tryNexrayMp3(ytUrl);  if (r2) return makeAudioMsg(r2);
  const r3 = await trySiputzxMp3(ytUrl); if (r3) return makeAudioMsg(r3);
  const r4 = await tryYtdlpAudio(ytUrl); if (r4) return makeAudioMsg(r4);
  return null;
}

async function downloadAudioByQuery(query) {
  // Step 1: accurate YouTube search for exact URL
  const meta = await searchYT(query);
  if (!meta) return { meta: null, audio: null };

  // Step 2: download by exact URL (accuracy + size-checked)
  const r1 = await tryFaaMp3(meta.url);     if (r1) return { meta, audio: makeAudioMsg(r1) };
  const r2 = await tryNexrayMp3(meta.url);  if (r2) return { meta, audio: makeAudioMsg(r2) };
  const r3 = await trySiputzxMp3(meta.url); if (r3) return { meta, audio: makeAudioMsg(r3) };

  // Step 3: SoundCloud fallback (independent of YouTube)
  const sc = await trySoundCloud(query);
  if (sc) return {
    meta: { ...meta, title: sc.title || meta.title, author: sc.author || meta.author, thumbnail: sc.thumbnail || meta.thumbnail },
    audio: makeAudioMsg(sc),
  };

  // Step 4: yt-dlp last resort (64K m4a, max 18 MB)
  const yt = await tryYtdlpAudio(meta.url);
  if (yt) return { meta, audio: makeAudioMsg(yt) };

  return { meta, audio: null };
}

async function downloadVideo(ytUrl) {
  // All video sources now return { buffer } — send as buffer
  const r1 = await tryFaaMp4(ytUrl);     if (r1) return { videoBuffer: r1.buffer };
  const r2 = await tryNexrayMp4(ytUrl);  if (r2) return { videoBuffer: r2.buffer };
  const r3 = await trySiputzxMp4(ytUrl); if (r3) return { videoBuffer: r3.buffer };
  const r4 = await tryYtdlpVideo(ytUrl); if (r4) return { videoBuffer: r4.buffer };
  return null;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function audioCaption(meta, botName) {
  const views = meta.views ? ` | 👁 ${meta.views} views` : '';
  return `✦✦✦✦✦✦✦✦✦✦
🎵 ${botName} MUSIC
✦✦✦✦✦✦✦✦✦✦

🎙 *${meta.title}*
🎤 ${meta.author || 'Unknown'}
⏱ ${meta.duration || '?'}${views}

━━━━━━━━━━━━━━━━
> 🤖 Powered by ${botName}
> 👨‍💻 Developed by Ahsan Ali Wadani`;
}

function videoCaption(meta, botName) {
  const views = meta.views ? ` | 👁 ${meta.views} views` : '';
  return `✦✦✦✦✦✦✦✦✦✦
🎬 ${botName} VIDEO
✦✦✦✦✦✦✦✦✦✦

🎙 *${meta.title}*
🎤 ${meta.author || 'Unknown'}
⏱ ${meta.duration || '?'}${views}

━━━━━━━━━━━━━━━━
> 🤖 Powered by ${botName}
> 👨‍💻 Developed by Ahsan Ali Wadani`;
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
      return reply(`🎬 *YouTube Downloader*\n\n📌 *Usage:*\n• ${prefix}play <song name>\n• ${prefix}mp3 <youtube link>\n• ${prefix}video <video name>\n• ${prefix}mp4 <youtube link>\n\n✨ Reply to a link also works`);
    }

    try {
      switch (command) {

        // ── VIDEO ──────────────────────────────────────────────────────────
        case 'mp4':
        case 'ytmp4':
        case 'video': {
          await react('🎥');

          let ytUrl = extractUrl(query);
          let meta = null;

          if (!ytUrl) {
            meta = await searchYT(query);
            if (!meta?.url) return reply('❌ No video found for: *' + query + '*');
            ytUrl = meta.url;
          }

          // Show info card while downloading
          if (meta?.thumbnail) {
            await sock.sendMessage(jid, {
              image: { url: meta.thumbnail },
              caption: `${videoCaption(meta, botName)}\n\n⏳ Please wait, downloading video...`,
            }, { quoted: msg });
          }

          const vdata = await downloadVideo(ytUrl);
          if (!vdata) return reply('❌ Video download failed — all sources returned error.');

          const vcap = meta ? videoCaption(meta, botName) : `🎬 *Video Downloaded*\n\n> Powered by ${botName}`;
          await sock.sendMessage(jid, { video: vdata.videoBuffer, mimetype: 'video/mp4', caption: vcap }, { quoted: msg });
          await react('✅');
          break;
        }

        // ── MP3 by URL ─────────────────────────────────────────────────────
        case 'mp3':
        case 'ytmp3': {
          await react('🎶');
          const ytUrl = extractUrl(query);
          if (!ytUrl) return reply(`❌ Please provide a valid YouTube URL.\n\nTo search by name use: *${prefix}play <song name>*`);

          const adata = await downloadAudioByUrl(ytUrl);
          if (!adata) return reply('❌ MP3 download failed — all sources returned error.');

          await sock.sendMessage(jid, { audio: adata.audioBuffer, mimetype: adata.audioMime || 'audio/mpeg' }, { quoted: msg });
          await react('✅');
          break;
        }

        // ── PLAY / SONG / YT ───────────────────────────────────────────────
        case 'play':
        case 'song':
        case 'yt':
        default: {
          await react('📥');

          // Direct URL pasted — skip search, just download
          const directUrl = extractUrl(query);
          if (directUrl) {
            const adata = await downloadAudioByUrl(directUrl);
            if (!adata) return reply('❌ Download failed — all sources returned error.');
            await sock.sendMessage(jid, { audio: adata.audioBuffer, mimetype: adata.audioMime || 'audio/mpeg' }, { quoted: msg });
            await react('✅');
            break;
          }

          // Search by name → download
          const { meta, audio } = await downloadAudioByQuery(query);
          if (!meta) return reply(`❌ Could not find: *${query}*`);
          if (!audio) return reply(`❌ Found *${meta.title}* but download failed — all sources returned error.`);

          // Info card with thumbnail first
          if (meta.thumbnail) {
            const views = meta.views ? ` | 👁 ${meta.views} views` : '';
            await sock.sendMessage(jid, {
              image: { url: meta.thumbnail },
              caption: `✦✦✦✦✦✦✦✦✦✦\n🎵 ${botName} MUSIC\n✦✦✦✦✦✦✦✦✦✦\n\n🎙 *${meta.title}*\n🎤 ${meta.author || 'Unknown'}\n⏱ ${meta.duration || '?'}${views}\n\n━━━━━━━━━━━━━━━━\n⏳ Please wait, downloading audio...\n> 🤖 Powered by ${botName}\n> 👨‍💻 Developed by Ahsan Ali Wadani`,
            }, { quoted: msg });
          }

          // Send audio — buffer only, no link card
          await sock.sendMessage(jid, { audio: audio.audioBuffer, mimetype: audio.audioMime || 'audio/mpeg' }, { quoted: msg });
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
