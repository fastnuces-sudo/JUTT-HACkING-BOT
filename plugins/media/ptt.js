import { exec } from 'child_process';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateId } from '../../lib/helper.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  command: 'ptt',
  alias: ['voicenote', 'vn', 'pttify'],
  description: 'Convert audio message to a voice note (PTT)',
  category: 'media',
  usage: '.ptt (reply to any audio message)',
  cooldown: 8,

  async execute({ reply, sock, jid, msg }) {
    const quoted  = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const msgContent = quoted || msg.message;
    const hasAudio = msgContent?.audioMessage;

    if (!hasAudio) {
      return reply('🎙️ Reply to an *audio message* with .ptt to convert it to a voice note.');
    }

    const tmpDir = path.join(__dirname, '../../temp');
    await fs.ensureDir(tmpDir);
    const id     = generateId();
    const tmpIn  = path.join(tmpDir, `${id}.mp3`);
    const tmpOut = path.join(tmpDir, `${id}.ogg`);

    try {
      const buffer = await downloadMediaMessage({
        message: quoted ? { audioMessage: hasAudio } : msg.message,
        key: msg.key,
      }, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
      await fs.writeFile(tmpIn, buffer);

      await execAsync(
        `ffmpeg -i "${tmpIn}" -c:a libopus -b:a 64k -ar 48000 -ac 1 "${tmpOut}" -y`,
        { timeout: 30000 }
      );

      const audioBuf = await fs.readFile(tmpOut);
      await sock.sendMessage(jid, {
        audio: audioBuf,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true,
      }, { quoted: msg });

    } catch (err) {
      reply('❌ Conversion failed. Please try again in a few seconds.');
    } finally {
      fs.remove(tmpIn).catch(() => {});
      fs.remove(tmpOut).catch(() => {});
    }
  },
};
