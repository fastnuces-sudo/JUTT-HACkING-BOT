// ============================================
// AA MD Bot - Emoji Mix (Google Emoji Kitchen)
// Mix two emojis into a combined image sticker
// ============================================

import axios from 'axios';
import { Sticker, StickerTypes } from 'wa-sticker-formatter';
import config from '../../config.js';

// Emoji Kitchen API (Google's free service)
const KITCHEN = 'https://www.gstatic.com/android/keyboard/emojikitchen';

// Emoji to codepoint string
function toCodepoint(emoji) {
  return [...emoji].map(c => c.codePointAt(0).toString(16)).join('-');
}

// Try multiple date combos (Google updates these periodically)
const DATES = ['20230301', '20221101', '20220406', '20210831', '20201001'];

async function getEmojiMix(e1, e2) {
  const cp1 = toCodepoint(e1);
  const cp2 = toCodepoint(e2);

  for (const date of DATES) {
    for (const [a, b] of [[cp1, cp2], [cp2, cp1]]) {
      const url = `${KITCHEN}/${date}/u${a}/u${a}_u${b}.png`;
      try {
        const { data } = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
        if (data.byteLength > 1000) return { url, buf: Buffer.from(data) };
      } catch {}
    }
  }

  // Fallback: emojik.vercel.app
  const fallback = `https://emojik.vercel.app/s/${cp1}_${cp2}?size=512`;
  const { data } = await axios.get(fallback, { responseType: 'arraybuffer', timeout: 10000 });
  if (data.byteLength > 500) return { url: fallback, buf: Buffer.from(data) };

  throw new Error('No mix found for this emoji combination');
}

export default {
  command: 'emojimix',
  alias: ['emix', 'mixemoji', 'ekitchen'],
  description: 'Mix two emojis together (Google Emoji Kitchen)',
  category: 'fun',

  async execute({ text, reply, react, sock, jid, msg, prefix }) {
    if (!text) return reply(
      `😂❤️ *Emoji Mixer*\n\n` +
      `*Usage:* ${prefix}emojimix <emoji1> <emoji2>\n\n` +
      `*Examples:*\n` +
      `• ${prefix}emojimix 😂 😭\n` +
      `• ${prefix}emojimix ❤️ 🔥\n` +
      `• ${prefix}emojimix 🐱 🐶\n\n` +
      `*Tip:* Use actual emoji characters, not text!\n\n` +
      `> 😂 *AA MD Bot*`
    );

    const parts = text.trim().split(/\s+/);
    const e1 = parts[0];
    const e2 = parts[1];

    if (!e1 || !e2) return reply('❌ Please provide two emojis.\n\nExample: *.emojimix 😂 😭*');

    await react('😂');

    try {
      const { buf } = await getEmojiMix(e1, e2);

      const sticker = new Sticker(buf, {
        pack:       config.botName || 'AA MD Bot',
        author:     `${e1} + ${e2}`,
        type:       StickerTypes.FULL,
        quality:    90,
        background: 'transparent',
      });

      const stickerBuf = await sticker.toBuffer();
      await sock.sendMessage(jid, { sticker: stickerBuf }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ Emoji mix failed: ${e.message}\n\n💡 Not all emoji combinations are available in Emoji Kitchen.`);
    }
  },
};
