import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { generateId, getBuffer } from '../../lib/helper.js';
import { YTDLP, getCookiesFlag } from '../../lib/ytdlp.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BRAND =
  `\n> 🌐 https://aa-mods.vercel.app/\n` +
  `> 🤖 *Powered by AA MD Bot*\n` +
  `> 👨‍💻 *Developed by Ahsan Ali Wadani*`;

function fmtViews(v) {
  if (!v) return '—';
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return String(v);
}

function fmtDuration(sec) {
  const s = Math.floor(sec || 0);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// ── Metadata via yt-dlp dump-json ─────────────────────────────────────────────
async function ytMeta(ytdlp, query) {
  const ckf = getCookiesFlag();
  const isUrl = /youtu\.?be/.test(query);
  const arg = isUrl ? `"${query}"` : `"ytsearch1:${query}"`;
  const BASE = `--no-playlist --no-download --quiet --no-warnings --no-check-certificate`;
  const cmds = [
    `"${ytdlp}" ${arg} --extractor-args "youtube:player_client=tv_embedded" --dump-json ${BASE}`,
    `"${ytdlp}" ${arg} ${ckf} --extractor-args "youtube:player_client=android" --dump-json ${BASE}`,
    `"${ytdlp}" ${arg} --dump-json ${BASE}`,
  ];
  for (const cmd of cmds) {
    try {
      const { stdout } = await execAsync(cmd, { timeout: 25000 });
      const lines = stdout.trim().split('\n').filter(l => l.startsWith('{'));
      if (lines.length) {
        const j = JSON.parse(lines[0]);
        return {
          id      : j.id || '',
          title   : j.title || query,
          uploader: j.uploader || j.channel || 'Unknown',
          duration: Math.floor(j.duration || 0),
          views   : fmtViews(j.view_count),
          thumbUrl: j.thumbnail || '',
          url     : j.webpage_url || `https://www.youtube.com/watch?v=${j.id}`,
        };
      }
    } catch {}
  }
  return null;
}

// ── Strategy 1: --get-url → direct CDN URL → axios stream (CONFIRMED WORKING) ─
// yt-dlp returns the direct Google Video CDN link; we download it with axios.
// This bypasses yt-dlp's own downloader which may be throttled on cloud IPs.
async function getUrlAndStream(ytdlp, url, outFile) {
  const ckf = getCookiesFlag();
  const clients = ['tv_embedded', 'android', 'ios'];
  const formats = [
    'best[height<=480][ext=mp4]',
    'best[height<=480][ext=webm]',
    'best[height<=480]',
    'best[height<=360][ext=mp4]',
    'best[height<=360]',
  ];

  for (const client of clients) {
    for (const fmt of formats) {
      try {
        const { stdout } = await execAsync(
          `"${ytdlp}" "${url}" --extractor-args "youtube:player_client=${client}" -f "${fmt}" --get-url --no-playlist --quiet --no-warnings --no-check-certificate`,
          { timeout: 30000 }
        );
        const directUrl = stdout.trim().split('\n').find(l => l.startsWith('http'));
        if (!directUrl) continue;

        const resp = await axios({
          url: directUrl,
          method: 'GET',
          responseType: 'stream',
          timeout: 300000,
          headers: {
            'User-Agent'     : 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/112 Mobile Safari/537.36',
            'Accept'         : '*/*',
            'Accept-Encoding': 'gzip, deflate',
            'Range'          : 'bytes=0-',
          },
          maxRedirects: 10,
        });

        const writer = fs.createWriteStream(outFile);
        resp.data.pipe(writer);
        await new Promise((res, rej) => {
          writer.on('finish', res);
          writer.on('error', rej);
          resp.data.on('error', rej);
        });

        const stat = await fs.stat(outFile).catch(() => null);
        if (stat?.size > 100000) return true;
        await fs.remove(outFile).catch(() => {});
      } catch {}
    }
  }
  return false;
}

// ── Strategy 2: yt-dlp direct download (multiple clients) ────────────────────
async function ytdlpDirect(ytdlp, url, outTemplate, tempDir, uid) {
  const ckf = getCookiesFlag();
  const FMT_SINGLE = `best[height<=480][ext=mp4]/best[height<=480][ext=webm]/best[height<=480]`;
  const FMT_MERGED = `bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]`;
  const FMT_LOW    = `best[height<=360][ext=mp4]/best[height<=360]/worst[ext=mp4]/worst`;
  const MERGE      = `--merge-output-format mp4 --postprocessor-args "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart -preset fast -crf 28"`;
  const BASE       = `--no-playlist --quiet --no-warnings --no-check-certificate`;

  const findFile = async () => {
    try {
      const files = await fs.readdir(tempDir);
      return files.find(f => f.startsWith(uid) && /\.(mp4|mkv|webm|m4v)$/.test(f)) || null;
    } catch { return null; }
  };

  const strategies = [
    `"${ytdlp}" "${url}" --extractor-args "youtube:player_client=tv_embedded" -f "${FMT_SINGLE}" -o "${outTemplate}" ${BASE}`,
    `"${ytdlp}" "${url}" ${ckf} --extractor-args "youtube:player_client=tv_embedded" -f "${FMT_MERGED}" ${MERGE} -o "${outTemplate}" ${BASE}`,
    `"${ytdlp}" "${url}" ${ckf} --extractor-args "youtube:player_client=tv_embedded,web" -f "${FMT_SINGLE}" -o "${outTemplate}" ${BASE}`,
    `"${ytdlp}" "${url}" ${ckf} --extractor-args "youtube:player_client=android" -f "${FMT_MERGED}" ${MERGE} -o "${outTemplate}" ${BASE}`,
    `"${ytdlp}" "${url}" ${ckf} --extractor-args "youtube:player_client=ios" -f "${FMT_MERGED}" ${MERGE} -o "${outTemplate}" ${BASE}`,
    `"${ytdlp}" "${url}" ${ckf} --extractor-args "youtube:player_client=mweb" -f "${FMT_LOW}" -o "${outTemplate}" --no-playlist --quiet --no-warnings`,
    `"${ytdlp}" "${url}" ${ckf} -f "best[height<=480]/best" -o "${outTemplate}" --no-playlist --quiet --no-warnings`,
  ];

  for (const cmd of strategies) {
    try {
      await execAsync(cmd, { timeout: 300000 });
      const found = await findFile();
      if (found) return path.join(tempDir, found);
    } catch {}
  }
  return null;
}

export default {
  command : 'video',
  alias   : ['yt', 'ytvideo', 'ytv', 'ytmp4'],
  category: 'download',
  description: 'Download YouTube video (up to 10 min)',
  usage   : '.video <name or YouTube URL>',

  execute: async ({ reply, react, sock, jid, msg, text, sendMedia }) => {
    if (!text) return reply(
      '🎬 *AA MD Bot — Video Downloader*\n\n' +
      'Usage: `.video <name or URL>`\n\nExamples:\n' +
      '• `.video Faded Alan Walker`\n' +
      '• `.yt https://youtu.be/xxxxx`\n' +
      '• `.ytv Naat Sharif 2024`'
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
    const uid         = generateId();
    const outFile     = path.join(tempDir, `${uid}.mp4`);
    const outTemplate = path.join(tempDir, `${uid}.%(ext)s`);

    try {
      // ── Step 1: Metadata ────────────────────────────────────────────────────
      const meta = await ytMeta(YTDLP, text);

      if (!meta?.id) {
        await react('❌');
        return reply(`❌ Video not found: *${text}*\n\nTry a YouTube URL:\n_.yt https://youtu.be/xxxxx_`);
      }

      if (meta.duration > 600) {
        await react('❌');
        return reply(
          `❌ Too long (${fmtDuration(meta.duration)}). Max 10 min.\n` +
          `✅ Audio only: *.song ${meta.title}*`
        );
      }

      // Thumbnail
      let thumbBuf = null;
      if (meta.thumbUrl) { try { thumbBuf = await getBuffer(meta.thumbUrl); } catch {} }
      if (!thumbBuf && meta.id) {
        for (const q of ['hqdefault', 'mqdefault', 'sddefault']) {
          try { thumbBuf = await getBuffer(`https://i.ytimg.com/vi/${meta.id}/${q}.jpg`); if (thumbBuf) break; } catch {}
        }
      }

      const infoCaption =
        `✦✦✦✦✦✦✦✦✦✦\n🎬 *AA MD Bot* VIDEO\n✦✦✦✦✦✦✦✦✦✦\n\n` +
        `🎙 *${meta.title}*\n🎤 ${meta.uploader}\n` +
        `⏱ ${fmtDuration(meta.duration)}  •  👁 ${meta.views} views\n\n` +
        `━━━━━━━━━━━━━━━━\n⏳ _Downloading... please wait_` + BRAND;

      if (thumbBuf) {
        await sock.sendMessage(jid, { image: thumbBuf, caption: infoCaption }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: infoCaption }, { quoted: msg });
      }

      // ── Step 2: Download (get-url+stream first, then direct yt-dlp) ─────────
      const fullUrl = `https://www.youtube.com/watch?v=${meta.id}`;
      let dlFile = null;

      // Primary: --get-url + axios (confirmed working on Replit Jun 2026)
      const ok = await getUrlAndStream(YTDLP, fullUrl, outFile);
      if (ok) dlFile = outFile;

      // Fallback: yt-dlp direct download
      if (!dlFile) {
        dlFile = await ytdlpDirect(YTDLP, fullUrl, outTemplate, tempDir, uid);
      }

      if (!dlFile || !await fs.pathExists(dlFile)) {
        await react('❌');
        return reply(
          `❌ *Video download failed.*\n\n` +
          `✅ Audio works! Try: *.song ${meta.title}*`
        );
      }

      const stat   = await fs.stat(dlFile);
      const sizeMB = (stat.size / 1024 / 1024).toFixed(1);

      if (stat.size > 64 * 1024 * 1024) {
        await fs.remove(dlFile);
        await react('❌');
        return reply(`❌ File too large (${sizeMB} MB). Max ~64 MB.\nTry: *.song ${meta.title}*`);
      }

      const videoCaption =
        `✦✦✦✦✦✦✦✦✦✦\n🎬 *AA MD Bot* VIDEO\n✦✦✦✦✦✦✦✦✦✦\n\n` +
        `🎙 *${meta.title}*\n🎤 ${meta.uploader}\n` +
        `⏱ ${fmtDuration(meta.duration)}  •  📁 ${sizeMB} MB  •  👁 ${meta.views}` + BRAND;

      await sendMedia({
        video   : await fs.readFile(dlFile),
        mimetype: 'video/mp4',
        fileName: `${meta.title}.mp4`,
        caption : videoCaption,
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
