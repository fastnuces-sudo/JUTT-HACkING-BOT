import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateId } from '../../lib/helper.js';

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
    try {
      await execAsync(`${p} --version`);
      return p;
    } catch {}
  }
  return null;
}

async function ytSearch(query, ytdlp) {
  const { stdout } = await execAsync(
    `${ytdlp} "ytsearch1:${query}" --dump-json --no-playlist --no-download --quiet`,
    { timeout: 30000 }
  );
  return JSON.parse(stdout.trim().split('\n')[0]);
}

export default {
  command: 'video',
  alias: ['yt', 'ytvideo', 'ytv'],
  category: 'download',
  description: 'Download YouTube video',
  usage: '.video Faded Alan Walker',
  ownerOnly: false,
  execute: async ({ reply, react, sock, jid, msg, text }) => {
    if (!text) return reply('🎬 Usage: .video <search query or YouTube URL>\n\nExample: .video Faded Alan Walker');

    const ytdlp = await getYtdlp();
    if (!ytdlp) return reply('❌ yt-dlp not available on this server.');

    await react('⏳');

    const tempDir = path.join(__dirname, '../../temp');
    fs.ensureDirSync(tempDir);
    const outTemplate = path.join(tempDir, `${generateId()}.%(ext)s`);

    try {
      // Get video info first
      await reply('🔍 Searching...');
      const info = await ytSearch(text.startsWith('http') ? text : text, ytdlp).catch(() => null);

      if (!info) return reply('❌ No video found for: ' + text);

      const title = info.title || 'video';
      const duration = info.duration || 0;
      const uploader = info.uploader || 'Unknown';

      if (duration > 600) {
        return reply(`❌ Video too long! (${Math.floor(duration / 60)}min)\nMax: 10 minutes`);
      }

      await reply(`📥 Downloading: *${title}*\n👤 ${uploader}\n⏱️ ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`);

      // Download video (max 480p to keep file size small)
      const url = info.webpage_url || text;
      await execAsync(
        `${ytdlp} "${url}" -f "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]" -o "${outTemplate}" --merge-output-format mp4 --no-playlist --quiet --no-warnings`,
        { timeout: 120000 }
      );

      // Find downloaded file
      const files = await fs.readdir(tempDir);
      const dlFile = files.map(f => path.join(tempDir, f)).find(f => {
        const base = path.basename(outTemplate).replace('%(ext)s', '');
        return path.basename(f).startsWith(path.basename(base));
      });

      if (!dlFile || !await fs.pathExists(dlFile)) {
        return reply('❌ Download failed. Try a shorter or more popular video.');
      }

      const stat = await fs.stat(dlFile);
      const sizeMB = (stat.size / 1024 / 1024).toFixed(1);

      if (stat.size > 64 * 1024 * 1024) {
        await fs.remove(dlFile);
        return reply(`❌ File too large (${sizeMB} MB). Try a shorter video.`);
      }

      await sock.sendMessage(jid, {
        video: await fs.readFile(dlFile),
        mimetype: 'video/mp4',
        fileName: `${title}.mp4`,
        caption: `🎬 *${title}*\n👤 ${uploader}\n⏱️ ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}\n📁 ${sizeMB} MB\n\n_AA MD Bot_`,
      }, { quoted: msg });

      await react('✅');
      fs.remove(dlFile).catch(() => {});
    } catch (err) {
      await react('❌');
      reply('❌ Video download failed: ' + (err.message?.slice(0, 100) || 'Unknown error'));
    }
  },
};
