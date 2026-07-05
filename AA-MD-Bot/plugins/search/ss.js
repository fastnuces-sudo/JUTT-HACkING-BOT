// ============================================
// AA MD Bot - Website Screenshot
// Uses thum.io (free, no API key needed)
// ============================================

import axios from 'axios';

const THUM = 'https://image.thum.io/get/width/1280/crop/800/url';

export default {
  command: 'screenshot',
  alias: ['webss', 'snap', 'webshot', 'capture'],
  description: 'Take a screenshot of any website',
  category: 'search',

  async execute({ text, reply, react, sock, jid, msg, prefix }) {
    if (!text) return reply(
      `📸 *Website Screenshot*\n\n` +
      `*Usage:* ${prefix}ss <url>\n\n` +
      `*Example:*\n` +
      `• ${prefix}ss https://google.com\n` +
      `• ${prefix}ss github.com\n\n` +
      `> 📸 *AA MD Bot*`
    );

    let url = text.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    await react('📸');

    try {
      const ssUrl = `${THUM}/${encodeURIComponent(url)}`;
      const { data: imgBuf } = await axios.get(ssUrl, { responseType: 'arraybuffer', timeout: 30000 });

      await sock.sendMessage(jid, {
        image: Buffer.from(imgBuf),
        caption:
          `📸 *Website Screenshot*\n\n` +
          `🌐 *URL:* ${url}\n\n` +
          `> 📸 *AA MD Bot*`,
      }, { quoted: msg });

      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ Screenshot failed: ${e.message}\n\nMake sure the URL is correct and the site is accessible.`);
    }
  },
};
