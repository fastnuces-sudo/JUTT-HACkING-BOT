// AA MD Bot — TextPro Text Effects
// API: ABZTech (api-abztech.zone.id)
// Styles: neon, glitter, fire, shadow, gradient, dropwater, cloud, pixel, underwater

import axios from 'axios';

const STYLES = ['neon', 'glitter', 'fire', 'shadow', 'gradient', 'dropwater', 'cloud', 'pixel', 'underwater'];

export default {
  command: 'textpro',
  alias: ['txtpro', 'texteffect', 'te'],
  description: 'Generate text effects — neon, fire, glitter, shadow & more',
  category: 'media',

  async execute({ text, args, reply, react, sendMedia, prefix }) {
    let style     = 'neon';
    let inputText = text?.trim() || '';

    // Format: .textpro neon | HELLO WORLD
    if (inputText.includes('|')) {
      const [s, ...rest] = inputText.split('|');
      const candidate = s.trim().toLowerCase();
      if (STYLES.includes(candidate)) style = candidate;
      inputText = rest.join('|').trim();
    }
    // Format: .textpro fire HELLO WORLD
    else if (args.length > 1 && STYLES.includes(args[0]?.toLowerCase())) {
      style     = args[0].toLowerCase();
      inputText = args.slice(1).join(' ').trim();
    }

    if (!inputText) {
      return reply(
        `🎨 *Text Effects*\n\n` +
        `*Available styles:*\n` +
        `• neon • glitter • fire • shadow\n` +
        `• gradient • dropwater • cloud • pixel • underwater\n\n` +
        `*Usage:*\n` +
        `• *${prefix}textpro* HELLO\n` +
        `• *${prefix}textpro* neon | AA MD BOT\n` +
        `• *${prefix}textpro* fire GAMER\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    if (!STYLES.includes(style)) style = 'neon';

    await react('⏳');
    try {
      const { data } = await axios.get(
        `https://api-abztech.zone.id/tools/textpro?text=${encodeURIComponent(inputText)}&style=${style}`,
        { responseType: 'arraybuffer', timeout: 30000 }
      );
      const buf = Buffer.from(data);
      if (!buf || buf.length < 500) throw new Error('Invalid image response');

      await sendMedia({
        image:    buf,
        mimetype: 'image/png',
        caption:  `🎨 *${style.toUpperCase()} Effect*\n\n📝 ${inputText}\n\n> 🤖 *AA MD Bot*`,
      });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *Text effect failed.*\n\n${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
