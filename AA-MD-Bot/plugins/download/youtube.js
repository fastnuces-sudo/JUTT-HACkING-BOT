// ============================================
// AA MD Bot - YouTube Downloader
// Audio: DavidCyrilTech → ABZTech (ytdlv3) → EliteProTech
// Video: yt-dlp PRIMARY (format 18/22) — API for metadata only
// Search: DavidCyrilTech
// Card: externalAdReply (title + thumbnail)
// ============================================

import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { YTDLP, YTDLP_FLAGS, getCookiesArgs } from '../../lib/ytdlp.js';

const execFileAsync = promisify(execFile);
const __dirname2 = path.dirname(fileURLToPath(import.meta.url));
const TEMP = path.join(__dirname2, '../../temp');

const YT_REGEX =
  /(https?:\/\/(?:(?:www|m|music)\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]+\S*)/i;

const extractUrl = (t) => { if (!t) return null; const m = t.match(YT_REGEX); return m ? m[1] : null; };

// ── Fetch audio URL as Buffer (for audio APIs that return direct CDN links) ────
async function fetchBuf(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 90000,
    maxContentLength: 150 * 1024 * 1024,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  return Buffer.from(res.data);
}

// ── yt-dlp video download (PRIMARY for YouTube video) ─────────────────────────
async function ytdlpVideo(ytUrl) {
  await fs.ensureDir(TEMP);
  const reqId = `yt_vid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const outFile = path.join(TEMP, `${reqId}.mp4`);
  const flags = YTDLP_FLAGS.split(/\s+/).filter(Boolean);
  const ckArgs = getCookiesArgs();
  // Format 18 = 360p combined MP4, 22 = 720p combined MP4 — confirmed working on Replit
  const FMTS = ['18/22', 'best[height<=720][ext=mp4]/best[height<=720]/best[ext=mp4]/best', 'best'];
  for (const fmt of FMTS) {
    try {
      await execFileAsync(YTDLP, [
        ...flags, ytUrl, ...ckArgs,
        '-f', fmt,
        '--merge-output-format', 'mp4',
        '--no-playlist', '-o', outFile,
        '--quiet', '--no-warnings',
      ], { timeout: 180000 });
      if (await fs.pathExists(outFile)) {
        const buf = await fs.readFile(outFile);
        await fs.remove(outFile).catch(() => {});
        if (buf?.length > 50000) return buf;
      }
    } catch {}
  }
  await fs.remove(outFile).catch(() => {});
  return null;
}

// ── Search (DavidCyrilTech) ────────────────────────────────────────────────────
async function searchYT(query) {
  const { data } = await axios.get(
    `https://apis.davidcyriltech.my.id/youtube/search?query=${encodeURIComponent(query)}`,
    { timeout: 15000 }
  );
  const results = data?.result || data?.results || data?.data || [];
  if (!Array.isArray(results) || !results.length) return null;
  const r = results[0];
  return {
    url:       r.url       || r.link         || r.videoUrl   || '',
    title:     r.title     || query,
    thumbnail: r.thumbnail || r.image        || '',
    duration:  r.duration  || '',
    author:    r.channel   || r.channelTitle || '',
  };
}

// ── Audio: DavidCyrilTech → ABZTech ytdlv3 → EliteProTech ─────────────────────
async function getAudio(ytUrl) {
  const enc = encodeURIComponent(ytUrl);

  // 1. DavidCyrilTech (PRIMARY)
  try {
    const { data: d } = await axios.get(
      `https://apis.davidcyriltech.my.id/download/ytmp3?url=${enc}`,
      { timeout: 30000 }
    );
    const r   = d?.result || d;
    const url = r?.download_url || r?.downloadUrl || r?.url || d?.url;
    if (typeof url === 'string' && url.startsWith('http')) {
      return { url, title: r?.title || d?.title || '', thumbnail: r?.thumbnail || d?.thumbnail || '', filename: r?.filename || 'audio.mp3' };
    }
  } catch {}

  // 2. ABZTech ytdlv3 (audio-specific)
  try {
    const { data: d } = await axios.get(
      `https://api-abztech.zone.id/download/ytdlv3?url=${enc}`,
      { timeout: 30000 }
    );
    const url = d?.downloadUrl || d?.download_url || d?.url || d?.result?.url;
    if (d?.status !== false && typeof url === 'string' && url.startsWith('http')) {
      return { url, title: d?.title || '', thumbnail: d?.thumbnail || '', filename: d?.filename || 'audio.mp3' };
    }
  } catch {}

  // 3. EliteProTech
  try {
    const { data: d } = await axios.get(
      `https://eliteprotech-apis.zone.id/ytdown?url=${enc}&format=mp3`,
      { timeout: 30000 }
    );
    const url = d?.downloadURL || d?.download_url || d?.url || d?.result?.url || d?.result?.download_url;
    if (typeof url === 'string' && url.startsWith('http')) {
      return { url, title: d?.title || '', thumbnail: d?.thumbnail || '', filename: d?.filename || 'audio.mp3' };
    }
  } catch {}

  return null;
}

// ── Video: DavidCyrilTech → EliteProTech → ABZTech ytdl4 ──────────────────────
async function getVideo(ytUrl) {
  const enc = encodeURIComponent(ytUrl);

  // 1. DavidCyrilTech (PRIMARY)
  try {
    const { data: d } = await axios.get(
      `https://apis.davidcyriltech.my.id/download/ytmp4?url=${enc}`,
      { timeout: 30000 }
    );
    const r   = d?.result || d;
    const url = r?.download_url || r?.downloadUrl || r?.url || d?.url;
    if (typeof url === 'string' && url.startsWith('http')) {
      return { url, title: r?.title || d?.title || '', thumbnail: r?.thumbnail || d?.thumbnail || '', filename: r?.filename || 'video.mp4' };
    }
  } catch {}

  // 2. EliteProTech
  try {
    const { data: d } = await axios.get(
      `https://eliteprotech-apis.zone.id/ytdown?url=${enc}&format=mp4`,
      { timeout: 30000 }
    );
    const url = d?.downloadURL || d?.download_url || d?.url || d?.result?.url || d?.result?.download_url;
    if (typeof url === 'string' && url.startsWith('http')) {
      return { url, title: d?.title || '', thumbnail: d?.thumbnail || '', filename: d?.filename || 'video.mp4' };
    }
  } catch {}

  // 3. ABZTech ytdl4 (last fallback)
  try {
    const { data: d } = await axios.get(
      `https://api-abztech.zone.id/download/ytdl4?url=${enc}`,
      { timeout: 30000 }
    );
    const url = d?.downloadUrl || d?.download_url || d?.url || d?.result?.url;
    if (d?.status !== false && typeof url === 'string' && url.startsWith('http')) {
      return { url, title: d?.title || '', thumbnail: d?.thumbnail || '', filename: d?.filename || 'video.mp4' };
    }
  } catch {}

  return null;
}

// ── externalAdReply card contextInfo ──────────────────────────────────────────
function buildCtx(title, thumbnail, ytUrl) {
  return {
    externalAdReply: {
      title:                title || 'YouTube',
      body:                 'AA MD Bot',
      thumbnailUrl:         thumbnail || '',
      mediaType:            1,
      mediaUrl:             ytUrl || '',
      sourceUrl:            ytUrl || '',
      renderLargerThumbnail: true,
      showAdAttribution:    false,
    },
  };
}

// ── Captions ──────────────────────────────────────────────────────────────────
function audioCaption(meta, botName) {
  return (
    `✦✦✦✦✦✦✦✦✦✦\n🎵 ${botName} MUSIC\n✦✦✦✦✦✦✦✦✦✦\n\n` +
    `🎙 *${meta.title}*\n` +
    `🎤 ${meta.author || 'Unknown'}\n` +
    `⏱ ${meta.duration || '?'}\n\n` +
    `> 🤖 Powered by ${botName}\n> 👨‍💻 Ahsan Ali Wadani`
  );
}

function videoCaption(meta, botName) {
  return (
    `✦✦✦✦✦✦✦✦✦✦\n🎬 ${botName} VIDEO\n✦✦✦✦✦✦✦✦✦✦\n\n` +
    `🎙 *${meta.title}*\n` +
    `🎤 ${meta.author || 'Unknown'}\n` +
    `⏱ ${meta.duration || '?'}\n\n` +
    `> 🤖 Powered by ${botName}\n> 👨‍💻 Ahsan Ali Wadani`
  );
}

// ── Plugin ────────────────────────────────────────────────────────────────────
export default {
  command: 'play',
  alias: ['song', 'yt', 'ytmp3', 'mp3', 'ytmp4', 'video', 'mp4'],
  description: 'Download YouTube audio or video',
  category: 'download',

  execute: async ({ sock, msg, jid, text, command, react, reply, sendMedia, prefix, config }) => {
    const botName = config?.botName || 'AA MD Bot';
    let query = text?.trim();

    // Also accept quoted message text
    if (!query) {
      const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (q) query = (q.conversation || q.extendedTextMessage?.text || '').trim();
    }

    if (!query) {
      return reply(
        `🎬 *YouTube Downloader*\n\n` +
        `📌 *Usage:*\n` +
        `• *${prefix}play* <song name> — search & download audio\n` +
        `• *${prefix}mp3* <youtube link> — direct audio\n` +
        `• *${prefix}video* <name or link> — download video\n` +
        `• *${prefix}mp4* <youtube link> — direct video\n\n` +
        `✨ Reply to a YouTube link also works`
      );
    }

    try {
      // ── VIDEO ───────────────────────────────────────────────────────────────
      if (command === 'mp4' || command === 'ytmp4' || command === 'video') {
        await react('🎥');
        let ytUrl = extractUrl(query);
        let meta  = { title: query, author: '', duration: '', thumbnail: '' };

        if (!ytUrl) {
          const found = await searchYT(query);
          if (!found?.url) { await react('❌'); return reply(`❌ No result found for: *${query}*`); }
          ytUrl = found.url;
          meta  = found;
        }

        // Get metadata from API (title/thumbnail) — download via yt-dlp
        const apiMeta = await getVideo(ytUrl);
        if (!meta.title && apiMeta?.title) meta.title = apiMeta.title;
        if (!meta.thumbnail && apiMeta?.thumbnail) meta.thumbnail = apiMeta.thumbnail;

        const buf = await ytdlpVideo(ytUrl);
        if (!buf || buf.length < 50000) {
          await react('❌');
          return reply(`❌ *Video download failed* — try again or use a different link.`);
        }

        await sendMedia({
          video:       buf,
          mimetype:    'video/mp4',
          fileName:    'video.mp4',
          caption:     videoCaption(meta, botName),
          contextInfo: buildCtx(meta.title, meta.thumbnail, ytUrl),
        });
        await react('✅');
        return;
      }

      // ── DIRECT MP3 (link only) ──────────────────────────────────────────────
      if (command === 'mp3' || command === 'ytmp3') {
        await react('🎶');
        const ytUrl = extractUrl(query);
        if (!ytUrl) {
          return reply(
            `❌ Please provide a valid YouTube URL.\n\n` +
            `To search by name: *${prefix}play <song name>*`
          );
        }

        const result = await getAudio(ytUrl);
        if (!result?.url) {
          await react('❌');
          return reply(`❌ *MP3 download failed*\n\nAll 3 sources unavailable. Try again later.`);
        }

        const buf = await fetchBuf(result.url);
        if (!buf || buf.length < 10000) {
          await react('❌');
          return reply(`❌ *Audio file invalid* — try again.`);
        }

        await sendMedia({
          audio:       buf,
          mimetype:    'audio/mpeg',
          fileName:    result.filename || 'audio.mp3',
          ptt:         false,
          contextInfo: buildCtx(result.title, result.thumbnail, ytUrl),
        });
        await react('✅');
        return;
      }

      // ── PLAY / SONG / YT — search by name (or direct URL) ──────────────────
      await react('📥');
      const directUrl = extractUrl(query);
      let ytUrl = directUrl;
      let meta  = { title: query, author: '', duration: '', thumbnail: '' };

      if (!ytUrl) {
        const found = await searchYT(query);
        if (!found?.url) { await react('❌'); return reply(`❌ Could not find: *${query}*`); }
        ytUrl = found.url;
        meta  = found;
      }

      const result = await getAudio(ytUrl);
      if (!result?.url) {
        await react('❌');
        return reply(`❌ *Audio download failed*\n\nAll 3 sources unavailable. Try again later.`);
      }

      if (!meta.title && result.title) meta.title = result.title;
      if (!meta.thumbnail && result.thumbnail) meta.thumbnail = result.thumbnail;

      const buf = await fetchBuf(result.url);
      if (!buf || buf.length < 10000) {
        await react('❌');
        return reply(`❌ *Audio file invalid* — try again.`);
      }

      await sendMedia({
        audio:       buf,
        mimetype:    'audio/mpeg',
        fileName:    result.filename || 'audio.mp3',
        ptt:         false,
        contextInfo: buildCtx(meta.title, meta.thumbnail, ytUrl),
      });
      await react('✅');

    } catch (err) {
      console.error('[ YouTube ]', err.message);
      await react('❌').catch(() => {});
      reply('❌ Download failed. Please try again.').catch(() => {});
    }
  },
};
