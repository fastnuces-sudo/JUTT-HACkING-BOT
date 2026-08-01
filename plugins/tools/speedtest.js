import axios from 'axios';

export default {
  command: 'speedtest',
  alias: ['netspeed', 'stest', 'ispeed'],
  description: 'Test bot internet speed',
  category: 'tools',
  ownerOnly: true,
  superOwnerOnly: true,
  async execute({ reply }) {
    await reply('⏳ Running speed test...');
    const testUrl = 'https://speed.cloudflare.com/__down?bytes=1000000';
    const start = Date.now();
    try {
      const res = await axios.get(testUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const duration = (Date.now() - start) / 1000;
      const bytes = res.data.byteLength;
      const mbps = ((bytes * 8) / duration / 1_000_000).toFixed(2);
      const latency = start - Date.now() + duration * 1000;

      reply(`⚡ *Speed Test Results*\n\n📥 Download: *${mbps} Mbps*\n📦 Data: *${(bytes / 1024 / 1024).toFixed(2)} MB*\n⏱️ Time: *${duration.toFixed(2)}s*\n🌐 Provider: Cloudflare\n\n${parseFloat(mbps) > 50 ? '🟢 Excellent' : parseFloat(mbps) > 20 ? '🟡 Good' : '🔴 Slow'} connection`);
    } catch {
      reply('❌ Speed test failed. Check internet connection.');
    }
  },
};
