import axios from 'axios';

export default {
  command: 'meme',
  alias: ['randmeme'],
  description: 'Get a random meme',
  category: 'fun',
  async execute({ sock, jid, msg, reply }) {
    try {
      const res = await axios.get('https://meme-api.com/gimme');
      const { title, url, author, subreddit } = res.data;
      if (!url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) throw new Error('not image');
      const imgRes = await axios.get(url, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(imgRes.data);
      await sock.sendMessage(jid, {
        image: buffer,
        caption: `😂 *${title}*\n\n📌 r/${subreddit} | 👤 u/${author}`,
      }, { quoted: msg });
    } catch {
      reply('❌ Could not fetch meme right now. Try again!');
    }
  },
};
