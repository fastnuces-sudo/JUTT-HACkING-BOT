import axios from 'axios';

export default {
  command: 'news',
  alias: ['headlines'],
  description: 'Get latest news headlines',
  category: 'search',
  async execute({ reply, args }) {
    const topic = args.join(' ') || 'world';
    try {
      const res = await axios.get(`https://gnews.io/api/v4/search?q=${encodeURIComponent(topic)}&lang=en&max=5&token=demo`, {
        timeout: 8000
      });
      const articles = res.data?.articles?.slice(0, 5);
      if (!articles?.length) throw new Error('no articles');
      let text = `📰 *News: ${topic.toUpperCase()}*\n\n`;
      articles.forEach((a, i) => {
        text += `${i + 1}. *${a.title}*\n   📅 ${new Date(a.publishedAt).toLocaleDateString()}\n   🔗 ${a.url}\n\n`;
      });
      reply(text.trim());
    } catch {
      reply(`📰 *News: ${topic}*\n\n⚠️ Live news requires an API key. Set GNEWS_API_KEY in environment.\n\nVisit https://gnews.io for a free key.`);
    }
  },
};
