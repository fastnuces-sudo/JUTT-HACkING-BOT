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

// ── Search ────────────────────────────────────────────────────────────────────
async function searchYT(query) {
  try {
    const { data: d } = await api.get(`https://api-faa.my.id/faa/youtube?q=${encodeURIComponent(query)}`);
    if (d.status && d.result?.length) return { url: d.result[0].link, title: d.result[0].title, thumbnail: d.result[0].imageUrl, duration: d.result[0].duration, author: '' };
  } catch {}
  try {
    const playdl = (await import('play-dl')).default;
    const res = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 });
    if (res?.length) {
      const r = res[0];
      const m = Math.floor((r.durationInSec || 0) / 60), s = String((r.durationInSec || 0) % 60).padStart(2, '0');
      return { url: r.url, title: r.title || query, thumbnail: r.thumbnails?.[0]?.url || '', duration: `${m}:${s}`, author: r.channel?.name || '' };
    }
  } catch {}
  return null;
}

// ── Audio helpers (5 sources) ─────────────────────────────────────────────────

// Source 1: api-faa.my.id ytplay (search + link in one shot)
async function tryFaaPlay(query) {
  try {
    const { data: d } = await api.get(`https://api-faa.my.id/faa/ytplay?query=${encodeURIComponent(query)}`);
    if (d.status && d.result?.mp3) return { audioUrl: d.result.mp3, title: d.result.title, author: d.result.author, thumbnail: d.result.thumbnail };
  } catch {}
  return null;
}

// Source 2: api-faa.my.id ytmp3 (URL-based)
async function tryFaaMp3(url) {
  try {
    const { data: d } = await api.get(`https://api-faa.my.id/faa/ytmp3?url=${encodeURIComponent(url)}`);
    if (d.status && d.result?.mp3) return { audioUrl: d.result.mp3, title: d.result.title || '', thumbnail: d.result.thumbnail || '' };
  } catch {}
  return null;
}

// Source 3: nexray ytmp3
async function tryNexrayMp3(url) {
  try {
    const { data: d } = await api.get(`https://api.nexray.web.id/downloader/ytmp3?url=${encodeURIComponent(url)}`);
    if (d.status && d.result?.url) return { audioUrl: d.result.url, title: d.result.title || '', thumbnail: d.result.thumbnail || '' };
  } catch {}
  return null;
}

// Source 4: siputzx ytmp3
async function trySiputzxMp3(url) {
  try {
    const { data: d } = await api.get(`https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(url)}`);
    if (d.status && d.data?.url) return { audioUrl: d.data.url, title: d.data.title || '', thumbnail: d.data.thumb || '' };
  } catch {}
  return null;
}

// Source 5: SoundCloud via play-dl (stream to buffer — no YouTube needed)
async function trySoundCloud(query, thumbnail = '') {
  try {
    const playdl = (await import('play-dl')).default;
    const scRes = await playdl.search(query, { source: { soundcloud: 'tracks' }, limit: 1 });
    if (!scRes?.length) return null;
    const sc = scRes[0];
    const stream = await playdl.stream(sc.url, { quality: 0 });
    const chunks = [];
    for await (const chunk of stream.stream) chunks.push(chunk);
    return {
      audioBuffer: Buffer.concat(chunks),
      title: sc.name || query,
      author: sc.publisher?.artist || sc.user?.name || 'SoundCloud',
      thumbnail: sc.thumbnail || thumbnail,
    };
  } catch {}
  return null;
}

// Source 6: yt-dlp local (guaranteed last resort for audio)
async function tryYtdlpAudio(urlOrQuery, isUrl = false) {
  const tempDir = path.join(__dirname, '../../temp');
  await fs.ensureDir(tempDir);
  const outFile = path.join(tempDir, `ytaudio_${Date.now()}.mp3`);
  const ck = getCookiesFlag();
  const src = isUrl ? `"${urlOrQuery}"` : `"ytsearch1:${urlOrQuery.replace(/"/g, '')}"`;
  const clients = ['tv_embedded', 'android', 'ios'];
  for (const client of clients) {
    try {
      await execAsync(`${YTDLP} ${src} ${ck} --extractor-args "youtube:player_client=${client}" -x --audio-format mp3 --audio-quality 128K --max-filesize 20m --no-playlist -o "${outFile}" --quiet --no-warnings --no-check-certificate`, { timeout: 90000 });
      if (await fs.pathExists(outFile)) {
        const buf = await fs.readFile(outFile);
        await fs.remove(outFile).catch(() => {});
        return { audioBuffer: buf, title: isUrl ? 'Audio' : urlOrQuery, author: '', thumbnail: '' };
      }
    } catch {}
  }
  await fs.remove(outFile).catch(() => {});
  return null;
}

// ── Video helpers (4 sources) ─────────────────────────────────────────────────

// Source 1: api-faa.my.id ytmp4
async function tryFaaMp4(url) {
  try {
    const { data: d } = await api.get(`https://api-faa.my.id/faa/ytmp4?url=${encodeURIComponent(url)}`);
    if (d.status && d.result?.download_url) return { videoUrl: d.result.download_url };
  } catch {}
  return null;
}

// Source 2: nexray ytmp4
async function tryNexrayMp4(url) {
  try {
    const { data: d } = await api.get(`https://api.nexray.web.id/downloader/ytmp4?url=${encodeURIComponent(url)}`);
    if (d.status && d.result?.url) return { videoUrl: d.result.url };
  } catch {}
  return null;
}

// Source 3: siputzx ytmp4
async function trySiputzxMp4(url) {
  try {
    const { data: d } = await api.get(`https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(url)}`);
    if (d.status && d.data?.url) return { videoUrl: d.data.url };
  } catch {}
  return null;
}

// Source 4: yt-dlp local (guaranteed last resort for video)
async function tryYtdlpVideo(url) {
  const tempDir = path.join(__dirname, '../../temp');
  await fs.ensureDir(tempDir);
  const uid = `ytvideo_${Date.now()}`;
  const outFile = path.join(tempDir, `${uid}.mp4`);
  const outTpl = path.join(tempDir, `${uid}.%(ext)s`);
  const ck = getCookiesFlag();
  const fmts = ['best[height<=480][ext=mp4]', 'best[height<=360][ext=mp4]', 'best[height<=480]', 'best'];
  const clients = ['tv_embedded', 'android', 'ios'];
  for (const client of clients) {
    for (const fmt of fmts) {
      try {
        await execAsync(`${YTDLP} "${url}" ${ck} --extractor-args "youtube:player_client=${client}" -f "${fmt}" -o "${outTpl}" --max-filesize 50m --no-playlist --quiet --no-warnings --no-check-certificate`, { timeout: 180000 });
        const files = await fs.readdir(tempDir);
        const found = files.find(f => f.startsWith(uid));
        if (found) {
          const buf = await fs.readFile(path.join(tempDir, found));
          await fs.remove(path.join(tempDir, found)).catch(() => {});
          return { videoBuffer: buf };
        }
      } catch {}
    }
  }
  return null;
}

// ── Unified getters ───────────────────────────────────────────────────────────

async function getAudio(query) {
  // Try all API sources first (fastest, no local download)
  const r1 = await tryFaaPlay(query);
  if (r1) return r1;

  const meta = await searchYT(query);
  const ytUrl = meta?.url;

  if (ytUrl) {
    const r2 = await tryFaaMp3(ytUrl);
    if (r2) return { ...r2, thumbnail: r2.thumbnail || meta.thumbnail, author: r2.author || meta.author };

    const r3 = await tryNexrayMp3(ytUrl);
    if (r3) return { ...r3, thumbnail: r3.thumbnail || meta.thumbnail, author: meta.author };

    const r4 = await trySiputzxMp3(ytUrl);
    if (r4) return { ...r4, thumbnail: r4.thumbnail || meta.thumbnail, author: meta.author };
  }

  // SoundCloud fallback (no YouTube dependency)
  const r5 = await trySoundCloud(query, meta?.thumbnail);
  if (r5) return r5;

  // yt-dlp last resort
  if (ytUrl) return tryYtdlpAudio(ytUrl, true);
  return tryYtdlpAudio(query, false);
}

async function getAudioByUrl(url) {
  const r1 = await tryFaaMp3(url);
  if (r1) return r1;
  const r2 = await tryNexrayMp3(url);
  if (r2) return r2;
  const r3 = await trySiputzxMp3(url);
  if (r3) return r3;
  return tryYtdlpAudio(url, true);
}

async function getVideo(url) {
  const r1 = await tryFaaMp4(url);
  if (r1) return r1;
  const r2 = await tryNexrayMp4(url);
  if (r2) return r2;
  const r3 = await trySiputzxMp4(url);
  if (r3) return r3;
  return tryYtdlpVideo(url);
}

// ── Send helpers ──────────────────────────────────────────────────────────────

function buildAudioMsg(data) {
  if (data.audioBuffer) return { audio: data.audioBuffer, mimetype: 'audio/mpeg' };
  return {
    audio: { url: data.audioUrl },
    mimetype: 'audio/mpeg',
    contextInfo: {
      externalAdReply: {
        title: data.title || 'Audio',
        body: data.author || '',
        thumbnailUrl: data.thumbnail || '',
        mediaType: 2,
        renderLargerThumbnail: true,
      },
    },
  };
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
      return reply(`🎬 *YouTube Downloader*

📌 *Usage:*
• ${prefix}play <song name>
• ${prefix}mp3 <youtube link>
• ${prefix}video <video name>
• ${prefix}mp4 <youtube link>

✨ Reply to a link also works`);
    }

    try {
      switch (command) {

        // ── VIDEO ─────────────────────────────────────────────────────────────
        case 'mp4':
        case 'ytmp4':
        case 'video': {
          await react('🎥');
          let videoUrl = extractUrl(query);
          let meta = null;

          if (!videoUrl) {
            meta = await searchYT(query);
            if (!meta?.url) return reply('❌ No video found for: *' + query + '*');
            videoUrl = meta.url;
            if (meta.thumbnail) {
              await sock.sendMessage(jid, {
                image: { url: meta.thumbnail },
                caption: `🎬 *${meta.title}*\n⏱ ${meta.duration}\n\n⬇️ Downloading...`,
              }, { quoted: msg });
            }
          }

          const vdata = await getVideo(videoUrl);
          if (!vdata) return reply('❌ Video download failed — could not download from any source.');

          if (vdata.videoBuffer) {
            await sock.sendMessage(jid, { video: vdata.videoBuffer, mimetype: 'video/mp4', caption: `🎬 *Video Downloaded*\n\n> Powered by ${botName}` }, { quoted: msg });
          } else {
            await sock.sendMessage(jid, { video: { url: vdata.videoUrl }, mimetype: 'video/mp4', caption: `🎬 *Video Downloaded*\n\n> Powered by ${botName}` }, { quoted: msg });
          }
          await react('✅');
          break;
        }

        // ── MP3 by URL ────────────────────────────────────────────────────────
        case 'mp3':
        case 'ytmp3': {
          await react('🎶');
          const audioUrl = extractUrl(query);
          if (!audioUrl) return reply('❌ Please provide a valid YouTube URL.\n\nTo search by name use: *' + prefix + 'play <song name>*');
          const adata = await getAudioByUrl(audioUrl);
          if (!adata) return reply('❌ MP3 download failed — could not download from any source.');
          await sock.sendMessage(jid, buildAudioMsg(adata), { quoted: msg });
          await react('✅');
          break;
        }

        // ── PLAY / SONG / YT ──────────────────────────────────────────────────
        case 'play':
        case 'song':
        case 'yt':
        default: {
          await react('📥');

          // Direct YouTube URL pasted
          const directUrl = extractUrl(query);
          if (directUrl) {
            const adata = await getAudioByUrl(directUrl);
            if (!adata) return reply('❌ Download failed — could not download from any source.');
            await sock.sendMessage(jid, buildAudioMsg(adata), { quoted: msg });
            await react('✅');
            break;
          }

          // Search by name
          const result = await getAudio(query);
          if (!result) return reply(`❌ Could not find or download: *${query}*`);

          if (result.thumbnail) {
            await sock.sendMessage(jid, {
              image: { url: result.thumbnail },
              caption: `🎶 *${result.title}*\n👤 ${result.author || ''}\n\n⬇️ Downloading...`,
            }, { quoted: msg });
          }

          await sock.sendMessage(jid, buildAudioMsg(result), { quoted: msg });
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
