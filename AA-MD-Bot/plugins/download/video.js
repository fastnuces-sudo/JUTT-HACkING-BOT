import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
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

// ── Metadata: yt-dlp dump-json (more reliable than play-dl for URLs) ─────────
async function ytMeta(ytdlp, query) {
  const ckf = getCookiesFlag();
  const isUrl = /youtu\.?be/.test(query);
  const searchArg = isUrl ? `"${query}"` : `"ytsearch1:${query}"`;

  // tv_embedded — confirmed working June 2026, no bot detection
  const cmds = [
    `"${ytdlp}" ${searchArg} --extractor-args "youtube:player_client=tv_embedded" --dump-json --no-playlist --no-download --quiet --no-warnings --no-check-certificate`,
    `"${ytdlp}" ${searchArg} ${ckf} --extractor-args "youtube:player_client=android" --dump-json --no-playlist --no-download --quiet --no-warnings --no-check-certificate`,
    `"${ytdlp}" ${searchArg} --dump-json --no-playlist --no-download --quiet --no-warnings`,
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
          url     : j.webpage_url || j.original_url || `https://www.youtube.com/watch?v=${j.id}`,
        };
      }
    } catch {}
  }
  return null;
}

// ── Video download — yt-dlp only (Cobalt/Invidious dead June 2026) ────────────
// Strategy order: tv_embedded (no cookies) → tv_embedded+cookies → android → mweb
async function ytdlpVideoDownload(ytdlp, url, outTemplate, tempDir, uid) {
  const ckf = getCookiesFlag();

  const findFile = async () => {
    try {
      const files = await fs.readdir(tempDir);
      return files.find(f => f.startsWith(uid) && /\.(mp4|mkv|webm)$/.test(f)) || null;
    } catch { return null; }
  };

  const strategies = [
    // ① tv_embedded, single-file best (no merge — avoids ffmpeg issues)
    `"${ytdlp}" "${url}" --extractor-args "youtube:player_client=tv_embedded" -f "best[height<=480][ext=mp4]/best[height<=480]" -o "${outTemplate}" --no-playlist --quiet --no-warnings --no-check-certificate`,

    // ② tv_embedded + cookies, merged mp4
    `"${ytdlp}" "${url}" ${ckf} --extractor-args "youtube:player_client=tv_embedded" -f "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]" --merge-output-format mp4 --postprocessor-args "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart -preset fast -crf 28" -o "${outTemplate}" --no-playlist --quiet --no-warnings --no-check-certificate`,

    // ③ android client + cookies
    `"${ytdlp}" "${url}" ${ckf} --extractor-args "youtube:player_client=android" -f "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480]" --merge-output-format mp4 --postprocessor-args "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart -preset fast -crf 28" -o "${outTemplate}" --no-playlist --quiet --no-warnings --no-check-certificate`,

    // ④ mweb — lightweight fallback
    `"${ytdlp}" "${url}" ${ckf} --extractor-args "youtube:player_client=mweb" -f "best[height<=360][ext=mp4]/best[height<=360]" -o "${outTemplate}" --no-playlist --quiet --no-warnings`,

    // ⑤ last resort — any format
    `"${ytdlp}" "${url}" ${ckf} -f "best[height<=480]/best" -o "${outTemplate}" --no-playlist --quiet --no-warnings`,
  ];

  for (const cmd of strategies) {
    try {
      await execAsync(cmd, { timeout: 300000 });
      const found = await findFile();
      if (found) return found;
    } catch {}
  }
  return null;
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
      '• `.yt https://youtu.be/xxxxx`\n' +
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
    const uid         = generateId();
    const outTemplate = path.join(tempDir, `${uid}.%(ext)s`);

    try {
      // ── Step 1: Get metadata ────────────────────────────────────────────────
      const meta = await ytMeta(YTDLP, text);

      if (!meta || !meta.id) {
        await react('❌');
        return reply(`❌ Video not found: *${text}*\n\nTry a YouTube URL directly:\n_.yt https://youtu.be/xxxxx_`);
      }

      // Duration guard (10 min max for video)
      if (meta.duration > 600) {
        await react('❌');
        return reply(
          `❌ Too long (${fmtDuration(meta.duration)}). Max 10 min for video.\n` +
          `✅ Audio only: *.song ${meta.title}*`
        );
      }

      // Thumbnail
      let thumbBuf = null;
      if (meta.thumbUrl) {
        try { thumbBuf = await getBuffer(meta.thumbUrl); } catch {}
      }
      if (!thumbBuf && meta.id) {
        for (const q of ['hqdefault', 'mqdefault', 'sddefault']) {
          try {
            thumbBuf = await getBuffer(`https://i.ytimg.com/vi/${meta.id}/${q}.jpg`);
            if (thumbBuf) break;
          } catch {}
        }
      }

      // Info card
      const infoCaption =
        `✦✦✦✦✦✦✦✦✦✦\n` +
        `🎬 *AA MD Bot* VIDEO\n` +
        `✦✦✦✦✦✦✦✦✦✦\n\n` +
        `🎙 *${meta.title}*\n` +
        `🎤 ${meta.uploader}\n` +
        `⏱ ${fmtDuration(meta.duration)}  •  👁 ${meta.views} views\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `⏳ _Downloading... please wait_` +
        BRAND;

      if (thumbBuf) {
        await sock.sendMessage(jid, { image: thumbBuf, caption: infoCaption }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: infoCaption }, { quoted: msg });
      }

      // ── Step 2: Download video ─────────────────────────────────────────────
      const fullUrl  = `https://www.youtube.com/watch?v=${meta.id}`;
      const fileName = await ytdlpVideoDownload(YTDLP, fullUrl, outTemplate, tempDir, uid);

      if (!fileName) {
        await react('❌');
        return reply(
          `❌ *Video download failed.*\n\n` +
          `YouTube is blocking direct downloads from this server.\n\n` +
          `✅ Try audio instead: *.song ${meta.title}*`
        );
      }

      const dlFile = path.join(tempDir, fileName);
      const stat   = await fs.stat(dlFile);
      const sizeMB = (stat.size / 1024 / 1024).toFixed(1);

      if (stat.size > 64 * 1024 * 1024) {
        await fs.remove(dlFile);
        await react('❌');
        return reply(`❌ File too large (${sizeMB} MB). Max ~64 MB.\nTry: *.song ${meta.title}*`);
      }

      const videoCaption =
        `✦✦✦✦✦✦✦✦✦✦\n` +
        `🎬 *AA MD Bot* VIDEO\n` +
        `✦✦✦✦✦✦✦✦✦✦\n\n` +
        `🎙 *${meta.title}*\n` +
        `🎤 ${meta.uploader}\n` +
        `⏱ ${fmtDuration(meta.duration)}  •  📁 ${sizeMB} MB  •  👁 ${meta.views}` +
        BRAND;

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
    }
  },
};
