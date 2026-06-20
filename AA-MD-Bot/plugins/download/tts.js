import googleTTS from 'google-tts-api';

export default {
  command: 'tts',
  alias: ['texttospeech', 'speak'],
  category: 'download',
  description: 'Convert text to speech audio',
  usage: '.tts Hello this is AA MD Bot',
  ownerOnly: false,
  execute: async ({ reply, sock, jid, msg, text }) => {
    if (!text) return reply('🔊 Usage: .tts <your text>\n\nExample: .tts Hello World');
    if (text.length > 200) return reply('❌ Text too long! Max 200 characters.');
    try {
      const url = googleTTS.getAudioUrl(text, {
        lang: 'en',
        slow: false,
        host: 'https://translate.google.com',
      });
      await sock.sendMessage(jid, {
        audio: { url },
        mimetype: 'audio/mpeg',
        fileName: 'tts.mp3',
      }, { quoted: msg });
    } catch (e) {
      reply('❌ TTS failed: ' + e.message);
    }
  },
};
