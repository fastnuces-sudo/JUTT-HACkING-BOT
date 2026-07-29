// AA MD Bot — Image to Ghibli Style
// Local sharp filter: warm tones, soft contrast, painterly look

import sharp from 'sharp';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

export default {
  command: 'toghibli',
  alias: ['ghibli', 'ghiblistyle', 'ghibliart'],
  description: 'Convert a replied image to Studio Ghibli art style',
  category: 'media',

  async execute({ sock, msg, jid, react, reply, quoted }) {
    const imgMsg = quoted?.message?.imageMessage;
    if (!imgMsg) {
      await react('❌');
      return reply(
        `🎨 *To Ghibli*\n\n` +
        `Reply to an image and send *.toghibli*\n` +
        `to convert it to Studio Ghibli art style.\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }
    await react('⌛');
    try {
      const stream = await downloadContentFromMessage(imgMsg, 'image');
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const buffer = Buffer.concat(chunks);

      // Ghibli effect: warm tones, soft saturation, gentle glow, slight blur+sharpen
      const result = await sharp(buffer)
        .modulate({ brightness: 1.12, saturation: 0.80, hue: 8 })
        .gamma(1.15)
        .blur(0.4)
        .sharpen({ sigma: 0.6, m1: 0.8, m2: 0.1 })
        .tint({ r: 255, g: 245, b: 220 })
        .jpeg({ quality: 92 })
        .toBuffer();

      await sock.sendMessage(jid, {
        image: result,
        caption:
          `🎨 *Ghibli Style*\n\n` +
          `_Your image has been reimagined in Studio Ghibli style!_\n\n` +
          `> 🤖 *AA MD Bot*`,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *Ghibli filter failed:* ${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
