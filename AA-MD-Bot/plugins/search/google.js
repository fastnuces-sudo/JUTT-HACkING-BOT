import axios from 'axios';

export default {
  command: 'google',
  alias: ['search', 'gsearch'],
  description: 'Search Google (via DuckDuckGo)',
  category: 'search',
  async execute({ reply, text }) {
    if (!text) return reply('❌ Usage: .google [query]\nExample: .google Node.js tutorial');
    try {
      const res = await axios.get(`https://api.duckduckgo.com/?q=${encodeURIComponent(text)}&format=json&no_html=1&skip_disambig=1`);
      const d = res.data;
      const answer = d.AbstractText || d.Answer || d.Definition;
      if (answer) {
        return reply(`🔍 *Search: ${text}*\n\n${answer}\n\n🔗 Source: ${d.AbstractURL || d.DefinitionURL || 'DuckDuckGo'}`);
      }
      const related = d.RelatedTopics?.slice(0, 5)?.map((t, i) => `${i + 1}. ${t.Text?.substring(0, 100) || ''}`.trim()).filter(Boolean).join('\n');
      reply(`🔍 *Search: ${text}*\n\n${related || 'No results found.'}\n\n🔗 https://duckduckgo.com/?q=${encodeURIComponent(text)}`);
    } catch {
      reply(`❌ Search failed for: *${text}*`);
    }
  },
};
