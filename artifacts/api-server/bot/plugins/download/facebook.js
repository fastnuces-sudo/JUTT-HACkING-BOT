import axios from 'axios';

export default {
  command: 'facebook',
  alias: ['fb', 'fbdl'],
  description: 'Download Facebook video',
  category: 'download',
  async execute({ reply, text }) {
    if (!text) return reply('❌ Usage: .facebook [Facebook video URL]');
    if (!text.includes('facebook.com') && !text.includes('fb.watch')) return reply('❌ Please provide a valid Facebook URL');
    await reply('⏳ Fetching Facebook video...');
    try {
      const res = await axios.get(`https://api.siputzx.my.id/api/d/fb?url=${encodeURIComponent(text)}`, { timeout: 20000 });
      const data = res.data?.data;
      if (!data?.HD && !data?.SD) throw new Error('No video found');
      reply(`📘 *Facebook Video*\n\n🎬 HD: ${data.HD || 'N/A'}\n📹 SD: ${data.SD || 'N/A'}\n\n⚠️ Copy the link and open in browser to download.`);
    } catch (err) {
      reply(`❌ Facebook download failed: ${err.message}`);
    }
  },
};
