import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { YTDLP, getCookiesFlag } from '../../lib/ytdlp.js';
import { getPoTokenArgs } from '../../lib/potoken.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const YT_REGEX =
  /^(https?:\/\/)?((www|m|music)\.)?(youtube(-nocookie)?\.com\/(watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]+(\S+)?$/i;

const extractUrl = (t) => { if (!t) return null; const m = t.match(YT_REGEX); return m ? m[0] : null; };
const api = axios.create({ timeout: 20000 });

const MAX_AUDIO_MB = 18;
const MAX_VIDEO_MB = 18;

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

// ── Search (top 5 results + best-match scoring) ───────────────────────────────
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
      const top = d.result.slice(0, 3);
      const scored = top.map(r => ({ r, score: scoreMatch(r.title, query) }));
      scored.sort((a, b) => b.score - a.score);
      const r = scored[0].r;
      return { url: r.link, title: r.title, thumbnail: r.imageUrl, duration: r.duration, author: r.channel || '', views: '' };
    }
  } catch {}
  return null;
}

// ── URL size/type validator (HEAD request — no download) ──────────────────────
async function headOk(url, maxMB, rejectVideoType = false) {
  try {
    const resp = await axios.head(url, { timeout: 8000, maxRedirects: 5 });
    const cl = parseInt(resp.headers['content-length'] || '0');
    const ct = (resp.headers['content-type'] || '').toLowerCase();
    if (cl && cl > maxMB * 1024 * 1024) return false; // too large
    if (rejectVideoType && ct.startsWith('video/')) return false; // wrong type for audio
    return true;
  } catch { return false; }
}

// ── Audio API sources — return { url, mime } if passes HEAD check ─────────────
async function tryFaaMp3(ytUrl) {
  try {
    const { data: d } = await api.get(`https://api-faa.my.id/faa/ytmp3?url=${encodeURIComponent(ytUrl)}`);
    const u = d?.result?.mp3;
    if (u && await headOk(u, MAX_AUDIO_MB, true)) return { url: u, mime: 'audio/mpeg' };
  } catch {}
  return null;
}

async function tryNexrayMp3(ytUrl) {
  try {
    const { data: d } = await api.get(`https://api.nexray.web.id/downloader/ytmp3?url=${encodeURIComponent(ytUrl)}`);
    const u = d?.result?.url;
    if (u && await headOk(u, MAX_AUDIO_MB, true)) return { url: u, mime: 'audio/mpeg' };
  } catch {}
  return null;
}

async function trySiputzxMp3(ytUrl) {
  try {
    const { data: d } = await api.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(ytUrl)}`);
    const u = d?.data?.url;
    if (u && await headOk(u, MAX_AUDIO_MB, true)) return { url: u, mime: 'audio/mpeg' };
  } catch {}
  return null;
}

// ── SoundCloud fallback (streams to buffer — completely bypasses YouTube) ─────
async function trySoundCloud(query, thumbnail = '') {
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
    return {
      buffer: buf, mime: 'audio/mpeg',
      scTitle: sc.name || query,
      scAuthor: sc.publisher?.artist || sc.user?.name || 'SoundCloud',
      scThumb: sc.thumbnail || thumbnail,
    };
  } catch {}
  return null;
}

// ── yt-dlp audio — 128K MP3, with PO token ───────────────────────────────────
async function tryYtdlpAudio(ytUrl) {
  const tempDir = path.join(__dirname, '../../temp');
  await fs.ensureDir(tempDir);
  const out = path.join(tempDir, `yta_${Date.now()}.mp3`);
  const ck = getCookiesFlag();
  const po = await getPoTokenArgs();
  for (const client of ['tv_embedded', 'android', 'ios']) {
    try {
      await execAsync(
        `${YTDLP} "${ytUrl}" ${ck} ${po} --extractor-args "youtube:player_client=${client}" -x --audio-format mp3 --audio-quality 128K --no-playlist -o "${out}" --quiet --no-warnings --no-check-certificate`,
        { timeout: 180000 }
      );
      if (await fs.pathExists(out)) {
        const buf = await fs.readFile(out);
        await fs.remove(out).catch(() => {});
        return { buffer: buf, mime: 'audio/mpeg' };
      }
    } catch {}
  }
  await fs.remove(out).catch(() => {});
  return null;
}

// ── Video API sources — return { url } if passes HEAD check ──────────────────
async function tryFaaMp4(ytUrl) {
  try {
    const { data: d } = await api.get(`https://api-faa.my.id/faa/ytmp4?url=${encodeURIComponent(ytUrl)}`);
    const u = d?.result?.download_url;
    if (u && await headOk(u, MAX_VIDEO_MB)) return { url: u };
  } catch {}
  return null;
}

async function tryNexrayMp4(ytUrl) {
  try {
    const { data: d } = await api.get(`https://api.nexray.web.id/downloader/ytmp4?url=${encodeURIComponent(ytUrl)}`);
    const u = d?.result?.url;
    if (u && await headOk(u, MAX_VIDEO_MB)) return { url: u };
  } catch {}
  return null;
}

async function trySiputzxMp4(ytUrl) {
  try {
    const { data: d } = await api.get(`https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(ytUrl)}`);
    const u = d?.data?.url;
    if (u && await headOk(u, MAX_VIDEO_MB)) return { url: u };
  } catch {}
  return null;
}

// ── yt-dlp video — 360p mp4, with PO token ───────────────────────────────────
async function tryYtdlpVideo(ytUrl) {
  const tempDir = path.join(__dirname, '../../temp');
  await fs.ensureDir(tempDir);
  const uid = `ytv_${Date.now()}`;
  const outTpl = path.join(tempDir, `${uid}.%(ext)s`);
  const ck = getCookiesFlag();
  const po = await getPoTokenArgs();
  for (const client of ['tv_embedded', 'android', 'ios']) {
    for (const fmt of ['best[height<=360][ext=mp4]', 'best[height<=360]', 'best[height<=480][ext=mp4]', 'best']) {
      try {
        await execAsync(
          `${YTDLP} "${ytUrl}" ${ck} ${po} --extractor-args "youtube:player_client=${client}" -f "${fmt}" --no-playlist -o "${outTpl}" --quiet --no-warnings --no-check-certificate`,
          { timeout: 180000 }
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

async function downloadAudio(ytUrl, query) {
  // 1-3: API sources via URL (HEAD-validated, WhatsApp downloads directly)
  const a1 = await tryFaaMp3(ytUrl);     if (a1) return { url: a1.url, mime: a1.mime };
  const a2 = await tryNexrayMp3(ytUrl);  if (a2) return { url: a2.url, mime: a2.mime };
  const a3 = await trySiputzxMp3(ytUrl); if (a3) return { url: a3.url, mime: a3.mime };
  // 4: SoundCloud fallback (no YouTube dependency, no size issues)
  if (query) {
    const sc = await trySoundCloud(query);
    if (sc) return { buffer: sc.buffer, mime: sc.mime, scMeta: { title: sc.scTitle, author: sc.scAuthor, thumbnail: sc.scThumb } };
  }
  // 5: yt-dlp with PO token (guaranteed, controlled quality)
  const yt = await tryYtdlpAudio(ytUrl);
  if (yt) return { buffer: yt.buffer, mime: yt.mime };
  return null;
}

async function downloadVideo(ytUrl) {
  const v1 = await tryFaaMp4(ytUrl);     if (v1) return { url: v1.url };
  const v2 = await tryNexrayMp4(ytUrl);  if (v2) return { url: v2.url };
  const v3 = await trySiputzxMp4(ytUrl); if (v3) return { url: v3.url };
  const yt = await tryYtdlpVideo(ytUrl); if (yt)  return { buffer: yt.buffer };
  return null;
}

// ── UI captions ───────────────────────────────────────────────────────────────

function buildAudioCaption(meta, botName) {
  const views = meta.views ? ` | 👁 ${meta.views} views` : '';
  return (
    `✦✦✦✦✦✦✦✦✦✦\n` +
    `🎵 ${botName} MUSIC\n` +
    `✦✦✦✦✦✦✦✦✦✦\n\n` +
    `🎙 *${meta.title}*\n` +
    `🎤 ${meta.author || 'Unknown'}\n` +
    `⏱ ${meta.duration || '?'}${views}\n\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `⏳ Please wait, downloading audio...\n` +
    `> 🤖 Powered by ${botName}\n` +
    `> 👨‍💻 Developed by Ahsan Ali Wadani`
  );
}

function buildVideoCaption(meta, botName) {
  const views = meta.views ? ` | 👁 ${meta.views} views` : '';
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
              caption: `${buildVideoCaption(meta, botName)}\n\n⏳ Downloading...`,
            }, { quoted: msg });
          }

          const vdata = await downloadVideo(ytUrl);
          if (!vdata) return reply('❌ Video download failed — all sources returned error.');

          const vcap = meta ? buildVideoCaption(meta, botName) : `🎬 *Video Downloaded*\n\n> Powered by ${botName}`;
          if (vdata.buffer) {
            await sock.sendMessage(jid, { video: vdata.buffer, mimetype: 'video/mp4', caption: vcap }, { quoted: msg });
          } else {
            await sock.sendMessage(jid, { video: { url: vdata.url }, mimetype: 'video/mp4', caption: vcap }, { quoted: msg });
          }
          await react('✅');
          break;
        }

        // ── MP3 by direct URL ─────────────────────────────────────────────────
        case 'mp3':
        case 'ytmp3': {
          await react('🎶');
          const ytUrl = extractUrl(query);
          if (!ytUrl) return reply(`❌ Please provide a valid YouTube URL.\n\nTo search by name: *${prefix}play <song name>*`);
          const adata = await downloadAudio(ytUrl, null);
          if (!adata) return reply('❌ MP3 download failed — all sources returned error.');
          const amsg = adata.buffer
            ? { audio: adata.buffer, mimetype: adata.mime }
            : { audio: { url: adata.url }, mimetype: adata.mime };
          await sock.sendMessage(jid, amsg, { quoted: msg });
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
            const adata = await downloadAudio(directUrl, null);
            if (!adata) return reply('❌ Download failed — all sources returned error.');
            const amsg = adata.buffer
              ? { audio: adata.buffer, mimetype: adata.mime }
              : { audio: { url: adata.url }, mimetype: adata.mime };
            await sock.sendMessage(jid, amsg, { quoted: msg });
            await react('✅');
            break;
          }

          // Search → get exact YouTube URL → download
          const meta = await searchYT(query);
          if (!meta?.url) return reply(`❌ Could not find: *${query}*`);

          // Show info card while downloading
          if (meta.thumbnail) {
            await sock.sendMessage(jid, {
              image: { url: meta.thumbnail },
              caption: buildAudioCaption(meta, botName),
            }, { quoted: msg });
          }

          const adata = await downloadAudio(meta.url, query);

          if (!adata) return reply(`❌ Found *${meta.title}* but download failed — all sources returned error.`);

          // If SoundCloud was used, scMeta has updated title/author
          const finalMeta = adata.scMeta
            ? { ...meta, title: adata.scMeta.title || meta.title, author: adata.scMeta.author || meta.author }
            : meta;

          const amsg = adata.buffer
            ? { audio: adata.buffer, mimetype: adata.mime }
            : { audio: { url: adata.url }, mimetype: adata.mime };

          await sock.sendMessage(jid, amsg, { quoted: msg });
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
