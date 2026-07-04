import axios from 'axios';

export default {
  command: 'wallpaper',
  alias: ['wall'],
  description: 'Search wallpapers',
  category: 'search',
  async execute({ sock, msg, jid, text, react, reply, prefix, config }) {
    if (!text) {
      await react('❔');
      return reply(`Please provide a wallpaper search term!\n\nExample: *${prefix}wallpaper nature*`);
    }
    await react('🖼️');
    try {
      const res = await axios.get(`https://wallhaven.cc/api/v1/search?q=${encodeURIComponent(text)}&purity=100&categories=100&sorting=relevance`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 10000,
      });
      const results = res.data?.data;
      if (!results || !results.length) {
        await react('❌');
        return reply(`No wallpapers found for: *${text}*`);
      }
      const picked = results[Math.floor(Math.random() * Math.min(results.length, 10))];
      const imgUrl = picked.path;
      if (!imgUrl) {
        await react('❌');
        return reply(`No wallpapers found for: *${text}*`);
      }
      const caption = `🖼️ *${picked.category || text}*\n_Type:_ ${picked.file_type || 'Wallpaper'}\n_Resolution:_ ${picked.resolution || ''}\n\n_🧩 Powered by_ *${config?.botName || 'AA MD Bot'}*`;
      await sock.sendMessage(jid, { image: { url: imgUrl }, caption }, { quoted: msg });
    } catch (err) {
      console.error('[ WALLPAPER ] Error:', err.message);
      await react('❌');
      return reply('❌ Wallpaper search failed. Please try again in a few seconds.');
    }
  },
};
