import axios from 'axios';

export default {
  command: 'pint',
  alias: ['pinterest', 'pin'],
  description: 'Search and download Pinterest images',
  category: 'download',
  async execute({ reply, sock, jid, msg, text }) {
    if (!text) return reply('❌ Usage: .pinterest [search query]\nExample: .pinterest anime wallpaper');
    try {
      const res = await axios.get(`https://api.siputzx.my.id/api/search/pinterest?q=${encodeURIComponent(text)}`, { timeout: 15000 });
      const images = res.data?.data?.slice(0, 3);
      if (!images?.length) return reply('❌ No Pinterest images found.');
      for (const imgUrl of images) {
        try {
          const imgRes = await axios.get(imgUrl, { responseType: 'arraybuffer', timeout: 30000 });
          await sock.sendMessage(jid, { image: Buffer.from(imgRes.data), caption: `📌 Pinterest: ${text}` }, { quoted: msg });
          await new Promise(r => setTimeout(r, 500));
        } catch {}
      }
    } catch {
      reply('❌ Pinterest search failed. Try again.');
    }
  },
};
