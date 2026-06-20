import axios from 'axios';

const MIME_MAP = {
  mp3: 'audio/mpeg',  ogg: 'audio/ogg',
  wav: 'audio/wav',   m4a: 'audio/mp4',
  aac: 'audio/aac',   opus: 'audio/opus',
  flac: 'audio/flac', webm: 'audio/webm',
};

export default {
  command: 'sendaudio',
  alias: ['playurl', 'audiourl', 'playaudio'],
  description: 'Send audio from a direct URL',
  category: 'media',
  usage: '.sendaudio <direct audio URL>',
  cooldown: 8,

  async execute({ reply, sock, jid, msg, args }) {
    const url = args[0];
    if (!url || !url.startsWith('http')) {
      return reply(
        `🎵 *Send Audio from URL*\n\n` +
        `Usage: *.sendaudio <direct audio URL>*\n\n` +
        `Example:\n*.sendaudio https://example.com/audio.mp3*\n\n` +
        `_URL must be a direct link (mp3, ogg, wav, m4a, aac)_`
      );
    }

    await reply('🎵 _Fetching audio..._');

    try {
      const ext      = url.split('?')[0].split('.').pop().toLowerCase();
      const mimetype = MIME_MAP[ext] || 'audio/mpeg';

      await axios.head(url, { timeout: 10000 });

      await sock.sendMessage(jid, {
        audio: { url },
        mimetype,
        ptt: false,
      }, { quoted: msg });

    } catch (err) {
      reply('❌ Failed to send audio.\n_Check the URL is a direct audio link._\n' + (err.message?.slice(0, 70) || ''));
    }
  },
};
