// AA MD Bot - ASCII Art Generator (figlet)
import figlet from 'figlet';
import { promisify } from 'util';

const figletAsync = promisify(figlet.text.bind(figlet));

const FONTS = ['Standard', 'Big', 'Slant', 'Banner', 'Block', 'Doom', 'Ghost', 'Poison', 'Thick'];

export default {
  command: 'ascii',
  alias: ['figlet', 'art', 'textart', 'asciart'],
  description: 'Convert text to ASCII art',
  category: 'fun',

  async execute({ text, reply, react, prefix }) {
    if (!text) {
      return reply(
        `🔡 *ASCII Art Generator*\n\n` +
        `*Usage:* ${prefix}ascii <text>\n` +
        `*With font:* ${prefix}ascii Hello --font Slant\n\n` +
        `*Available fonts:*\n${FONTS.map(f => `• ${f}`).join('\n')}\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    let font = 'Standard';
    let input = text;

    const fontIdx = input.indexOf('--font');
    if (fontIdx !== -1) {
      const parts = input.slice(fontIdx + 6).trim().split(/\s+/);
      const requested = parts[0];
      const matched = FONTS.find(f => f.toLowerCase() === requested.toLowerCase());
      if (matched) font = matched;
      input = input.slice(0, fontIdx).trim();
    }

    if (!input) return reply('❌ Provide text before --font option.');
    if (input.length > 30) return reply('❌ Text too long — max 30 characters.');

    await react('🔡');

    try {
      const result = await figletAsync(input, { font });
      if (!result?.trim()) throw new Error('empty result');
      await reply(`\`\`\`\n${result}\n\`\`\``);
    } catch (err) {
      await react('❌');
      await reply(`❌ Failed to generate ASCII art: ${err.message}`);
    }
  },
};
