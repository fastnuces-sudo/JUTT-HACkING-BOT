import axios from 'axios';

export default {
  command: 'wikipedia',
  alias: ['wiki'],
  description: 'Search Wikipedia for any topic',
  category: 'search',
  async execute({ sock, msg, jid, text, react, reply, prefix }) {
    if (!text) {
      await react('❔');
      return reply(`Please provide a search term!\n\nExample: *${prefix}wiki Elon Musk*`);
    }
    await react('📖');
    try {
      const searchRes = await axios.get(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(text)}`,
        {
          timeout: 10000,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' },
        }
      );
      const { title, extract, thumbnail, content_urls } = searchRes.data;
      if (!extract) {
        await react('❌');
        return reply(`No Wikipedia article found for: *${text}*`);
      }
      const summary = extract.length > 800 ? extract.slice(0, 800) + '...' : extract;
      const caption = `📖 *${title}*\n\n${summary}\n\n🔗 ${content_urls?.desktop?.page || ''}`;
      if (thumbnail?.source) {
        await sock.sendMessage(jid, { image: { url: thumbnail.source }, caption }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: caption }, { quoted: msg });
      }
    } catch (err) {
      if (err.response?.status === 404) {
        await react('❌');
        return reply(`No Wikipedia article found for: *${text}*`);
      }
      console.error('[ WIKI ] Error:', err.message);
      await react('❌');
      return reply('❌ Wikipedia search failed. Please try again in a few seconds.');
    }
  },
};
