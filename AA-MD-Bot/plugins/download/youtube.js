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

// ── Search (play-dl first for accuracy, faa fallback) ─────────────────────────
async function searchYT(query) {
  // Primary: play-dl YouTube search — most accurate results
  try {
    const playdl = (await import('play-dl')).default;
    const res = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 });
    if (res?.length) {
      const r = res[0];
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
  // Fallback: api-faa.my.id search
  try {
    const { data: d } = await api.get(`https://api-faa.my.id/faa/youtube?q=${encodeURIComponent(query)}`);
    if (d.status && d.result?.length) {
      const r = d.result[0];
      return { url: r.link, title: r.title, thumbnail: r.imageUrl, duration: r.duration, author: r.channel || '', views: '' };
    }
  } catch {}
  return null;
}

// ── Audio download sources ────────────────────────────────────────────────────

async function tryFaaPlay(query) {
  try {
    const { data: d } = await api.get(`https://api-faa.my.id/faa/ytplay?query=${encodeURIComponent(query)}`);
    if (d.status && d.result?.mp3) return d.result.mp3;
  } catch {}
  return null;
}

async function tryFaaMp3(url) {
  try {
    const { data: d } = await api.get(`https://api-faa.my.id/faa/ytmp3?url=${encodeURIComponent(url)}`);
    if (d.status && d.result?.mp3) return d.result.mp3;
  } catch {}
  return null;
}

async function tryNexrayMp3(url) {
  try {
    const { data: d } = await api.get(`https://api.nexray.web.id/downloader/ytmp3?url=${encodeURIComponent(url)}`);
    if (d.status && d.result?.url) return d.result.url;
  } catch {}
  return null;
}

async function trySiputzxMp3(url) {
  try {
    const { data: d } = await api.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(url)}`);
    if (d.status && d.data?.url) return d.data.url;
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
    return { buffer: Buffer.concat(chunks), title: sc.name || query, author: sc.publisher?.artist || sc.user?.name || 'SoundCloud', thumbnail: sc.thumbnail || '' };
  } catch {}
  return null;
}

async function tryYtdlpAudio(url, isUrl = true) {
  const tempDir = path.join(__dirname, '../../temp');
  await fs.ensureDir(tempDir);
  const out = path.join(tempDir, `yta_${Date.now()}.mp3`);
  const ck = getCookiesFlag();
  const src = isUrl ? `"${url}"` : `"ytsearch1:${url.replace(/"/g, '')}"`;
  for (const client of ['tv_embedded', 'android', 'ios']) {
    try {
      await execAsync(`${YTDLP} ${src} ${ck} --extractor-args "youtube:player_client=${client}" -x --audio-format mp3 --audio-quality 128K --max-filesize 20m --no-playlist -o "${out}" --quiet --no-warnings --no-check-certificate`, { timeout: 90000 });
      if (await fs.pathExists(out)) {
        const buf = await fs.readFile(out);
        await fs.remove(out).catch(() => {});
        return { buffer: buf };
      }
    } catch {}
  }
  await fs.remove(out).catch(() => {});
  return null;
}

// ── Video download sources ────────────────────────────────────────────────────

async function tryFaaMp4(url) {
  try {
    const { data: d } = await api.get(`https://api-faa.my.id/faa/ytmp4?url=${encodeURIComponent(url)}`);
    if (d.status && d.result?.download_url) return { url: d.result.download_url };
  } catch {}
  return null;
}

async function tryNexrayMp4(url) {
  try {
    const { data: d } = await api.get(`https://api.nexray.web.id/downloader/ytmp4?url=${encodeURIComponent(url)}`);
    if (d.status && d.result?.url) return { url: d.result.url };
  } catch {}
  return null;
}

async function trySiputzxMp4(url) {
  try {
    const { data: d } = await api.get(`https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(url)}`);
    if (d.status && d.data?.url) return { url: d.data.url };
  } catch {}
  return null;
}

async function tryYtdlpVideo(url) {
  const tempDir = path.join(__dirname, '../../temp');
  await fs.ensureDir(tempDir);
  const uid = `ytv_${Date.now()}`;
  const outTpl = path.join(tempDir, `${uid}.%(ext)s`);
  const ck = getCookiesFlag();
  for (const client of ['tv_embedded', 'android', 'ios']) {
    for (const fmt of ['best[height<=480][ext=mp4]', 'best[height<=360][ext=mp4]', 'best[height<=480]', 'best']) {
      try {
        await execAsync(`${YTDLP} "${url}" ${ck} --extractor-args "youtube:player_client=${client}" -f "${fmt}" -o "${outTpl}" --max-filesize 50m --no-playlist --quiet --no-warnings --no-check-certificate`, { timeout: 180000 });
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

async function downloadAudioByUrl(ytUrl) {
  const r1 = await tryFaaMp3(ytUrl); if (r1) return { audioUrl: r1 };
  const r2 = await tryNexrayMp3(ytUrl); if (r2) return { audioUrl: r2 };
  const r3 = await trySiputzxMp3(ytUrl); if (r3) return { audioUrl: r3 };
  const r4 = await tryYtdlpAudio(ytUrl, true); if (r4) return { audioBuffer: r4.buffer };
  return null;
}

async function downloadAudioByQuery(query) {
  // Step 1: accurate YouTube search to get exact URL
  const meta = await searchYT(query);
  if (!meta) return { meta: null, audio: null };

  // Step 2: download by exact URL (ensures accuracy)
  const r1 = await tryFaaMp3(meta.url); if (r1) return { meta, audio: { audioUrl: r1 } };
  const r2 = await tryNexrayMp3(meta.url); if (r2) return { meta, audio: { audioUrl: r2 } };
  const r3 = await trySiputzxMp3(meta.url); if (r3) return { meta, audio: { audioUrl: r3 } };

  // Step 3: SoundCloud fallback (not YouTube, but same song name)
  const sc = await trySoundCloud(query);
  if (sc) return {
    meta: { ...meta, title: sc.title, author: sc.author, thumbnail: sc.thumbnail || meta.thumbnail },
    audio: { audioBuffer: sc.buffer },
  };

  // Step 4: yt-dlp last resort (exact URL)
  const yt = await tryYtdlpAudio(meta.url, true);
  if (yt) return { meta, audio: { audioBuffer: yt.buffer } };

  return { meta, audio: null };
}

async function downloadVideo(ytUrl) {
  const r1 = await tryFaaMp4(ytUrl); if (r1) return { videoUrl: r1.url };
  const r2 = await tryNexrayMp4(ytUrl); if (r2) return { videoUrl: r2.url };
  const r3 = await trySiputzxMp4(ytUrl); if (r3) return { videoUrl: r3.url };
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

          if (vdata.videoBuffer) {
            await sock.sendMessage(jid, { video: vdata.videoBuffer, mimetype: 'video/mp4', caption: vcap }, { quoted: msg });
          } else {
            await sock.sendMessage(jid, { video: { url: vdata.videoUrl }, mimetype: 'video/mp4', caption: vcap }, { quoted: msg });
          }
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

          const amsg = adata.audioBuffer
            ? { audio: adata.audioBuffer, mimetype: 'audio/mpeg' }
            : { audio: { url: adata.audioUrl }, mimetype: 'audio/mpeg' };
          await sock.sendMessage(jid, amsg, { quoted: msg });
          await react('✅');
          break;
        }

        // ── PLAY / SONG / YT ───────────────────────────────────────────────
        case 'play':
        case 'song':
        case 'yt':
        default: {
          await react('📥');

          // Direct URL pasted
          const directUrl = extractUrl(query);
          if (directUrl) {
            const adata = await downloadAudioByUrl(directUrl);
            if (!adata) return reply('❌ Download failed — all sources returned error.');
            const amsg = adata.audioBuffer
              ? { audio: adata.audioBuffer, mimetype: 'audio/mpeg' }
              : { audio: { url: adata.audioUrl }, mimetype: 'audio/mpeg' };
            await sock.sendMessage(jid, amsg, { quoted: msg });
            await react('✅');
            break;
          }

          // Search by query
          const { meta, audio } = await downloadAudioByQuery(query);

          if (!meta) return reply(`❌ Could not find: *${query}*`);
          if (!audio) return reply(`❌ Found *${meta.title}* but download failed — all sources returned error.`);

          // Send info card with thumbnail
          if (meta.thumbnail) {
            const views = meta.views ? ` | 👁 ${meta.views} views` : '';
            await sock.sendMessage(jid, {
              image: { url: meta.thumbnail },
              caption: `✦✦✦✦✦✦✦✦✦✦\n🎵 ${botName} MUSIC\n✦✦✦✦✦✦✦✦✦✦\n\n🎙 *${meta.title}*\n🎤 ${meta.author || 'Unknown'}\n⏱ ${meta.duration || '?'}${views}\n\n━━━━━━━━━━━━━━━━\n⏳ Please wait, downloading audio...\n> 🤖 Powered by ${botName}\n> 👨‍💻 Developed by Ahsan Ali Wadani`,
            }, { quoted: msg });
          }

          // Send the audio
          const amsg = audio.audioBuffer
            ? { audio: audio.audioBuffer, mimetype: 'audio/mpeg' }
            : {
                audio: { url: audio.audioUrl },
                mimetype: 'audio/mpeg',
                contextInfo: {
                  externalAdReply: {
                    title: meta.title,
                    body: meta.author || '',
                    thumbnailUrl: meta.thumbnail || '',
                    mediaType: 2,
                    renderLargerThumbnail: true,
                  },
                },
              };

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
