import axios from 'axios';

export default {
  command: 'spotify',
  alias: ['sp', 'spotifydl'],
  description: 'Get Spotify track info and download link',
  category: 'download',
  async execute({ reply, text }) {
    if (!text) return reply('❌ Usage: .spotify [track name]\nExample: .spotify Blinding Lights The Weeknd');
    try {
      const searchRes = await axios.get(`https://api.siputzx.my.id/api/search/spotify?q=${encodeURIComponent(text)}`, { timeout: 15000 });
      const track = searchRes.data?.data?.[0];
      if (!track) return reply('❌ No Spotify track found.');
      reply(`🎵 *Spotify Track*\n\n🎶 Title: *${track.name}*\n👤 Artist: *${track.artists?.map(a => a.name).join(', ')}*\n💿 Album: *${track.album?.name}*\n⏱️ Duration: *${Math.floor(track.duration_ms / 60000)}:${String(Math.floor((track.duration_ms % 60000) / 1000)).padStart(2, '0')}*\n🔗 Spotify: ${track.external_urls?.spotify || 'N/A'}\n\nUse *.ytmp3* to download the audio!`);
    } catch {
      reply('❌ Spotify search failed. Try again.');
    }
  },
};
