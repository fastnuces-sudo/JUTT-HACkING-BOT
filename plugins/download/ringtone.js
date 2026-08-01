import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateId } from '../../lib/helper.js';
import { YTDLP, YTDLP_FLAGS } from '../../lib/ytdlp.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  command: 'ringtone',
  alias: ['rt', 'tone', 'ring'],
  category: 'download',
  description: 'Download a ringtone by name (max 2 min)',
  usage: '.ringtone iphone | .ringtone nokia ringtone',

  execute: async ({ reply, react, sock, jid, msg, text }) => {
    if (!text) return reply('🎵 Usage: .ringtone <name>\n\nExamples:\n• .ringtone iphone ringtone\n• .ringtone nokia tune\n• .ringtone samsung galaxy');

    await react('⏳');

    const tempDir = path.join(__dirname, '../../temp');
    fs.ensureDirSync(tempDir);
    const uid = generateId();

    try {
      // Search for the ringtone on YouTube (short clips, max 120s)
      const searchQuery = `${text} ringtone`;
      const infoCmd = `${YTDLP} ${YTDLP_FLAGS} "ytsearch3:${searchQuery}" --dump-json --no-playlist --no-download --quiet --match-filter "duration < 200"`;
      let info = null;

      try {
        const { stdout } = await execAsync(infoCmd, { timeout: 25000 });
        const lines = stdout.trim().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const candidate = JSON.parse(line);
            if ((candidate.duration || 999) <= 180) { info = candidate; break; }
          } catch {}
        }
      } catch {}

      // If match-filter failed, try without it
      if (!info) {
        const cmd2 = `${YTDLP} ${YTDLP_FLAGS} "ytsearch5:${searchQuery}" --dump-json --no-playlist --no-download --quiet`;
        const { stdout } = await execAsync(cmd2, { timeout: 25000 });
        const lines = stdout.trim().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const c = JSON.parse(line);
            if ((c.duration || 999) <= 180) { info = c; break; }
          } catch {}
        }
      }

      if (!info) {
        await react('❌');
        return reply(`❌ No ringtone found for: *${text}*\n\nTry: .ringtone iphone, .ringtone nokia, .ringtone samsung`);
      }

      const title    = info.title || text;
      const duration = info.duration || 0;
      const url      = info.webpage_url || info.url;
      const mins     = Math.floor(duration / 60);
      const secs     = String(duration % 60).padStart(2, '0');

      await sock.sendMessage(jid, {
        text: `🎵 *Downloading:* ${title}\n⏱️ ${mins}:${secs}`,
      }, { quoted: msg });

      const outFile = path.join(tempDir, `${uid}.mp3`);
      await execAsync(
        `${YTDLP} ${YTDLP_FLAGS} "${url}" -x --audio-format mp3 --audio-quality 128K -o "${outFile.replace('.mp3', '.%(ext)s')}" --no-playlist --quiet --no-warnings`,
        { timeout: 90000 }
      );

      // Find actual output file
      const files = await fs.readdir(tempDir);
      const base  = uid;
      const dlFile = files.map(f => path.join(tempDir, f)).find(f => path.basename(f).startsWith(base));

      if (!dlFile || !await fs.pathExists(dlFile)) {
        await react('❌');
        return reply('❌ Download failed. Try another ringtone name.');
      }

      await sock.sendMessage(jid, {
        audio: await fs.readFile(dlFile),
        mimetype: 'audio/mpeg',
        fileName: `${title}.mp3`,
      }, { quoted: msg });

      await react('✅');
      fs.remove(dlFile).catch(() => {});

    } catch (err) {
      await react('❌');
      reply('❌ Ringtone download failed. Try a different name.\n_' + (err.message?.slice(0, 80) || '') + '_');
    }
  },
};
