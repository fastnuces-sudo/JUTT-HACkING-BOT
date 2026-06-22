export default {
  command: 'yts',
  alias: ['youtubesearch', 'ytsearch'],
  description: 'Search YouTube videos',
  category: 'search',
  async execute({ sock, msg, jid, text, react, reply, prefix }) {
    if (!text) {
      await react('❔');
      return reply(`Please provide an Youtube Search Term !\n\nExample: *${prefix}yts Despacito*`);
    }
    await react('📜');
    try {
      const playdl = (await import('play-dl')).default;
      const results = await playdl.search(text, { source: { youtube: 'video' }, limit: 10 });
      if (!results || results.length === 0) {
        await react('❌');
        return reply(`No results found for: *${text}*`);
      }
      const thumbnail2 = results[0].thumbnails?.[0]?.url || '';
      let num = 1;
      let txt2 = `*🏮 YouTube Search Engine 🏮*\n\n_🧩 Search Term:_ *${text}*\n\n*📌 Total Results:* *${results.length}*\n`;
      for (let i of results) {
        const mins = Math.floor((i.durationInSec || 0) / 60);
        const secs = String((i.durationInSec || 0) % 60).padStart(2, '0');
        txt2 += `\n_Result:_ *${num++}*\n_🎀 Title:_ *${i.title}*\n_🔶 Duration:_ *${mins}:${secs}*\n_🔷 Link:_ ${i.url}\n\n`;
      }
      let buttonMessage = { image: { url: thumbnail2 }, caption: txt2 };
      await sock.sendMessage(jid, buttonMessage, { quoted: msg });
    } catch (err) {
      console.error('YTSearch error:', err);
      await react('❌');
      return reply(`An error occurred while searching YouTube for: *${text}*`);
    }
  },
};
