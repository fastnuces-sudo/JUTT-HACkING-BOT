// ============================================
// AA MD Bot - ATTP (Animated Text Sticker)
// Converts text into a neon animated sticker
// ============================================

import axios from 'axios';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import config from '../../config.js';

const ATTP_API = 'https://raganork-api.onrender.com/api/attp';

export default {
  command: 'attp',
  alias: ['animatedtext', 'textsticker', 'ats'],
  description: 'Convert text to an animated neon sticker',
  category: 'media',

  async execute({ text, reply, react, sock, jid, msg }) {
    if (!text) return reply(
      `✨ *Animated Text Sticker*\n\n` +
      `*Usage:* *.attp <your text>*\n` +
      `*Example:* *.attp AA MD Bot*\n\n` +
      `> ✨ *AA MD Bot*`
    );

    if (text.length > 60) return reply('❌ Text too long. Max 60 characters.');

    await react('⏳');

    try {
      const url = `${ATTP_API}?text=${encodeURIComponent(text)}`;

      const sticker = new Sticker(url, {
        pack:       config.botName || 'AA MD Bot',
        author:     config.ownerName || 'AA Mods',
        type:       StickerTypes.FULL,
        categories: ['🤩', '✨'],
        quality:    70,
        background: 'transparent',
      });

      const buf = await sticker.toBuffer();
      await sock.sendMessage(jid, { sticker: buf }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ ATTP failed: ${e.message}\n\n💡 The animation server may be busy. Try again.`);
    }
  },
};
