// AA MD Bot — File to URL (uguu.se — 48h links)
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

const __dirname2 = path.dirname(fileURLToPath(import.meta.url));
const TEMP       = path.join(__dirname2, '../../temp');

async function uploadToUguu(filePath) {
  const form = new FormData();
  form.append('files[]', fs.createReadStream(filePath));
  const { data } = await axios.post('https://uguu.se/upload.php', form, {
    headers: { 'User-Agent': 'Mozilla/5.0', ...form.getHeaders() },
    timeout: 60000,
  });
  return data?.files?.[0]?.url || data?.files?.[0];
}

export default {
  command: 'tourl',
  alias: ['upload', 'geturl', 'uguu'],
  description: 'Upload any media/file and get a direct download URL',
  category: 'tools',

  async execute({ sock, msg, react, reply, prefix }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const imgMsg  = quoted?.imageMessage;
    const vidMsg  = quoted?.videoMessage;
    const audMsg  = quoted?.audioMessage;
    const docMsg  = quoted?.documentMessage;
    const stkMsg  = quoted?.stickerMessage;
    const media   = imgMsg || vidMsg || audMsg || docMsg || stkMsg;

    if (!media) {
      return reply(
        `📎 *File → URL Converter*\n\n` +
        `Reply to any *image, video, audio, document, or sticker* with:\n` +
        `• *${prefix}tourl*\n\n` +
        `Returns a direct download link _(valid 48 hours)_\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    await react('⏳');
    try {
      await fs.ensureDir(TEMP);

      const msgType = imgMsg ? 'imageMessage'
        : vidMsg ? 'videoMessage'
        : audMsg ? 'audioMessage'
        : docMsg ? 'documentMessage'
        : 'stickerMessage';

      const buf = await downloadMediaMessage(
        { message: { [msgType]: media }, key: msg.key },
        'buffer',
        {},
        { reuploadRequest: sock.updateMediaMessage }
      );

      const mime = media.mimetype || 'application/octet-stream';
      let ext = mime.split('/')[1] || 'bin';
      if (ext === 'jpeg')      ext = 'jpg';
      if (ext === 'quicktime') ext = 'mov';
      if (ext === 'x-matroska') ext = 'mkv';
      if (ext === 'octet-stream') ext = 'bin';
      if (ext === 'webp') ext = 'webp';

      const outFile = path.join(TEMP, `tourl_${Date.now()}.${ext}`);
      await fs.writeFile(outFile, buf);

      const url = await uploadToUguu(outFile);
      await fs.remove(outFile).catch(() => {});

      if (!url) throw new Error('No URL returned from uguu.se');

      const sizeMB = (buf.length / (1024 * 1024)).toFixed(2);
      const sizeKB = (buf.length / 1024).toFixed(1);

      await reply(
        `✅ *Upload Successful!*\n\n` +
        `📎 *Type:* ${mime.split('/')[0].toUpperCase()}\n` +
        `📦 *Size:* ${sizeMB >= 0.1 ? sizeMB + ' MB' : sizeKB + ' KB'}\n` +
        `🔗 *URL:*\n${url}\n\n` +
        `⚠️ _Link expires in 48 hours_\n\n` +
        `> 🤖 *AA MD Bot*`
      );
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *Upload failed.*\n\n${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
