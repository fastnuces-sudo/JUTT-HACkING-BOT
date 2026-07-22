// AA MD Bot - Bible Verse Lookup
import axios from 'axios';

const DAILY_VERSES = [
  'john 3:16', 'psalm 23:1', 'proverbs 3:5-6', 'philippians 4:13',
  'romans 8:28', 'isaiah 40:31', 'jeremiah 29:11', 'psalm 46:1',
  'matthew 6:33', 'john 14:6', 'genesis 1:1', '1 corinthians 13:4-7',
  'psalm 27:1', 'romans 12:2', 'hebrews 11:1', 'matthew 11:28',
  'joshua 1:9', 'psalm 119:105', 'john 16:33', 'galatians 5:22-23',
];

export default {
  command: 'bible',
  alias: ['verse', 'scripture', 'bibleverse'],
  description: 'Look up a Bible verse or get a random daily verse',
  category: 'search',

  async execute({ text, reply, react, prefix }) {
    await react('✝️');
    const ref = text?.trim() || DAILY_VERSES[Math.floor(Math.random() * DAILY_VERSES.length)];

    try {
      const { data } = await axios.get(
        `https://bible-api.com/${encodeURIComponent(ref)}`,
        { timeout: 10000 }
      );
      if (!data?.text) throw new Error('Verse not found');

      const verseText = data.text.trim().replace(/\n+/g, ' ');
      await reply(
        `✝️ *${data.reference}*\n\n` +
        `_"${verseText}"_\n\n` +
        `📖 Translation: ${data.translation_name || 'KJV'}\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    } catch {
      await react('❌');
      await reply(
        `❌ Verse not found for *"${ref}"*\n\n` +
        `Try: ${prefix}bible john 3:16\n` +
        `Or just: ${prefix}bible (random verse)`
      );
    }
  },
};
