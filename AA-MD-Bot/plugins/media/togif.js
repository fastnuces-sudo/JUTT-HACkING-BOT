// ============================================
// Jutts Bot - Convert Sticker/Video to GIF
// Developer: Sajid Jutt | Jutts Mods
// ============================================

import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP = path.join(__dirname, '../../temp');
fs.ensureDirSync(TEMP);

async function downloadBuffer(mediaMsg, type) {
  const stream = await downloadContentFromMessage(mediaMsg, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default {
  command: 'togif',
  alias: ['gif', 'mp4togif', 'stickertogif', 'converttogif'],
  description: 'Convert a video or animated sticker to GIF. Reply to a video/sticker.',
  category: 'media',

  async execute({ sock, msg, jid, reply, react }) {
    await react('🎞️');

    const msgContent = msg.message || {};
    const videoMsg   = msgContent.videoMessage
      || msgContent.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;
    const stickerMsg = msgContent.stickerMessage
      || msgContent.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;

    const mediaMsg = videoMsg || stickerMsg;
    const type     = videoMsg ? 'video' : stickerMsg ? 'sticker' : null;

    if (!mediaMsg || !type) {
      return reply(
        `⚠️ *Reply to a video or animated sticker.*\n\n` +
        `📋 *Usage:* Reply to a video/sticker and send *.togif*\n\n` +
        `> 🤖 *Jutts Bot*`
      );
    }

    try {
      const buf  = await downloadBuffer(mediaMsg, type);
      const ts   = Date.now();
      const inFile  = path.join(TEMP, `togif_in_${ts}.${type === 'sticker' ? 'webp' : 'mp4'}`);
      const outFile = path.join(TEMP, `togif_out_${ts}.gif`);

      await fs.writeFile(inFile, buf);
      await execAsync(`ffmpeg -y -i "${inFile}" -vf "fps=10,scale=320:-1:flags=lanczos" -loop 0 "${outFile}" 2>&1`);

      const gifBuf = await fs.readFile(outFile);
      await sock.sendMessage(jid, {
        video: gifBuf, gifPlayback: true, mimetype: 'video/mp4',
        caption: `🎞️ *GIF Converted!*\n\n> 🤖 *Jutts Bot*`,
      }, { quoted: msg });
      await react('✅');

      // Cleanup
      fs.remove(inFile).catch(() => {});
      fs.remove(outFile).catch(() => {});
    } catch (e) {
      await react('❌');
      return reply(`❌ *GIF conversion failed.*\n\nMake sure ffmpeg is installed.\n\n> 🤖 *Jutts Bot*`);
    }
  },
};
