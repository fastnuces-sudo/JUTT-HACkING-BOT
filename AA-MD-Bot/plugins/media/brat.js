// AA MD Bot — Brat Text Sticker
// Generates brat-aesthetic text sticker via nexray API

import axios from 'axios';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';

export default {
  command: 'brat',
  alias: ['bratsticker', 'brattext'],
  description: 'Generate brat-style text sticker',
  category: 'media',

  async execute({ sock, msg, jid, text, react, reply, prefix, config }) {
    if (!text) {
      await react('❌');
      return reply(
        `🖊️ *Brat Sticker*\n\n` +
        `Enter text for the brat sticker.\n\n` +
        `*Usage:* ${prefix}brat i'm the main character\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }
    await react('⌛');
    try {
      const resp = await axios.get(
        `https://api.nexray.eu.cc/maker/brat?text=${encodeURIComponent(text)}`,
        {
          responseType: 'arraybuffer',
          timeout: 20000,
          headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*,*/*' },
        }
      );
      const buf = Buffer.from(resp.data);
      if (!buf || buf.length < 500) throw new Error('API returned empty image');
      const botName = config?.botName || 'AA MD Bot';
      const sticker = new Sticker(buf, {
        pack: botName,
        author: 'AA Mods',
        type: StickerTypes.FULL,
        categories: ['🤩', '🎉'],
        quality: 50,
        background: 'transparent',
      });
      await sock.sendMessage(jid, { sticker: await sticker.toBuffer() }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *Brat sticker failed:* ${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
