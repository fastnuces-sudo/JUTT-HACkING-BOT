import axios from 'axios';

const YT_REGEX =
  /^(https?:\/\/)?((www|m|music)\.)?(youtube(-nocookie)?\.com\/(watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]+(\S+)?$/i;

const extractUrl = (text) => {
  if (!text) return null;
  const match = text.match(YT_REGEX);
  return match ? match[0] : null;
};

export default {
  command: 'play',
  alias: ['song', 'yt', 'ytmp3', 'mp3', 'ytmp4', 'video', 'mp4'],
  description: 'Download YouTube audio or video',
  category: 'download',

  execute: async ({ sock, msg, jid, text, command, react, reply, prefix, config }) => {
    const botName = config?.botName || 'AA MD Bot';
    let query = text?.trim();

    if (!query && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
      query = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
      query = query.trim();
    }

    if (!query) {
      return reply(`🎬 *YouTube Downloader*

📌 *Usage:*
• ${prefix}play <song name>
• ${prefix}mp3 <youtube link>
• ${prefix}video <video name>
• ${prefix}mp4 <youtube link>
• ${prefix}yts <query>

✨ Reply to link also works`);
    }

    try {
      switch (command) {
        case 'mp4':
        case 'ytmp4':
        case 'video': {
          await react('🎥');

          let videoUrl = extractUrl(query);
          if (!videoUrl) {
            const search = await axios.get(
              `https://api-faa.my.id/faa/youtube?q=${encodeURIComponent(query)}`,
              { timeout: 15000 }
            );
            if (!search.data.status || !search.data.result?.length) {
              return reply('❌ No video found');
            }
            videoUrl = search.data.result[0].link;
            await sock.sendMessage(jid, {
              image: { url: search.data.result[0].imageUrl },
              caption: `🎬 *${search.data.result[0].title}*\n⏱ ${search.data.result[0].duration}\n\n⬇️ Downloading...`,
            }, { quoted: msg });
          }

          const videoRes = await axios.get(
            `https://api-faa.my.id/faa/ytmp4?url=${encodeURIComponent(videoUrl)}`,
            { timeout: 30000 }
          );
          const videoData = videoRes.data;
          if (!videoData.status) throw new Error('API failed');

          await sock.sendMessage(jid, {
            video: { url: videoData.result.download_url },
            mimetype: 'video/mp4',
            caption: `🎬 *Video Downloaded*\n\n> Powered by ${botName}`,
          }, { quoted: msg });

          await react('✅');
          break;
        }

        case 'mp3':
        case 'ytmp3': {
          await react('🎶');

          const audioUrl = extractUrl(query);
          if (!audioUrl) {
            return reply('❌ Invalid YouTube link. Please provide a valid YouTube URL for mp3.');
          }

          const audioRes = await axios.get(
            `https://api-faa.my.id/faa/ytmp3?url=${encodeURIComponent(audioUrl)}`,
            { timeout: 30000 }
          );
          const audioData = audioRes.data;
          if (!audioData.status) throw new Error('API failed');

          const { title: audioTitle, thumbnail: audioThumbnail, mp3: audioMp3 } = audioData.result;

          await sock.sendMessage(jid, {
            audio: { url: audioMp3 },
            mimetype: 'audio/mpeg',
            contextInfo: {
              externalAdReply: {
                title: audioTitle,
                body: '🎧 YouTube Audio',
                thumbnailUrl: audioThumbnail,
                mediaType: 2,
                renderLargerThumbnail: true,
              },
            },
          }, { quoted: msg });

          await react('✅');
          break;
        }

        case 'play':
        case 'song':
        case 'yt':
        default: {
          await react('📥');

          const playRes = await axios.get(
            `https://api-faa.my.id/faa/ytplay?query=${encodeURIComponent(query)}`,
            { timeout: 30000 }
          );
          const playData = playRes.data;
          if (!playData.status) throw new Error('API failed');

          const { title: playTitle, author: playAuthor, thumbnail: playThumbnail, mp3: playMp3 } = playData.result;

          await sock.sendMessage(jid, {
            image: { url: playThumbnail },
            caption: `🎶 *${playTitle}*\n👤 ${playAuthor}\n\n⬇️ Downloading...`,
          }, { quoted: msg });

          await sock.sendMessage(jid, {
            audio: { url: playMp3 },
            mimetype: 'audio/mpeg',
            contextInfo: {
              externalAdReply: {
                title: playTitle,
                body: playAuthor,
                thumbnailUrl: playThumbnail,
                mediaType: 2,
                renderLargerThumbnail: true,
              },
            },
          }, { quoted: msg });

          await react('✅');
          break;
        }
      }
    } catch (err) {
      console.error('[ YouTube ] Error:', err.message);
      await react('❌');
      reply(`❌ Error: ${err.message}`);
    }
  },
};
