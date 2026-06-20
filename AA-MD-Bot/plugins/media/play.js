// ============================================
// AA MD Bot - Play Audio Plugin
// Developer: Ahsan Ali | AA Mods
// Flow: Invidious search → Invidious audio → yt-dlp fallback
// ============================================

import axios from 'axios';
import { createWriteStream, readFileSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { pipeline } from 'stream/promises';

const INVIDIOUS = [
  'https://inv.nadeko.net',
  'https://invidious.fdn.fr',
  'https://yewtu.be',
  'https://vid.puffyan.us',
  'https://invidious.privacyredirect.com',
  'https://invidious.nerdvpn.de',
  'https://invidious.io.lol',
  'https://iv.datura.network',
];

function formatDuration(sec) {
  if (!sec) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatViews(n) {
  if (!n) return null;
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function safeUnlink(p) { try { if (p) unlinkSync(p); } catch (_) {} }

// Search Invidious for videoId + metadata
async function searchInvidious(query) {
  for (const inst of INVIDIOUS) {
    try {
      const { data } = await axios.get(
        `${inst}/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
        { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      if (Array.isArray(data) && data[0]?.videoId) {
        const v = data[0];
        return {
          videoId: v.videoId,
          title: v.title || query,
          author: v.author || 'Unknown',
          duration: formatDuration(v.lengthSeconds),
          views: formatViews(v.viewCount),
          thumbUrl: `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`,
          videoUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
        };
      }
    } catch (_) {}
  }
  return null;
}

// Get metadata for a direct YouTube URL via Invidious
async function getVideoMeta(videoId) {
  for (const inst of INVIDIOUS) {
    try {
      const { data } = await axios.get(
        `${inst}/api/v1/videos/${videoId}`,
        { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      if (data && !data.error) {
        return {
          videoId,
          title: data.title || 'YouTube Audio',
          author: data.author || 'Unknown',
          duration: formatDuration(data.lengthSeconds),
          views: formatViews(data.viewCount),
          thumbUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        };
      }
    } catch (_) {}
  }
  return {
    videoId,
    title: 'YouTube Audio',
    author: 'Unknown',
    duration: null,
    views: null,
    thumbUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}

// Download best audio from Invidious adaptiveFormats
async function invidiousAudio(videoId) {
  for (const inst of INVIDIOUS) {
    try {
      const { data } = await axios.get(
        `${inst}/api/v1/videos/${videoId}`,
        { timeout: 12000, headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      if (!data || data.error) continue;

      const formats = data.adaptiveFormats || [];
      const audio =
        formats.filter(f => f.type?.includes('audio/mp4') && f.url)
               .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0] ||
        formats.filter(f => f.type?.includes('audio/') && f.url)
               .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

      if (!audio?.url) continue;

      const filePath = join(tmpdir(), `aa_audio_${Date.now()}.mp3`);
      const res = await axios({
        method: 'get', url: audio.url, responseType: 'stream',
        timeout: 120000,
        headers: { 'User-Agent': 'Mozilla/5.0', Referer: inst },
      });
      await pipeline(res.data, createWriteStream(filePath));
      const stat = statSync(filePath);
      if (stat.size < 1024) { safeUnlink(filePath); continue; }
      console.log(`[play] Invidious audio via ${inst} ✓`);
      return filePath;
    } catch (_) {}
  }
  return null;
}

// yt-dlp fallback using yt-dlp-wrap
async function ytdlpAudio(videoUrl) {
  const { default: YTDlpWrap } = await import('yt-dlp-wrap');
  const ytDlp = new YTDlpWrap();
  const filePath = join(tmpdir(), `aa_yt_${Date.now()}.mp3`);
  await ytDlp.execPromise([
    videoUrl,
    '-x', '--audio-format', 'mp3',
    '--audio-quality', '0',
    '--no-playlist',
    '--geo-bypass',
    '-o', filePath,
    '--quiet',
  ]);
  const stat = statSync(filePath);
  if (stat.size < 1024) throw new Error('Downloaded file is empty');
  return filePath;
}

function buildCard(meta, source) {
  const badge = source === 'inv' ? '🔴 Invidious' : source === 'yt' ? '🟡 yt-dlp' : '🎵 Audio';
  return (
    `✦✦✦✦✦✦✦✦✦✦\n` +
    `   🎧 *AA MD Bot MUSIC*\n` +
    `✦✦✦✦✦✦✦✦✦✦\n\n` +
    `🎬 *${meta.title}*\n` +
    `👤 ${meta.author}\n` +
    (meta.views    ? `👁️ ${meta.views} views\n` : '') +
    (meta.duration ? `⏱️ ${meta.duration}\n`    : '') +
    `📡 ${badge}\n` +
    `\n━━━━━━━━━━━━━━\n` +
    `⏳ Sending audio...`
  );
}

async function sendCard(sock, jid, meta, source) {
  const card = buildCard(meta, source);
  if (meta.thumbUrl) {
    try {
      const res = await axios.get(meta.thumbUrl, { responseType: 'arraybuffer', timeout: 8000 });
      await sock.sendMessage(jid, { image: Buffer.from(res.data), caption: card });
      return;
    } catch (_) {}
  }
  await sock.sendMessage(jid, { text: card });
}

export default {
  command: 'play',
  alias: ['song', 'audio', 'music'],
  description: 'Search and send audio — Invidious → yt-dlp',
  category: 'Media',
  usage: '.play <song name or YouTube URL>',
  cooldown: 15,

  async execute({ sock, jid, args, reply }) {
    if (!args.length) {
      return reply(
        `⚠️ *Usage:* .play <song name>\n\n` +
        `*Examples:*\n` +
        `• .play Tum Hi Ho Arijit Singh\n` +
        `• .play Abbas Jo Zinda Ha Noha\n` +
        `• .play https://youtube.com/watch?v=...`
      );
    }

    const query = args.join(' ');
    const ytUrlMatch = query.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    const isYtUrl = query.startsWith('http') && (query.includes('youtube.com') || query.includes('youtu.be'));

    await sock.sendMessage(jid, { text: `🎵 *Searching:* _${query}_...` });

    let meta = null;
    let tmpFile = null;

    try {
      // Get metadata
      if (isYtUrl && ytUrlMatch) {
        meta = await getVideoMeta(ytUrlMatch[1]);
      } else {
        meta = await searchInvidious(query);
        if (!meta) {
          return reply(`❌ *No results found* for: *${query}*\n\n💡 Try adding the artist name or paste a direct YouTube link.`);
        }
      }

      // Try Invidious audio
      tmpFile = await invidiousAudio(meta.videoId);

      if (tmpFile) {
        await sendCard(sock, jid, meta, 'inv');
        await sock.sendMessage(jid, {
          audio: readFileSync(tmpFile),
          mimetype: 'audio/mpeg',
          ptt: false,
        });
        return;
      }

      // Fallback: yt-dlp
      await sock.sendMessage(jid, { text: `⏳ Invidious servers busy, trying backup...` });
      tmpFile = await ytdlpAudio(meta.videoUrl);
      await sendCard(sock, jid, meta, 'yt');
      await sock.sendMessage(jid, {
        audio: readFileSync(tmpFile),
        mimetype: 'audio/mpeg',
        ptt: false,
      });

    } catch (err) {
      await reply(
        `❌ *Song Not Found*\n\n` +
        `Tried Invidious & yt-dlp — nothing worked for *${query}*.\n\n` +
        `💡 *Tips:*\n` +
        `• Add artist name — *.play Tum Hi Ho Arijit Singh*\n` +
        `• Paste a direct YouTube link\n` +
        `• Try alternate spelling or shorter title`
      );
    } finally {
      safeUnlink(tmpFile);
    }
  },
};
