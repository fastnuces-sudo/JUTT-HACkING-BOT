import { downloadMediaMessage } from '@whiskeysockets/baileys';
export default {
  command: 'sticker2img',
  alias: ['s2img', 'toimage', 'stickertoimage'],
  description: 'Convert WhatsApp sticker to image',
  category: 'media',
  async execute({ reply, sock, jid, msg }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const hasSticker = quoted?.stickerMessage || msg.message?.stickerMessage;

    if (!hasSticker) return reply('❌ Reply to a *sticker* with .sticker2img');

    try {
      const buffer = await downloadMediaMessage({
        message: quoted ? { stickerMessage: hasSticker } : msg.message,
        key: msg.key,
      }, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });

      if (!buffer) throw new Error('Failed to download sticker');

      await sock.sendMessage(jid, {
        image: buffer,
        caption: '✅ Sticker converted to image!',
        mimetype: 'image/webp',
      }, { quoted: msg });
    } catch (err) {
      reply('❌ Conversion failed. Please try again in a few seconds.');
    }
  },
};
