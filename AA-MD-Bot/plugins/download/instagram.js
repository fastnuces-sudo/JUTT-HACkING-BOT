import axios from 'axios';

export default {
  command: 'instagram',
  alias: ['ig', 'igdl'],
  description: 'Download Instagram photo/video/reel',
  category: 'download',
  async execute({ reply, sock, jid, msg, text }) {
    if (!text) return reply('❌ Usage: .instagram [Instagram post/reel URL]');
    if (!text.includes('instagram.com')) return reply('❌ Please provide a valid Instagram URL');
    await reply('⏳ Downloading Instagram content...');
    try {
      const res = await axios.get(`https://api.siputzx.my.id/api/d/ig?url=${encodeURIComponent(text)}`, { timeout: 20000 });
      const data = res.data?.data;
      if (!data || !data.length) throw new Error('No media found');
      const media = data[0];
      const mediaRes = await axios.get(media.url, { responseType: 'arraybuffer', timeout: 60000 });
      const buffer = Buffer.from(mediaRes.data);
      if (media.type === 'video') {
        await sock.sendMessage(jid, { video: buffer, caption: '📸 Downloaded via AA MD Bot', mimetype: 'video/mp4' }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { image: buffer, caption: '📸 Downloaded via AA MD Bot' }, { quoted: msg });
      }
    } catch (err) {
      reply(`❌ Instagram download failed: ${err.message}`);
    }
  },
};
