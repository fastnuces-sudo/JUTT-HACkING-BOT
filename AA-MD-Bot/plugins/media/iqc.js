// AA MD Bot — iPhone Chat Screenshot Generator
// Generates a fake iPhone chat screenshot via deline API

import axios from 'axios';

export default {
  command: 'iqc',
  alias: ['iphonechat', 'chatmock'],
  description: 'Generate fake iPhone chat screenshot with your text',
  category: 'media',

  async execute({ sock, msg, jid, text, react, reply, prefix }) {
    if (!text) {
      await react('❌');
      return reply(
        `📱 *iPhone Chat*\n\n` +
        `Generate a fake iPhone chat screenshot.\n\n` +
        `*Usage:* ${prefix}iqc Hello there!\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }
    await react('⌛');
    try {
      const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const resp = await axios.get(
        `https://api.deline.web.id/maker/iqc?text=${encodeURIComponent(text)}&chatTime=${encodeURIComponent(now)}&statusBarTime=${encodeURIComponent(now)}`,
        {
          responseType: 'arraybuffer',
          timeout: 20000,
          headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15' },
        }
      );
      const buf = Buffer.from(resp.data);
      if (!buf || buf.length < 1000) throw new Error('API returned empty image');
      await sock.sendMessage(jid, {
        image: buf,
        caption:
          `📱 *iPhone Chat*\n\n` +
          `✅ Fake chat generated!\n` +
          `💬 "${text}"\n\n` +
          `> 🤖 *AA MD Bot*`,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *IQC failed:* ${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
