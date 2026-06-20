import axios from 'axios';

export default {
  command: 'anime',
  alias: ['mal'],
  description: 'Search for anime information',
  category: 'search',
  async execute({ reply, text }) {
    if (!text) return reply('❌ Usage: .anime [name]\nExample: .anime Naruto');
    try {
      const res = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(text)}&limit=1`);
      const anime = res.data.data?.[0];
      if (!anime) return reply(`❌ Anime not found: *${text}*`);
      reply(`🎌 *${anime.title}*\n${anime.title_english ? `(${anime.title_english})` : ''}\n\n📝 *Synopsis:* ${(anime.synopsis || 'N/A').substring(0, 400)}...\n\n📊 *Score:* ⭐ ${anime.score || 'N/A'}/10\n📺 *Episodes:* ${anime.episodes || 'N/A'}\n📅 *Status:* ${anime.status || 'N/A'}\n🎭 *Genres:* ${anime.genres?.map(g => g.name).join(', ') || 'N/A'}\n📆 *Aired:* ${anime.aired?.string || 'N/A'}\n🏆 *Rank:* #${anime.rank || 'N/A'}\n🔗 ${anime.url}`);
    } catch {
      reply('❌ Failed to fetch anime info. Try again.');
    }
  },
};
