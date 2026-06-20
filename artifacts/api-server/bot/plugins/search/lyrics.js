import axios from 'axios';

export default {
  command: 'lyrics',
  alias: ['lyric', 'song'],
  description: 'Get song lyrics',
  category: 'search',
  async execute({ reply, args }) {
    if (args.length < 2) return reply('❌ Usage: .lyrics [artist] - [song]\nExample: .lyrics Eminem - Lose Yourself');
    const input = args.join(' ');
    const parts = input.split(' - ');
    if (parts.length < 2) return reply('❌ Format: .lyrics [artist] - [song]');
    const [artist, title] = parts;
    try {
      const res = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist.trim())}/${encodeURIComponent(title.trim())}`);
      const lyrics = res.data.lyrics?.substring(0, 3000) || 'No lyrics found';
      reply(`🎵 *${title.trim()}* — ${artist.trim()}\n\n${lyrics}${res.data.lyrics?.length > 3000 ? '\n\n...*(truncated)*' : ''}`);
    } catch {
      reply(`❌ Lyrics not found for: *${title}* by ${artist}`);
    }
  },
};
