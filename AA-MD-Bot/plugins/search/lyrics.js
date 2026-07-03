// ============================================
// AA MD Bot - Lyrics Search
// Uses lrclib.net (free, no API key needed)
// ============================================
import axios from 'axios';

export default {
  command: 'lyrics',
  alias: ['lyric', 'lyricssearch'],
  description: 'Get song lyrics',
  category: 'search',

  async execute({ sock, msg, jid, text, react, reply, prefix }) {
    if (!text) {
      await react('❔');
      return reply(`🎶 Please provide a song name!\n\nExample: *${prefix}lyrics Shape of You*`);
    }

    await react('🎶');

    try {
      const { data } = await axios.get(
        `https://lrclib.net/api/search?q=${encodeURIComponent(text)}`,
        { timeout: 12000 }
      );

      if (!data || data.length === 0) {
        await react('❌');
        return reply(`❌ No lyrics found for: *${text}*\n\nTry a different song name.`);
      }

      // Pick best match (first result usually best)
      const song = data[0];
      const lyrics = song.plainLyrics || song.syncedLyrics?.replace(/\[\d+:\d+\.\d+\]\s*/g, '') || '';

      if (!lyrics) {
        await react('❌');
        return reply(`❌ Lyrics not available for: *${song.trackName}*`);
      }

      // Trim if too long for WhatsApp
      const MAX = 3500;
      const trimmedLyrics = lyrics.length > MAX
        ? lyrics.slice(0, MAX) + '\n\n_... (trimmed — too long)_'
        : lyrics;

      const caption =
        `🎵 *『 Lyrics Search Engine 』*\n\n` +
        `🎙️ *${song.trackName}*\n` +
        `🎤 *${song.artistName}*\n` +
        (song.albumName ? `💿 *${song.albumName}*\n` : '') +
        (song.duration ? `⏱️ *${Math.floor(song.duration / 60)}:${String(song.duration % 60).padStart(2, '0')}*\n` : '') +
        `\n━━━━━━━━━━━━━━━━\n\n` +
        `${trimmedLyrics}\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `> 🤖 *Powered by AA MD Bot*`;

      await sock.sendMessage(jid, { text: caption }, { quoted: msg });
      await react('✅');

    } catch (err) {
      console.error('Lyrics error:', err.message);
      await react('❌');
      return reply(`❌ Error fetching lyrics: ${err.message?.slice(0, 60)}`);
    }
  },
};
