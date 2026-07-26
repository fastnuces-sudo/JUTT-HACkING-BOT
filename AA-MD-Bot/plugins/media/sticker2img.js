import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP = path.join(__dirname, '../../temp');

export default {
  command: 'sticker2img',
  alias: ['s2img', 'toimage', 'stickertoimage'],
  description: 'Convert WhatsApp sticker to image',
  category: 'media',

  async execute({ reply, sock, jid, msg }) {
    const quoted     = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const stickerMsg = quoted?.stickerMessage || msg.message?.stickerMessage;

    if (!stickerMsg) return reply('❌ Reply to a *sticker* with .sticker2img');

    try {
      // Build a proper WAMessage object for downloadMediaMessage
      const waMsg = {
        message: quoted ? { stickerMessage: stickerMsg } : msg.message,
        key: msg.key,
      };

      const buffer = await downloadMediaMessage(
        waMsg, 'buffer', {},
        { reuploadRequest: sock.updateMediaMessage }
      );

      if (!buffer?.length) throw new Error('Empty buffer from download');

      // ── Convert WebP sticker → JPEG via ffmpeg ─────────────────────────────
      // WhatsApp stickers are WebP (static or animated). Sending a WebP buffer
      // with mimetype image/webp often renders as a document, not a photo.
      // ffmpeg -vframes 1 extracts the first frame (handles animated stickers too).
      await fs.ensureDir(TEMP);
      const id  = Date.now();
      const inp = path.join(TEMP, `s2i_${id}_in.webp`);
      const out = path.join(TEMP, `s2i_${id}_out.jpg`);

      let outBuf = null;
      try {
        await fs.writeFile(inp, buffer);
        await execAsync(
          `ffmpeg -i "${inp}" -vframes 1 -q:v 2 -y "${out}" -loglevel error`,
          { timeout: 30000 }
        );
        if (await fs.pathExists(out)) {
          const tmp = await fs.readFile(out);
          if (tmp.length > 0) outBuf = tmp;
        }
      } catch (_) {
        // ffmpeg failed — fall through to webp fallback
      } finally {
        await fs.remove(inp).catch(() => {});
        await fs.remove(out).catch(() => {});
      }

      if (outBuf?.length) {
        // Send as proper JPEG image
        await sock.sendMessage(jid, {
          image: outBuf,
          caption: '✅ Sticker converted to image!',
          mimetype: 'image/jpeg',
        }, { quoted: msg });
      } else {
        // Fallback: send raw webp — at least the user gets the file
        await sock.sendMessage(jid, {
          image: buffer,
          caption: '✅ Sticker converted to image!',
          mimetype: 'image/webp',
        }, { quoted: msg });
      }

    } catch (err) {
      reply('❌ Conversion failed. Please try again in a few seconds.');
    }
  },
};
