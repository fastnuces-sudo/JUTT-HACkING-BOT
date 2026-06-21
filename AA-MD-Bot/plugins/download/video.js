import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { generateId, getBuffer } from '../../lib/helper.js';
import { YTDLP, getCookiesFlag } from '../../lib/ytdlp.js';

const execAsync  = promisify(exec);
const __dirname  = path.dirname(fileURLToPath(import.meta.url));

const BRAND =
  `\n> 🌐 https://aa-mods.vercel.app/\n` +
  `> 🤖 *Powered by AA MD Bot*\n` +
  `> 👨‍💻 *Developed by Ahsan Ali Wadani*`;

// Invidious public instances for YouTube proxy downloads
const INV = [
  'https://inv.tux.pizza',
  'https://invidious.privacydev.net',
  'https://yt.cdaut.de',
  'https://iv.melmac.space',
  'https://yewtu.be',
  'https://invidious.fdn.fr',
  'https://invidious.nerdvpn.de',
];

function fmtViews(v) {
  if (!v) return '—';
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return String(v);
}

async function ytSearch(query) {
  try {
    const playdl  = (await import('play-dl')).default;
    const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 });
    if (results.length) return results[0];
  } catch {}
  return null;
}

async function invidiousVideoInfo(videoId) {
  for (const base of INV) {
    try {
      const res = await axios.get(`${base}/api/v1/videos/${videoId}`, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AA-MD-Bot/3.0)' },
      });
      if (res.data?.videoId) return { ...res.data, _base: base };
    } catch {}
  }
  return null;
}

async function downloadVideoFromInvidious(info, outFile) {
  // formatStreams = muxed mp4 (audio+video) — no ffmpeg merge needed
  const streams = (info.formatStreams || [])
    .filter(f => f.container === 'mp4' || f.type?.includes('video/mp4'))
    .filter(f => {
      const h = parseInt((f.resolution || '0').replace('p', ''));
      return h <= 480;
    })
    .sort((a, b) => {
      const ha = parseInt((a.resolution || '0').replace('p', ''));
      const hb = parseInt((b.resolution || '0').replace('p', ''));
      return hb - ha;
    });

  if (!streams.length) return false;

  for (const s of streams) {
    let url = s.url;
    if (!url) continue;
    if (!url.startsWith('http')) url = `${info._base}${url}`;
    try {
      const res = await axios({ url, method: 'GET', responseType: 'stream', timeout: 180000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AA-MD-Bot/3.0)' }
      });
      const writer = fs.createWriteStream(outFile);
      res.data.pipe(writer);
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
        res.data.on('error', reject);
      });
      const stat = await fs.stat(outFile).catch(() => null);
      if (stat?.size > 50000) return true;
    } catch {}
  }
  return false;
}

async function ytdlpDownload(ytdlp, url, outTemplate) {
  const dir = path.dirname(outTemplate);
  const uid = path.basename(outTemplate).split('.')[0];
  const check = async () => {
    try {
      const files = await fs.readdir(dir);
      return files.find(f => f.startsWith(uid) && f.endsWith('.mp4')) || null;
    } catch { return null; }
  };

  const ckf = getCookiesFlag();
  const strategies = [
    // cookies + tv_embedded — most reliable on VPS/Railway
    `"${ytdlp}" "${url}" ${ckf} -f "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]" --merge-output-format mp4 --extractor-args "youtube:player_client=tv_embedded" --postprocessor-args "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart -preset fast -crf 28" -o "${outTemplate}" --no-playlist --quiet --no-warnings --no-check-certificate`,
    // android client with proper mobile UA
    `"${ytdlp}" "${url}" ${ckf} -f "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]" --merge-output-format mp4 --extractor-args "youtube:player_client=android" --add-header "User-Agent:com.google.android.youtube/17.36.4 (Linux; U; Android 12; GB)" --postprocessor-args "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart -preset fast -crf 28" -o "${outTemplate}" --no-playlist --quiet --no-warnings --no-check-certificate`,
    // ios client
    `"${ytdlp}" "${url}" ${ckf} -f "bestvideo[height<=480]+bestaudio/best[height<=480]" --merge-output-format mp4 --extractor-args "youtube:player_client=ios" --postprocessor-args "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart -preset fast -crf 28" -o "${outTemplate}" --no-playlist --quiet --no-warnings --no-check-certificate`,
    // web fallback
    `"${ytdlp}" "${url}" ${ckf} -f "best[height<=480]" --merge-output-format mp4 --extractor-args "youtube:player_client=web" --postprocessor-args "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart -preset fast" -o "${outTemplate}" --no-playlist --quiet --no-warnings`,
  ];

  for (const cmd of strategies) {
    try {
      await execAsync(cmd, { timeout: 240000 });
      if (await check()) return true;
    } catch {}
  }
  return false;
}

export default {
  command : 'video',
  alias   : ['yt', 'ytvideo', 'ytv', 'ytmp4'],
  category: 'download',
  description: 'Download YouTube video (up to 10 min / 480p)',
  usage   : '.video <name or YouTube URL>',

  execute: async ({ reply, react, sock, jid, msg, text, sendMedia }) => {
    if (!text) return reply(
      '🎬 *AA MD Bot — Video Downloader*\n\n' +
      'Usage: `.video <name or URL>`\n\nExamples:\n' +
      '• `.video Faded Alan Walker`\n' +
      '• `.yt https://youtube.com/watch?v=...`\n' +
      '• `.ytv Abbas Jo Zinda Hai Nadeem Sarwar`'
    );

    await react('⏳');

    const shortQ = text.length > 35 ? text.slice(0, 35) + '...' : text;
    await sock.sendMessage(jid, {
      text:
        `🔎 *Searching:* ${shortQ}\n` +
        `> 🤖 *Powered by AA MD Bot*\n` +
        `> 👨‍💻 *Developed by Ahsan Ali Wadani*`
    }, { quoted: msg });

    const tempDir = path.join(__dirname, '../../temp');
    await fs.ensureDir(tempDir);
    const uid     = generateId();
    const outFile = path.join(tempDir, `${uid}.mp4`);

    try {
      const ytdlp = YTDLP;

      // ── Step 1: Metadata (play-dl for YouTube info) ────────────────────────
      let title    = text;
      let duration = 0;
      let uploader = 'Unknown';
      let views    = '—';
      let thumbUrl = '';
      let videoId  = null;
      let ytUrl    = text;

      const urlMatch = text.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
      if (urlMatch) videoId = urlMatch[1];

      const ytInfo = await ytSearch(videoId ? `https://www.youtube.com/watch?v=${videoId}` : text);
      if (ytInfo) {
        videoId  = ytInfo.id || videoId;
        title    = ytInfo.title    || text;
        duration = ytInfo.durationInSec || 0;
        uploader = ytInfo.channel?.name || 'Unknown';
        views    = fmtViews(ytInfo.views);
        thumbUrl = ytInfo.thumbnails?.[ytInfo.thumbnails.length - 1]?.url || '';
        ytUrl    = ytInfo.url || ytUrl;
      }

      if (!videoId) { await react('❌'); return reply(`❌ Video not found: *${text}*`); }

      // Duration guard
      if (duration > 600) {
        await react('❌');
        const m = Math.floor(duration / 60), s = String(duration % 60).padStart(2, '0');
        return reply(`❌ Too long (${m}:${s}). Max 10 min.\nFor audio only: .song ${title}`);
      }

      const mins = Math.floor(duration / 60);
      const secs = String(duration % 60).padStart(2, '0');

      let thumbBuf = null;
      if (thumbUrl) { try { thumbBuf = await getBuffer(thumbUrl); } catch {} }
      if (!thumbBuf) {
        for (const q of ['hqdefault', 'mqdefault', 'sddefault']) {
          try { thumbBuf = await getBuffer(`https://i.ytimg.com/vi/${videoId}/${q}.jpg`); if (thumbBuf) break; } catch {}
        }
      }

      const infoCaption =
        `✦✦✦✦✦✦✦✦✦✦\n` +
        `🎬 *AA MD Bot* VIDEO\n` +
        `✦✦✦✦✦✦✦✦✦✦\n\n` +
        `🎙 *${title}*\n` +
        `🎤 ${uploader}\n` +
        `⏱ ${mins}:${secs} | 👁 ${views} views\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `⏳ _Please wait, fetching your video..._` +
        BRAND;

      if (thumbBuf) {
        await sock.sendMessage(jid, { image: thumbBuf, caption: infoCaption }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: infoCaption }, { quoted: msg });
      }

      // ── Step 2: Download — Invidious → yt-dlp ─────────────────────────────
      let downloaded = false;

      // Try Invidious proxy first
      try {
        const invInfo = await invidiousVideoInfo(videoId);
        if (invInfo) {
          downloaded = await downloadVideoFromInvidious(invInfo, outFile);
        }
      } catch {}

      // Try yt-dlp as fallback
      if (!downloaded && ytdlp) {
        const outTemplate = path.join(tempDir, `${uid}.%(ext)s`);
        downloaded = await ytdlpDownload(ytdlp, `https://www.youtube.com/watch?v=${videoId}`, outTemplate);
      }

      // Find output file
      let dlFile = outFile;
      if (!downloaded || !await fs.pathExists(outFile)) {
        const files = await fs.readdir(tempDir);
        const found = files.find(f => f.startsWith(uid));
        if (found) { dlFile = path.join(tempDir, found); downloaded = true; }
      }

      if (!downloaded || !await fs.pathExists(dlFile)) {
        await react('❌');
        return reply(
          `❌ Video download failed. YouTube servers are blocking bots.\n\n` +
          `✅ Try audio instead: *.song ${title}*`
        );
      }

      const stat   = await fs.stat(dlFile);
      const sizeMB = (stat.size / 1024 / 1024).toFixed(1);

      if (stat.size > 64 * 1024 * 1024) {
        await fs.remove(dlFile); await react('❌');
        return reply(`❌ File too large (${sizeMB}MB). Max ~64MB.\nTry: .song ${title}`);
      }

      const videoCaption =
        `✦✦✦✦✦✦✦✦✦✦\n` +
        `🎬 *AA MD Bot* VIDEO\n` +
        `✦✦✦✦✦✦✦✦✦✦\n\n` +
        `🎙 *${title}*\n` +
        `🎤 ${uploader}\n` +
        `⏱ ${mins}:${secs} | 📁 ${sizeMB}MB | 👁 ${views} views` +
        BRAND;

      await sendMedia({
        video    : await fs.readFile(dlFile),
        mimetype : 'video/mp4',
        fileName : `${title}.mp4`,
        caption  : videoCaption,
        ...(thumbBuf ? { jpegThumbnail: thumbBuf } : {}),
      });

      await react('✅');
      fs.remove(dlFile).catch(() => {});

    } catch (err) {
      await react('❌');
      reply(`❌ Error: ${err.message?.slice(0, 120) || 'Unknown error'}`);
      fs.remove(outFile).catch(() => {});
    }
  },
};
