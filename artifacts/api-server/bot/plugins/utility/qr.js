import axios from 'axios';

export default {
  command: 'qr',
  alias: ['qrcode'],
  description: 'Generate a QR code from text/URL',
  category: 'utility',
  async execute({ reply, sock, jid, msg, text }) {
    if (!text) return reply('❌ Usage: .qr [text or URL]');
    try {
      const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(text)}`;
      const res = await axios.get(url, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(res.data);
      await sock.sendMessage(jid, { image: buffer, caption: `📱 *QR Code*\n\n📝 Content: ${text}` }, { quoted: msg });
    } catch {
      reply('❌ Failed to generate QR code');
    }
  },
};
