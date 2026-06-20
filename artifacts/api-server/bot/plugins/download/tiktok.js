import axios from 'axios';

export default {
  command: 'tiktok',
  alias: ['tt', 'tiktokdl'],
  description: 'Download TikTok video without watermark',
  category: 'download',
  async execute({ reply, sock, jid, msg, text }) {
    if (!text) return reply('❌ Usage: .tiktok [TikTok URL]\nExample: .tiktok https://vm.tiktok.com/xxx');
    if (!text.includes('tiktok.com')) return reply('❌ Please provide a valid TikTok URL');
    await reply('⏳ Downloading TikTok video...');
    try {
      const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(text)}`, { timeout: 20000 });
      const data = res.data;
      if (!data?.video?.noWatermark) throw new Error('No download link');
      const videoRes = await axios.get(data.video.noWatermark, { responseType: 'arraybuffer', timeout: 60000 });
      const buffer = Buffer.from(videoRes.data);
      await sock.sendMessage(jid, {
        video: buffer,
        caption: `🎵 *${data.title || 'TikTok Video'}*\n👤 ${data.author?.name || 'Unknown'}\n❤️ ${data.stats?.likeCount || 0} likes`,
        mimetype: 'video/mp4',
      }, { quoted: msg });
    } catch (err) {
      reply(`❌ TikTok download failed: ${err.message}`);
    }
  },
};
