// AA MD Bot — Dark/Black Filter
// Local sharp filter: deep darkness + slight cool tint

import sharp from 'sharp';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

export default {
  command: 'negro',
  alias: ['blackfilter', 'darkfilter', 'hitam'],
  description: 'Apply dark/black filter to a replied image',
  category: 'media',

  async execute({ sock, msg, jid, react, reply, quoted }) {
    const imgMsg = quoted?.message?.imageMessage;
    if (!imgMsg) {
      await react('❌');
      return reply(
        `🌑 *Dark Filter*\n\n` +
        `Reply to an image and send *.negro*\n` +
        `to apply the black/dark filter.\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }
    await react('⌛');
    try {
      const stream = await downloadContentFromMessage(imgMsg, 'image');
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);

      // Dark filter: heavy brightness reduction, desaturate, cool blue tint
      const result = await sharp(buffer)
        .modulate({ brightness: 0.28, saturation: 0.15 })
        .tint({ r: 20, g: 25, b: 50 })
        .jpeg({ quality: 85 })
        .toBuffer();

      await sock.sendMessage(jid, {
        image: result,
        caption:
          `🌑 *Dark Filter*\n\n` +
          `_Black filter applied!_\n\n` +
          `> 🤖 *AA MD Bot*`,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *Dark filter failed:* ${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
