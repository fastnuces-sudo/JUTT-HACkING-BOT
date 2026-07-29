// AA MD Bot — Image to Anime Style
// Local sharp filter: high saturation, vivid colours, edge-sharpened

import sharp from 'sharp';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

export default {
  command: 'toanime',
  alias: ['animefilter', 'animestyle'],
  description: 'Convert a replied image to anime/cartoon style',
  category: 'media',

  async execute({ sock, msg, jid, react, reply, quoted }) {
    const imgMsg = quoted?.message?.imageMessage;
    if (!imgMsg) {
      await react('❌');
      return reply(
        `🎌 *To Anime*\n\n` +
        `Reply to an image and send *.toanime*\n` +
        `to convert it to anime art style.\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }
    await react('⌛');
    try {
      const stream = await downloadContentFromMessage(imgMsg, 'image');
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);

      // Anime effect: vivid saturation, high contrast, strong edge sharpening
      const result = await sharp(buffer)
        .modulate({ brightness: 1.05, saturation: 2.2 })
        .normalise()
        .sharpen({ sigma: 2.5, m1: 4.0, m2: 0.3 })
        .jpeg({ quality: 92 })
        .toBuffer();

      await sock.sendMessage(jid, {
        image: result,
        caption:
          `🎌 *Anime Style*\n\n` +
          `_Anime transformation complete!_\n\n` +
          `> 🤖 *AA MD Bot*`,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *Anime filter failed:* ${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
