// AA MD Bot - Dictionary
// Free: dictionaryapi.dev — no key needed
import axios from 'axios';

const BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';

function clean(s) { return (s || '').trim(); }

export default {
  command: 'dictionary',
  alias: ['dict', 'meaning', 'define2', 'wordmeaning'],
  description: 'Full meaning, examples, and synonyms for any English word',
  category: 'search',

  async execute({ reply, react, text, prefix }) {
    if (!text) return reply(
      `📖 *Dictionary*\n\n*Usage:* ${prefix}dictionary <word>\n*Example:* ${prefix}dictionary serendipity\n\n> 🤖 *AA MD Bot*`
    );

    const word = text.trim().split(/\s+/)[0].toLowerCase();
    await react('📖');

    try {
      const { data } = await axios.get(`${BASE}/${encodeURIComponent(word)}`, { timeout: 10000 });
      const entry = data?.[0];
      if (!entry) throw new Error('Not found');

      const phonetic = entry.phonetic || entry.phonetics?.find(p => p.text)?.text || '';
      const origin   = entry.origin || '';

      let out = `📖 *${entry.word}*`;
      if (phonetic) out += `  _${phonetic}_`;
      out += '\n';
      if (origin) out += `🌱 *Origin:* _${origin}_\n`;
      out += `${'─'.repeat(28)}\n`;

      let defCount = 0;
      for (const meaning of (entry.meanings || []).slice(0, 4)) {
        out += `\n*${meaning.partOfSpeech.toUpperCase()}*\n`;

        for (const def of (meaning.definitions || []).slice(0, 3)) {
          defCount++;
          out += `\n*${defCount}.* ${clean(def.definition)}\n`;
          if (def.example) out += `   _"${clean(def.example)}"_\n`;
        }

        const syns = (meaning.synonyms || []).slice(0, 5);
        const ants = (meaning.antonyms || []).slice(0, 5);
        if (syns.length) out += `\n✅ *Synonyms:* ${syns.join(', ')}\n`;
        if (ants.length) out += `❌ *Antonyms:* ${ants.join(', ')}\n`;
      }

      out += `\n> 🤖 *AA MD Bot*`;

      await react('✅');
      reply(out);
    } catch {
      await react('❌');
      reply(`❌ *"${word}"* — not found in the dictionary.\n\nPlease check the spelling.\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
