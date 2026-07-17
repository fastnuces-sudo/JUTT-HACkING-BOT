// ============================================
// AA MD Bot - Dictionary / Word Definition
// Uses dictionaryapi.dev — free, no key needed
// Commands: .define .dict .meaning .definition
// ============================================
import axios from 'axios';

export default {
  command: 'define',
  alias: ['dict', 'meaning', 'definition', 'dictionary'],
  description: 'Look up word definitions, phonetics, synonyms — English dictionary',
  category: 'search',

  async execute({ text, reply, react, prefix }) {
    if (!text) return reply(
      `📖 *Dictionary*\n\n` +
      `*Usage:* ${prefix}define <word>\n\n` +
      `*Examples:*\n` +
      `• ${prefix}define serendipity\n` +
      `• ${prefix}define ephemeral\n` +
      `• ${prefix}define resilience\n\n` +
      `> 📖 *AA MD Bot*`
    );

    const word = text.trim().split(/\s+/)[0].toLowerCase();
    await react('📖');

    try {
      const { data } = await axios.get(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
        { timeout: 10000 }
      );

      const entry    = data[0];
      const phonetic = entry.phonetic || entry.phonetics?.find(p => p.text)?.text || '';
      const meanings = entry.meanings || [];

      let msg = `📖 *${entry.word}*`;
      if (phonetic) msg += `\n🔊 _${phonetic}_`;
      msg += '\n';

      for (const meaning of meanings.slice(0, 3)) {
        msg += `\n*${meaning.partOfSpeech.charAt(0).toUpperCase() + meaning.partOfSpeech.slice(1)}*\n`;
        const defs = (meaning.definitions || []).slice(0, 2);
        for (let i = 0; i < defs.length; i++) {
          msg += `${i + 1}. ${defs[i].definition}\n`;
          if (defs[i].example) msg += `   _"${defs[i].example}"_\n`;
        }
        if (meaning.synonyms?.length)  msg += `🔁 *Synonyms:* ${meaning.synonyms.slice(0,5).join(', ')}\n`;
        if (meaning.antonyms?.length)  msg += `↔️ *Antonyms:* ${meaning.antonyms.slice(0,3).join(', ')}\n`;
      }

      msg += `\n> 📖 *AA MD Bot*`;
      reply(msg);
      await react('✅');
    } catch (e) {
      await react('❌');
      if (e.response?.status === 404) {
        reply(`❌ *"${word}"* not found in the dictionary.\n\nTry checking the spelling.\n\n> 📖 *AA MD Bot*`);
      } else {
        reply(`❌ Dictionary lookup failed: ${e.message}\n\n> 📖 *AA MD Bot*`);
      }
    }
  },
};
