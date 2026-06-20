import axios from 'axios';

export default {
  command: 'twitter',
  alias: ['tw', 'twdl', 'xdl'],
  description: 'Download Twitter/X video',
  category: 'download',
  async execute({ reply, sock, jid, msg, text }) {
    if (!text) return reply('❌ Usage: .twitter [tweet URL]\nExample: .twitter https://twitter.com/user/status/xxx');
    if (!text.includes('twitter.com') && !text.includes('x.com')) return reply('❌ Please provide a valid Twitter/X URL');
    await reply('⏳ Downloading Twitter video...');
    try {
      const res = await axios.get(`https://api.siputzx.my.id/api/d/twitter?url=${encodeURIComponent(text)}`, { timeout: 20000 });
      const data = res.data;
      if (!data?.data?.url) throw new Error('No video found');
      const videoRes = await axios.get(data.data.url, { responseType: 'arraybuffer', timeout: 60000 });
      const buffer = Buffer.from(videoRes.data);
      await sock.sendMessage(jid, { video: buffer, caption: `🐦 Twitter Video\n\n${data.data.text || ''}`.substring(0, 200), mimetype: 'video/mp4' }, { quoted: msg });
    } catch (err) {
      reply(`❌ Twitter download failed: ${err.message}`);
    }
  },
};
