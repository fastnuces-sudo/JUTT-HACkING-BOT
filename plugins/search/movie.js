import axios from 'axios';

export default {
  command: 'movie',
  alias: ['film', 'imdb'],
  description: 'Search for movie information',
  category: 'search',
  async execute({ reply, text }) {
    if (!text) return reply('❌ Usage: .movie [title]\nExample: .movie Inception');
    try {
      const apiKey = process.env.OMDB_API_KEY || 'trilogy';
      const res = await axios.get(`https://www.omdbapi.com/?t=${encodeURIComponent(text)}&apikey=${apiKey}`);
      const m = res.data;
      if (m.Response === 'False') return reply(`❌ Movie not found: *${text}*`);
      reply(`🎬 *${m.Title}* (${m.Year})\n\n📖 *Plot:* ${m.Plot}\n\n🎭 *Genre:* ${m.Genre}\n👨‍💼 *Director:* ${m.Director}\n⭐ *Actors:* ${m.Actors}\n📊 *IMDb Rating:* ${m.imdbRating}/10\n🏆 *Awards:* ${m.Awards}\n⏱️ *Runtime:* ${m.Runtime}\n🌍 *Country:* ${m.Country}\n🔞 *Rated:* ${m.Rated}`);
    } catch {
      reply('❌ Failed to fetch movie info. Try again later.');
    }
  },
};
