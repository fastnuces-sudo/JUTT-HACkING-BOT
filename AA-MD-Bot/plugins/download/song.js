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
    try { await execAsync(`${p} --version`); return p; }
    catch {}
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
  command: 'song',
  alias: ['audio', 'music', 'mp3', 'yta'],
  category: 'download',
  description: 'Download YouTube audio/song as MP3',
  usage: '.song Faded Alan Walker',
  ownerOnly: false,
  execute: async ({ reply, react, sock, jid, msg, text }) => {
    if (!text) return reply('🎵 Usage: .song <search query or YouTube URL>\n\nExample: .song Faded Alan Walker');

    const ytdlp = await getYtdlp();
    if (!ytdlp) return reply('❌ yt-dlp not available on this server.');

    await react('⏳');

    const tempDir = path.join(__dirname, '../../temp');
    fs.ensureDirSync(tempDir);
    const uid = generateId();
    const outFile = path.join(tempDir, `${uid}.mp3`);

    try {
      const info = await ytSearch(text.startsWith('http') ? text : text, ytdlp).catch(() => null);
      if (!info) return reply('❌ No results for: ' + text);

      const title = info.title || 'audio';
      const duration = info.duration || 0;
      const uploader = info.uploader || 'Unknown';
      const thumb = info.thumbnail;

      if (duration > 900) {
        return reply(`❌ Audio too long! (${Math.floor(duration / 60)}min)\nMax: 15 minutes`);
      }

      await reply(`🎵 Downloading: *${title}*\n👤 ${uploader}\n⏱️ ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`);

      const url = info.webpage_url || text;

      // Download best audio and convert to mp3
      await execAsync(
        `${ytdlp} "${url}" -f "bestaudio[ext=m4a]/bestaudio/best" -x --audio-format mp3 --audio-quality 128K -o "${path.join(tempDir, uid + '.%(ext)s')}" --no-playlist --quiet --no-warnings`,
        { timeout: 120000 }
      );

      if (!await fs.pathExists(outFile)) {
        // Sometimes saved as .m4a, check
        const m4aFile = outFile.replace('.mp3', '.m4a');
        const webmFile = outFile.replace('.mp3', '.webm');
        const alt = await fs.pathExists(m4aFile) ? m4aFile : await fs.pathExists(webmFile) ? webmFile : null;
        if (!alt) return reply('❌ Download failed. Try another song.');

        await sock.sendMessage(jid, {
          audio: await fs.readFile(alt),
          mimetype: 'audio/mp4',
          fileName: `${title}.m4a`,
        }, { quoted: msg });
        await react('✅');
        fs.remove(alt).catch(() => {});
        return;
      }

      const stat = await fs.stat(outFile);
      const sizeMB = (stat.size / 1024 / 1024).toFixed(1);

      await sock.sendMessage(jid, {
        audio: await fs.readFile(outFile),
        mimetype: 'audio/mpeg',
        fileName: `${title}.mp3`,
      }, { quoted: msg });

      // Also send info card with thumbnail
      if (thumb) {
        await sock.sendMessage(jid, {
          image: { url: thumb },
          caption: `🎵 *${title}*\n👤 ${uploader}\n⏱️ ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}\n📁 ${sizeMB} MB\n🔗 ${url}\n\n_AA MD Bot_`,
        }, { quoted: msg });
      }

      await react('✅');
      fs.remove(outFile).catch(() => {});
    } catch (err) {
      await react('❌');
      reply('❌ Song download failed: ' + (err.message?.slice(0, 100) || 'Unknown error'));
    }
  },
};
