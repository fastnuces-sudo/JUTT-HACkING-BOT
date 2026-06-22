import axios from 'axios';

const YT_REGEX =
  /^(https?:\/\/)?((www|m|music)\.)?(youtube(-nocookie)?\.com\/(watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]+(\S+)?$/i;

const extractUrl = (text) => {
  if (!text) return null;
  const match = text.match(YT_REGEX);
  return match ? match[0] : null;
};

const api = axios.create({ timeout: 30000 });

// ── Helpers ──────────────────────────────────────────────────────────────────

async function searchYT(query) {
  // 1. Try api-faa.my.id search
  try {
    const { data: d } = await api.get(`https://api-faa.my.id/faa/youtube?q=${encodeURIComponent(query)}`);
    if (d.status && d.result?.length) {
      return { url: d.result[0].link, title: d.result[0].title, thumbnail: d.result[0].imageUrl, duration: d.result[0].duration, author: '' };
    }
  } catch {}
  // 2. Fall back to play-dl
  try {
    const playdl = (await import('play-dl')).default;
    const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 });
    if (results?.length) {
      const r = results[0];
      const mins = Math.floor((r.durationInSec || 0) / 60);
      const secs = String((r.durationInSec || 0) % 60).padStart(2, '0');
      return { url: r.url, title: r.title || query, thumbnail: r.thumbnails?.[0]?.url || '', duration: `${mins}:${secs}`, author: r.channel?.name || '' };
    }
  } catch {}
  return null;
}

async function getPlayAudio(query) {
  // 1. Try api-faa.my.id ytplay (search + direct download link)
  try {
    const { data: d } = await api.get(`https://api-faa.my.id/faa/ytplay?query=${encodeURIComponent(query)}`);
    if (d.status && d.result?.mp3) return { audioUrl: d.result.mp3, title: d.result.title, author: d.result.author, thumbnail: d.result.thumbnail };
  } catch {}
  // 2. Fall back: search YouTube then nexray ytmp3
  let meta = null;
  try {
    meta = await searchYT(query);
    if (meta?.url) {
      const { data: d } = await api.get(`https://api.nexray.web.id/downloader/ytmp3?url=${encodeURIComponent(meta.url)}`);
      if (d.status && d.result?.url) return { audioUrl: d.result.url, title: meta.title, author: meta.author, thumbnail: meta.thumbnail };
    }
  } catch {}
  // 3. Fall back: SoundCloud search via play-dl
  try {
    const playdl = (await import('play-dl')).default;
    const scResults = await playdl.search(query, { source: { soundcloud: 'tracks' }, limit: 1 });
    if (scResults?.length) {
      const sc = scResults[0];
      const stream = await playdl.stream(sc.url, { quality: 0 });
      const chunks = [];
      for await (const chunk of stream.stream) chunks.push(chunk);
      const audioBuffer = Buffer.concat(chunks);
      return {
        audioUrl: null,
        audioBuffer,
        title: sc.name || query,
        author: sc.publisher?.artist || sc.user?.name || 'SoundCloud',
        thumbnail: sc.thumbnail || meta?.thumbnail || '',
      };
    }
  } catch {}
  return null;
}

async function getMp3(url) {
  // 1. Try api-faa.my.id
  try {
    const { data: d } = await api.get(`https://api-faa.my.id/faa/ytmp3?url=${encodeURIComponent(url)}`);
    if (d.status && d.result?.mp3) return { audioUrl: d.result.mp3, title: d.result.title, thumbnail: d.result.thumbnail };
  } catch {}
  // 2. Fall back to nexray
  try {
    const { data: d } = await api.get(`https://api.nexray.web.id/downloader/ytmp3?url=${encodeURIComponent(url)}`);
    if (d.status && d.result?.url) return { audioUrl: d.result.url, title: d.result.title || '', thumbnail: d.result.thumbnail || '' };
  } catch {}
  return null;
}

async function getMp4(url, title = '') {
  // 1. Try api-faa.my.id
  try {
    const { data: d } = await api.get(`https://api-faa.my.id/faa/ytmp4?url=${encodeURIComponent(url)}`);
    if (d.status && d.result?.download_url) return { videoUrl: d.result.download_url, title: title };
  } catch {}
  // 2. Fall back to nexray
  try {
    const { data: d } = await api.get(`https://api.nexray.web.id/downloader/ytmp4?url=${encodeURIComponent(url)}`);
    if (d.status && d.result?.url) return { videoUrl: d.result.url, title: title };
  } catch {}
  return null;
}

// ── Plugin ────────────────────────────────────────────────────────────────────

export default {
  command: 'play',
  alias: ['song', 'yt', 'ytmp3', 'mp3', 'ytmp4', 'video', 'mp4'],
  description: 'Download YouTube audio or video',
  category: 'download',

  execute: async ({ sock, msg, jid, text, command, react, reply, prefix, config }) => {
    const botName = config?.botName || 'AA MD Bot';
    let query = text?.trim();

    if (!query) {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (quoted) query = (quoted.conversation || quoted.extendedTextMessage?.text || '').trim();
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

        // ── MP4 / VIDEO ──────────────────────────────────────────────────────
        case 'mp4':
        case 'ytmp4':
        case 'video': {
          await react('🎥');

          let videoUrl = extractUrl(query);
          let videoTitle = '';

          if (!videoUrl) {
            const meta = await searchYT(query);
            if (!meta?.url) return reply('❌ No video found');
            videoUrl = meta.url;
            videoTitle = meta.title;
            await sock.sendMessage(jid, {
              image: { url: meta.thumbnail },
              caption: `🎬 *${meta.title}*\n⏱ ${meta.duration}\n\n⬇️ Downloading...`,
            }, { quoted: msg });
          }

          const videoData = await getMp4(videoUrl, videoTitle);
          if (!videoData) throw new Error('Video download failed — all sources unavailable');

          await sock.sendMessage(jid, {
            video: { url: videoData.videoUrl },
            mimetype: 'video/mp4',
            caption: `🎬 *Video Downloaded*\n\n> Powered by ${botName}`,
          }, { quoted: msg });

          await react('✅');
          break;
        }

        // ── MP3 (URL only) ───────────────────────────────────────────────────
        case 'mp3':
        case 'ytmp3': {
          await react('🎶');

          const audioUrl = extractUrl(query);
          if (!audioUrl) return reply('❌ Invalid YouTube link. Please provide a valid YouTube URL for mp3.');

          const audioData = await getMp3(audioUrl);
          if (!audioData) throw new Error('MP3 download failed — all sources unavailable');

          await sock.sendMessage(jid, {
            audio: { url: audioData.audioUrl },
            mimetype: 'audio/mpeg',
            contextInfo: {
              externalAdReply: {
                title: audioData.title || 'YouTube Audio',
                body: '🎧 YouTube Audio',
                thumbnailUrl: audioData.thumbnail || '',
                mediaType: 2,
                renderLargerThumbnail: true,
              },
            },
          }, { quoted: msg });

          await react('✅');
          break;
        }

        // ── PLAY / SONG / YT (search by name) ───────────────────────────────
        case 'play':
        case 'song':
        case 'yt':
        default: {
          await react('📥');

          // If user pasted a YouTube URL directly
          const directUrl = extractUrl(query);
          if (directUrl) {
            const audioData = await getMp3(directUrl);
            if (!audioData) throw new Error('Download failed — all sources unavailable');
            await sock.sendMessage(jid, {
              audio: { url: audioData.audioUrl },
              mimetype: 'audio/mpeg',
              contextInfo: {
                externalAdReply: {
                  title: audioData.title || 'YouTube Audio',
                  body: '🎧 YouTube Audio',
                  thumbnailUrl: audioData.thumbnail || '',
                  mediaType: 2,
                  renderLargerThumbnail: true,
                },
              },
            }, { quoted: msg });
            await react('✅');
            break;
          }

          // Search by name → download audio
          const result = await getPlayAudio(query);
          if (!result) return reply(`❌ Could not find or download: *${query}*`);

          if (result.thumbnail) {
            await sock.sendMessage(jid, {
              image: { url: result.thumbnail },
              caption: `🎶 *${result.title}*\n👤 ${result.author}\n\n⬇️ Downloading...`,
            }, { quoted: msg });
          }

          // Support both URL-based and Buffer-based audio (SoundCloud returns a Buffer)
          const audioPayload = result.audioBuffer
            ? { audio: result.audioBuffer, mimetype: 'audio/mpeg' }
            : {
                audio: { url: result.audioUrl },
                mimetype: 'audio/mpeg',
                contextInfo: {
                  externalAdReply: {
                    title: result.title,
                    body: result.author,
                    thumbnailUrl: result.thumbnail,
                    mediaType: 2,
                    renderLargerThumbnail: true,
                  },
                },
              };

          await sock.sendMessage(jid, audioPayload, { quoted: msg });

          await react('✅');
          break;
        }
      }
    } catch (err) {
      console.error('[ YouTube ]', err.message);
      await react('❌');
      reply(`❌ Error: ${err.message}`);
    }
  },
};
