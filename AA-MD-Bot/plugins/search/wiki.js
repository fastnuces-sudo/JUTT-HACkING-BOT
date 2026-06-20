import axios from 'axios';

export default {
  command: 'wiki',
  alias: ['wikipedia', 'define'],
  description: 'Search Wikipedia for any topic',
  category: 'search',
  async execute({ reply, text }) {
    if (!text) return reply('❌ Usage: .wiki [topic]\nExample: .wiki Elon Musk');
    try {
      const res = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(text)}`);
      const { title, extract, content_urls } = res.data;
      const summary = extract?.substring(0, 800) || 'No summary available';
      reply(`📖 *Wikipedia: ${title}*\n\n${summary}${extract?.length > 800 ? '...' : ''}\n\n🔗 ${content_urls?.desktop?.page || ''}`);
    } catch {
      reply(`❌ No Wikipedia article found for: *${text}*`);
    }
  },
};
