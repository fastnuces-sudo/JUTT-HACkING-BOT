import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { YTDLP, getCookiesFlag } from '../../lib/ytdlp.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  command: 'ringtone',
  alias: ['rtone'],
  description: 'Search and download a ringtone',
  category: 'search',
  async execute({ sock, msg, jid, text, react, reply, prefix }) {
    if (!text) {
      await react('❔');
      return reply(`Please provide a ringtone Search Term !\n\nExample: *${prefix}ringtone iphone*`);
    }
    await react('🎶');
    const query = `${text} ringtone`;
    const outDir = path.join(__dirname, '../../temp');
    await fs.ensureDir(outDir);
    const outFile = path.join(outDir, `ringtone_${Date.now()}.mp3`);
    try {
      const cookiesFlag = getCookiesFlag();
      const cmd = `${YTDLP} ${cookiesFlag} -x --audio-format mp3 --audio-quality 128K --max-filesize 10m --no-playlist -o "${outFile}" "ytsearch1:${query.replace(/"/g, '')}"`;
      await execAsync(cmd, { timeout: 60000 });
      if (!fs.existsSync(outFile)) throw new Error('Audio not downloaded');
      const audio = await fs.readFile(outFile);
      await sock.sendMessage(jid, {
        audio: audio,
        fileName: text + '.mp3',
        mimetype: 'audio/mpeg',
      }, { quoted: msg });
    } catch (err) {
      console.error('Ringtone error:', err.message);
      await react('❌');
      return reply(`❌ Could not find ringtone for: *${text}*`);
    } finally {
      fs.remove(outFile).catch(() => {});
    }
  },
};
