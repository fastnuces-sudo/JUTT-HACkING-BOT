import axios from 'axios';

export default {
  command: 'translate',
  alias: ['tr', 'tl'],
  description: 'Translate text to any language',
  category: 'utility',
  async execute({ reply, args, text }) {
    if (!text) return reply('❌ Usage: .translate [lang] [text]\nExample: .translate ur Hello world');
    const lang = args[0] || 'en';
    const toTranslate = args.slice(1).join(' ');
    if (!toTranslate) return reply('❌ Please provide text to translate');
    try {
      const res = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(toTranslate)}&langpair=en|${lang}`);
      const translated = res.data.responseData.translatedText;
      reply(`🌐 *Translation*\n\n📝 Original: ${toTranslate}\n🔤 Translated (${lang}): *${translated}*`);
    } catch {
      reply('❌ Translation failed. Try again later.');
    }
  },
};
