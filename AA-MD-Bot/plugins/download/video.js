import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateId, getBuffer } from '../../lib/helper.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const YTDLP_PATHS = [
  '/home/runner/.local/bin/yt-dlp',
  '/usr/local/bin/yt-dlp',
  '/usr/bin/yt-dlp',
  'yt-dlp',
];

async function getYtdlp() {
  for (const p of YTDLP_PATHS) {
    try { await execAsync(`${p} --version`); return p; }
    catch {}
  }
  return null;
}

async function ytSearch(query, ytdlp) {
  const cmd = query.startsWith('http')
    ? `${ytdlp} "${query}" --dump-json --no-playlist --no-download --quiet`
    : `${ytdlp} "ytsearch1:${query}" --dump-json --no-playlist --no-download --quiet`;
  const { stdout } = await execAsync(cmd, { timeout: 30000 });
  return JSON.parse(stdout.trim().split('\n')[0]);
}

export default {
  command: 'video',
  alias: ['yt', 'ytvideo', 'ytv', 'ytmp4'],
  category: 'download',
  description: 'Download YouTube video (up to 10min)',
  usage: '.video Faded Alan Walker',
  ownerOnly: false,

  execute: async ({ reply, react, sock, jid, msg, text }) => {
    if (!text) return reply('🎬 Usage: .video <search query or YouTube URL>\n\nExample: .video Faded Alan Walker');

    const ytdlp = await getYtdlp();
    if (!ytdlp) return reply('❌ yt-dlp not available on this server.');

    await react('⏳');
    await reply('🔍 Searching...');

    const tempDir = path.join(__dirname, '../../temp');
    fs.ensureDirSync(tempDir);
    const uid = generateId();
    const outTemplate = path.join(tempDir, `${uid}.%(ext)s`);

    try {
      const info = await ytSearch(text, ytdlp).catch(() => null);
      if (!info) return reply('❌ No video found for: ' + text);

      const title    = info.title     || 'video';
      const duration = info.duration  || 0;
      const uploader = info.uploader  || 'Unknown';
      const views    = info.view_count ? info.view_count.toLocaleString() : '—';
      const thumb    = info.thumbnail;
      const url      = info.webpage_url || text;
      const mins     = Math.floor(duration / 60);
      const secs     = String(duration % 60).padStart(2, '0');

      if (duration > 600) {
        return reply(`❌ Video too long! (${mins}min)\nMax: 10 minutes`);
      }

      await reply(`📥 Downloading: *${title}*\n👤 ${uploader}\n⏱️ ${mins}:${secs}\n👁️ ${views} views`);

      await execAsync(
        `${ytdlp} "${url}" -f "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]" -o "${outTemplate}" --merge-output-format mp4 --no-playlist --quiet --no-warnings`,
        { timeout: 120000 }
      );

      const files  = await fs.readdir(tempDir);
      const base   = path.basename(outTemplate).replace('%(ext)s', '');
      const dlFile = files
        .map(f => path.join(tempDir, f))
        .find(f => path.basename(f).startsWith(path.basename(base)));

      if (!dlFile || !await fs.pathExists(dlFile)) {
        return reply('❌ Download failed. Try a shorter or more popular video.');
      }

      const stat   = await fs.stat(dlFile);
      const sizeMB = (stat.size / 1024 / 1024).toFixed(1);

      if (stat.size > 64 * 1024 * 1024) {
        await fs.remove(dlFile);
        return reply(`❌ File too large (${sizeMB} MB). Try a shorter video.`);
      }

      let thumbBuf = null;
      try { if (thumb) thumbBuf = await getBuffer(thumb); } catch {}

      const caption =
        `🎬 *${title}*\n` +
        `👤 ${uploader}\n` +
        `⏱️ ${mins}:${secs}  |  📁 ${sizeMB} MB\n` +
        `👁️ ${views} views\n` +
        `🔗 ${url}`;

      await sock.sendMessage(jid, {
        video: await fs.readFile(dlFile),
        mimetype: 'video/mp4',
        fileName: `${title}.mp4`,
        caption,
        contextInfo: {
          externalAdReply: {
            title,
            body: uploader,
            renderLargerThumbnail: true,
            thumbnailUrl: thumb,
            mediaType: 2,
            ...(thumbBuf ? { thumbnail: thumbBuf } : {}),
            sourceUrl: url,
          },
        },
      }, { quoted: msg });

      await react('✅');
      fs.remove(dlFile).catch(() => {});
    } catch (err) {
      await react('❌');
      reply('❌ Video download failed: ' + (err.message?.slice(0, 100) || 'Unknown error'));
    }
  },
};
