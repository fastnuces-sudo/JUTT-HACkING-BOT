import axios from 'axios';

export default {
  command: 'ytmp3',
  alias: ['ymp3', 'ytaudio'],
  description: 'Download YouTube audio as MP3',
  category: 'download',
  async execute({ reply, sock, jid, msg, text }) {
    if (!text) return reply('❌ Usage: .ytmp3 [YouTube URL or search query]\nExample: .ytmp3 https://youtu.be/xxx');
    await reply('⏳ Downloading audio... Please wait.');
    try {
      const isUrl = text.includes('youtube.com') || text.includes('youtu.be');
      const query = isUrl ? text : `https://www.youtube.com/results?search_query=${encodeURIComponent(text)}`;
      const apiUrl = `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(isUrl ? text : `ytsearch:${text}`)}`;
      const res = await axios.get(apiUrl, { timeout: 30000 });
      const data = res.data?.data;
      if (!data?.dl) throw new Error('No download link');
      const audioRes = await axios.get(data.dl, { responseType: 'arraybuffer', timeout: 60000 });
      const buffer = Buffer.from(audioRes.data);
      await sock.sendMessage(jid, {
        audio: buffer,
        mimetype: 'audio/mpeg',
        fileName: `${data.title || 'audio'}.mp3`,
        ptt: false,
      }, { quoted: msg });
    } catch (err) {
      reply(`❌ Download failed: ${err.message}\n\nTry a direct YouTube URL.`);
    }
  },
};
