// ============================================
// AA MD Bot - AI Image Generator
// Uses pollinations.ai — completely free, no key
// ============================================

import axios from 'axios';

const BASE = 'https://image.pollinations.ai/prompt';

export default {
  command: 'imagine',
  alias: ['imgen', 'aiimage', 'aimg', 'genimage', 'dalle'],
  description: 'Generate AI images from text (free, no key needed)',
  category: 'search',

  async execute({ text, reply, react, sock, jid, msg, prefix }) {
    if (!text) return reply(
      `🎨 *AI Image Generator*\n\n` +
      `*Usage:* ${prefix}imagine <description>\n\n` +
      `*Examples:*\n` +
      `• ${prefix}imagine a cute cat in space\n` +
      `• ${prefix}imagine Pakistani mountain village at sunset\n` +
      `• ${prefix}imagine cyberpunk city with neon lights\n\n` +
      `> 🎨 *AA MD Bot*`
    );

    await react('🎨');

    try {
      const prompt = encodeURIComponent(text);
      const seed   = Math.floor(Math.random() * 999999);
      const url    = `${BASE}/${prompt}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;

      // Fetch the image buffer
      const { data: imgBuf } = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });

      await sock.sendMessage(jid, {
        image: Buffer.from(imgBuf),
        caption:
          `🎨 *AI Generated Image*\n\n` +
          `📝 *Prompt:* ${text.substring(0, 100)}${text.length > 100 ? '…' : ''}\n\n` +
          `> 🎨 *AA MD Bot*`,
      }, { quoted: msg });

      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ Image generation failed: ${e.message}\n\nTry a simpler description.`);
    }
  },
};
