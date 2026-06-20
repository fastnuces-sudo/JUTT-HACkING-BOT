import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateId, getBuffer } from '../../lib/helper.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const YTDLP = '/home/runner/.local/bin/yt-dlp';

async function ytSearch(query) {
  const cmd = query.startsWith('http')
    ? `${YTDLP} "${query}" --dump-json --no-playlist --no-download --quiet`
    : `${YTDLP} "ytsearch1:${query}" --dump-json --no-playlist --no-download --quiet`;
  const { stdout } = await execAsync(cmd, { timeout: 30000 });
  return JSON.parse(stdout.trim().split('\n')[0]);
}

export default {
  command: 'video',
  alias: ['yt', 'ytvideo', 'ytv', 'ytmp4'],
  category: 'download',
  description: 'Download YouTube video (up to 10min)',
  usage: '.video Faded Alan Walker | .yt <youtube-url>',

  execute: async ({ reply, react, sock, jid, msg, text }) => {
    if (!text) return reply('🎬 Usage: .video <name or URL>\n\nExample: .video Faded Alan Walker');

    await react('⏳');

    const tempDir = path.join(__dirname, '../../temp');
    fs.ensureDirSync(tempDir);
    const uid = generateId();

    try {
      const info = await ytSearch(text).catch(() => null);
      if (!info) { await react('❌'); return reply('❌ No video found for: ' + text); }

      const title    = info.title    || 'video';
      const duration = info.duration || 0;
      const uploader = info.uploader || 'Unknown';
      const views    = info.view_count ? info.view_count.toLocaleString() : '—';
      const thumb    = info.thumbnail;
      const url      = info.webpage_url || text;
      const mins     = Math.floor(duration / 60);
      const secs     = String(duration % 60).padStart(2, '0');

      if (duration > 600) {
        await react('❌');
        return reply(`❌ Video too long (${mins} min). Max: 10 minutes.`);
      }

      await sock.sendMessage(jid, {
        text: `📥 *Downloading:* ${title}\n👤 ${uploader}\n⏱️ ${mins}:${secs}\n👁️ ${views} views`,
      }, { quoted: msg });

      // Download with yt-dlp — force H.264/AAC for WhatsApp compatibility
      const outTemplate = path.join(tempDir, `${uid}.%(ext)s`);
      await execAsync(
        `${YTDLP} "${url}" ` +
        `-f "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio/best[height<=480]" ` +
        `--merge-output-format mp4 ` +
        `--postprocessor-args "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart -preset fast -crf 28" ` +
        `-o "${outTemplate}" --no-playlist --quiet --no-warnings`,
        { timeout: 180000 }
      );

      // Find downloaded file
      const files  = await fs.readdir(tempDir);
      const dlFile = files
        .map(f => path.join(tempDir, f))
        .find(f => path.basename(f).startsWith(uid));

      if (!dlFile || !await fs.pathExists(dlFile)) {
        await react('❌');
        return reply('❌ Download failed. Try a shorter or more popular video.');
      }

      const stat   = await fs.stat(dlFile);
      const sizeMB = (stat.size / 1024 / 1024).toFixed(1);

      if (stat.size > 64 * 1024 * 1024) {
        await fs.remove(dlFile);
        await react('❌');
        return reply(`❌ File too large (${sizeMB} MB). Try a shorter video (max ~64MB).`);
      }

      let thumbBuf = null;
      try { if (thumb) thumbBuf = await getBuffer(thumb); } catch {}

      const caption =
        `🎬 *${title}*\n` +
        `👤 ${uploader}\n` +
        `⏱️ ${mins}:${secs}  📁 ${sizeMB} MB\n` +
        `👁️ ${views} views\n` +
        `🔗 ${url}`;

      await sock.sendMessage(jid, {
        video: await fs.readFile(dlFile),
        mimetype: 'video/mp4',
        fileName: `${title}.mp4`,
        caption,
        ...(thumbBuf ? { jpegThumbnail: thumbBuf } : {}),
      }, { quoted: msg });

      await react('✅');
      fs.remove(dlFile).catch(() => {});

    } catch (err) {
      await react('❌');
      reply('❌ Video download failed: ' + (err.message?.slice(0, 100) || 'Unknown error'));
    }
  },
};
