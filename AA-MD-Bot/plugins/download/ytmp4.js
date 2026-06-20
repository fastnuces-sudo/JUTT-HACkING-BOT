import axios from 'axios';

export default {
  command: 'ytmp4',
  alias: ['ytvideo', 'ymp4'],
  description: 'Download YouTube video as MP4',
  category: 'download',
  async execute({ reply, sock, jid, msg, text }) {
    if (!text) return reply('❌ Usage: .ytmp4 [YouTube URL]\nExample: .ytmp4 https://youtu.be/xxx');
    if (!text.includes('youtube.com') && !text.includes('youtu.be')) return reply('❌ Please provide a valid YouTube URL');
    await reply('⏳ Downloading video... Please wait (this may take a while).');
    try {
      const apiUrl = `https://api.siputzx.my.id/api/d/ytmp4?url=${encodeURIComponent(text)}`;
      const res = await axios.get(apiUrl, { timeout: 30000 });
      const data = res.data?.data;
      if (!data?.dl) throw new Error('No download link');
      reply(`🎬 *${data.title || 'Video Ready'}*\n\n⬇️ Download: ${data.dl}\n\n⚠️ Video file too large to send directly via WhatsApp. Use the link above!`);
    } catch (err) {
      reply(`❌ Video download failed: ${err.message}`);
    }
  },
};
