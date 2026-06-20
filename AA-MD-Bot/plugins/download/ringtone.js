import axios from 'axios';

export default {
  command: 'ringtone',
  alias: ['rt', 'tone'],
  category: 'download',
  description: 'Download ringtone by name',
  usage: '.ringtone back in black',
  ownerOnly: false,
  execute: async ({ reply, react, sock, jid, msg, text }) => {
    if (!text) return reply('🎵 Usage: .ringtone <song name>\n\nExample: .ringtone iphone ringtone');

    await react('⏳');

    try {
      const searchRes = await axios.get(`https://www.zedge.net/api/ringtones/search`, {
        params: { q: text, limit: 10 },
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 15000,
      }).catch(() => null);

      // Fallback: use Zedge public search
      const zedgeUrl = `https://www.zedge.net/ringtones/?q=${encodeURIComponent(text)}`;

      // Use free ringtone API
      const res = await axios.get(`https://api.myinstants.com/v1/instants/search/?name=${encodeURIComponent(text)}&format=json`, {
        timeout: 12000,
      });

      const results = res.data?.results;
      if (!results?.length) {
        await react('❌');
        return reply(`❌ No ringtone found for: *${text}*\n\nTry: .ringtone iphone, .ringtone nokia, .ringtone samsung`);
      }

      const pick = results[Math.floor(Math.random() * Math.min(5, results.length))];
      const audioUrl = pick.sound_url || pick.url;
      const title = pick.name || text;

      if (!audioUrl) {
        await react('❌');
        return reply('❌ Ringtone link not available. Try another name.');
      }

      await sock.sendMessage(jid, {
        audio: { url: audioUrl.startsWith('//') ? 'https:' + audioUrl : audioUrl },
        mimetype: 'audio/mpeg',
        fileName: `${title}.mp3`,
      }, { quoted: msg });

      await react('✅');
    } catch (e) {
      await react('❌');
      reply('❌ Ringtone download failed: ' + e.message);
    }
  },
};
