import { downloadMediaMessage } from '@whiskeysockets/baileys';
export default {
  command: 'caption',
  alias: ['addcaption', 'cap'],
  description: 'Add caption to an image',
  category: 'media',
  async execute({ reply, sock, jid, msg, text }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const hasImage = quoted?.imageMessage || msg.message?.imageMessage;
    if (!hasImage) return reply('❌ Reply to an *image* with .caption [your text]');
    if (!text) return reply('❌ Please provide caption text\nExample: .caption Hello World!');

    try {
      const buffer = await downloadMediaMessage({ message: quoted ? { imageMessage: hasImage } : msg.message, key: msg.key }, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
      await sock.sendMessage(jid, { image: buffer, caption: text }, { quoted: msg });
    } catch (err) {
      reply('❌ Caption failed. Please try again in a few seconds.');
    }
  },
};
