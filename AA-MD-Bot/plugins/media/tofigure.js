// AA MD Bot — To Figure / Cartoon Filter
// Local sharp filter: poster-style, strong edges, bold colours

import sharp from 'sharp';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

export default {
  command: 'tofigure',
  alias: ['figurefilter', 'figure'],
  description: 'Apply figure/cartoon art filter to a replied image',
  category: 'media',

  async execute({ sock, msg, jid, react, reply, quoted }) {
    const imgMsg = quoted?.message?.imageMessage;
    if (!imgMsg) {
      await react('❌');
      return reply(
        `🖼️ *To Figure*\n\n` +
        `Reply to an image and send *.tofigure*\n` +
        `to apply the cartoon/figure filter.\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }
    await react('⌛');
    try {
      const stream = await downloadContentFromMessage(imgMsg, 'image');
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);

      // Figure/cartoon effect: poster colours, bold edges, high contrast
      const result = await sharp(buffer)
        .modulate({ brightness: 1.1, saturation: 1.8 })
        .normalise()
        .linear(1.08, -8)          // slight contrast lift (replaces gamma(0.9))
        .sharpen({ sigma: 3.5, m1: 6.0, m2: 0.2 })
        .jpeg({ quality: 92 })
        .toBuffer();

      await sock.sendMessage(jid, {
        image: result,
        caption:
          `🖼️ *Figure Filter*\n\n` +
          `_Figure filter applied!_\n\n` +
          `> 🤖 *AA MD Bot*`,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *Figure filter failed:* ${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
