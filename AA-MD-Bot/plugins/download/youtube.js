// ============================================
// AA MD Bot - YouTube Downloader
// 3 APIs only — no yt-dlp, no ffmpeg, no cookies
// Audio: EliteProTech → ABZTech → DavidCyrilTech
// Video: EliteProTech → ABZTech → DavidCyrilTech
// Search: DavidCyrilTech only
// ============================================

import axios from 'axios';

const YT_REGEX =
  /(https?:\/\/(?:(?:www|m|music)\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]+\S*)/i;

const extractUrl = (t) => {
  if (!t) return null;
  const m = t.match(YT_REGEX);
  return m ? m[1] : null;
};

// ── Fetch a URL as a Buffer ────────────────────────────────────────────────────
async function fetchBuf(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 90000,
    maxContentLength: 150 * 1024 * 1024,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  return Buffer.from(res.data);
}

// ── Extract a download URL from any key path in a response object ─────────────
function pickUrl(obj, ...paths) {
  for (const path of paths) {
    const val = path.split('.').reduce((o, k) => o?.[k], obj);
    if (typeof val === 'string' && val.startsWith('http')) return val;
  }
  return null;
}

// ── YouTube search (DavidCyrilTech) ──────────────────────────────────────────
async function searchYT(query) {
  const { data } = await axios.get(
    `https://apis.davidcyriltech.my.id/youtube/search?query=${encodeURIComponent(query)}`,
    { timeout: 15000 }
  );
  const results = data?.result || data?.results || data?.data || [];
  if (!Array.isArray(results) || !results.length) return null;
  const r = results[0];
  return {
    url:       r.url       || r.link       || r.videoUrl  || '',
    title:     r.title     || query,
    thumbnail: r.thumbnail || r.image      || '',
    duration:  r.duration  || '',
    author:    r.channel   || r.channelTitle || '',
  };
}

// ── Audio: try 3 APIs in order, return download URL ───────────────────────────
async function getAudioUrl(ytUrl) {
  const enc = encodeURIComponent(ytUrl);

  // 1. EliteProTech
  try {
    const { data } = await axios.get(
      `https://eliteprotech-apis.zone.id/ytdown?url=${enc}&format=mp3`,
      { timeout: 30000 }
    );
    const u = pickUrl(data, 'downloadURL', 'download_url', 'url', 'result.url', 'result.download_url', 'result.downloadUrl');
    if (u) return u;
  } catch {}

  // 2. ABZTech ytdl3
  try {
    const { data } = await axios.get(
      `https://api-abztech.zone.id/download/ytdl3?url=${enc}`,
      { timeout: 30000 }
    );
    const u = pickUrl(data, 'result.download_url', 'result.downloadUrl', 'result.url', 'download_url', 'url', 'data.url');
    if (u) return u;
  } catch {}

  // 3. DavidCyrilTech
  try {
    const { data } = await axios.get(
      `https://apis.davidcyriltech.my.id/download/ytmp3?url=${enc}`,
      { timeout: 30000 }
    );
    const u = pickUrl(data, 'result.download_url', 'result.downloadUrl', 'result.url', 'url', 'link');
    if (u) return u;
  } catch {}

  return null;
}

// ── Video: try 3 APIs in order, return download URL ───────────────────────────
async function getVideoUrl(ytUrl) {
  const enc = encodeURIComponent(ytUrl);

  // 1. EliteProTech
  try {
    const { data } = await axios.get(
      `https://eliteprotech-apis.zone.id/ytdown?url=${enc}&format=mp4`,
      { timeout: 30000 }
    );
    const u = pickUrl(data, 'downloadURL', 'download_url', 'url', 'result.url', 'result.download_url', 'result.downloadUrl');
    if (u) return u;
  } catch {}

  // 2. ABZTech ytdl4
  try {
    const { data } = await axios.get(
      `https://api-abztech.zone.id/download/ytdl4?url=${enc}`,
      { timeout: 30000 }
    );
    const u = pickUrl(data, 'result.download_url', 'result.downloadUrl', 'result.url', 'download_url', 'url', 'data.url');
    if (u) return u;
  } catch {}

  // 3. DavidCyrilTech
  try {
    const { data } = await axios.get(
      `https://apis.davidcyriltech.my.id/download/ytmp4?url=${enc}`,
      { timeout: 30000 }
    );
    const u = pickUrl(data, 'result.download_url', 'result.downloadUrl', 'result.url', 'url', 'link');
    if (u) return u;
  } catch {}

  return null;
}

// ── Captions ──────────────────────────────────────────────────────────────────
function audioCaption(meta, botName) {
  return (
    `✦✦✦✦✦✦✦✦✦✦\n` +
    `🎵 ${botName} MUSIC\n` +
    `✦✦✦✦✦✦✦✦✦✦\n\n` +
    `🎙 *${meta.title}*\n` +
    `🎤 ${meta.author || 'Unknown'}\n` +
    `⏱ ${meta.duration || '?'}\n\n` +
    `> 🤖 Powered by ${botName}\n` +
    `> 👨‍💻 Ahsan Ali Wadani`
  );
}

function videoCaption(meta, botName) {
  return (
    `✦✦✦✦✦✦✦✦✦✦\n` +
    `🎬 ${botName} VIDEO\n` +
    `✦✦✦✦✦✦✦✦✦✦\n\n` +
    `🎙 *${meta.title}*\n` +
    `🎤 ${meta.author || 'Unknown'}\n` +
    `⏱ ${meta.duration || '?'}\n\n` +
    `> 🤖 Powered by ${botName}\n` +
    `> 👨‍💻 Ahsan Ali Wadani`
  );
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

    // Also accept quoted message text
    if (!query) {
      const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (q) query = (q.conversation || q.extendedTextMessage?.text || '').trim();
    }

    if (!query) {
      return reply(
        `🎬 *YouTube Downloader*\n\n` +
        `📌 *Usage:*\n` +
        `• *${prefix}play* <song name> — search & download audio\n` +
        `• *${prefix}mp3* <youtube link> — direct audio\n` +
        `• *${prefix}video* <name or link> — download video\n` +
        `• *${prefix}mp4* <youtube link> — direct video\n\n` +
        `✨ Reply to a YouTube link also works`
      );
    }

    try {
      // ── VIDEO ───────────────────────────────────────────────────────────────
      if (command === 'mp4' || command === 'ytmp4' || command === 'video') {
        await react('🎥');
        let ytUrl = extractUrl(query);
        let meta  = { title: query, author: '', duration: '', thumbnail: '' };

        if (!ytUrl) {
          await reply(`🔍 _Searching: ${query}..._`);
          const found = await searchYT(query);
          if (!found?.url) { await react('❌'); return reply(`❌ No result found for: *${query}*`); }
          ytUrl = found.url;
          meta  = found;
        }

        if (meta.thumbnail) {
          await sock.sendMessage(jid, {
            image: { url: meta.thumbnail },
            caption: `${videoCaption(meta, botName)}\n\n⏳ _Downloading video..._`,
          }, { quoted: msg });
        }

        const videoUrl = await getVideoUrl(ytUrl);
        if (!videoUrl) {
          await react('❌');
          return reply(`❌ *Video download failed*\n\nAll 3 sources unavailable. Try again later.`);
        }

        const buf = await fetchBuf(videoUrl);
        if (!buf || buf.length < 50000) {
          await react('❌');
          return reply(`❌ *Video file invalid* — try again or use a different link.`);
        }

        await sock.sendMessage(jid, {
          video: buf,
          mimetype: 'video/mp4',
          caption: videoCaption(meta, botName),
        }, { quoted: msg });
        await react('✅');
        return;
      }

      // ── DIRECT MP3 (link only) ──────────────────────────────────────────────
      if (command === 'mp3' || command === 'ytmp3') {
        await react('🎶');
        const ytUrl = extractUrl(query);
        if (!ytUrl) {
          return reply(
            `❌ Please provide a valid YouTube URL.\n\n` +
            `To search by name: *${prefix}play <song name>*`
          );
        }

        const audioUrl = await getAudioUrl(ytUrl);
        if (!audioUrl) {
          await react('❌');
          return reply(`❌ *MP3 download failed*\n\nAll 3 sources unavailable. Try again later.`);
        }

        const buf = await fetchBuf(audioUrl);
        if (!buf || buf.length < 10000) {
          await react('❌');
          return reply(`❌ *Audio file invalid* — try again.`);
        }

        await sock.sendMessage(jid, {
          audio: buf,
          mimetype: 'audio/mpeg',
          ptt: false,
        }, { quoted: msg });
        await react('✅');
        return;
      }

      // ── PLAY / SONG / YT — search by name (or direct URL) ──────────────────
      await react('📥');
      const directUrl = extractUrl(query);
      let ytUrl = directUrl;
      let meta  = { title: query, author: '', duration: '', thumbnail: '' };

      if (!ytUrl) {
        await reply(`🔍 _Searching: ${query}..._`);
        const found = await searchYT(query);
        if (!found?.url) { await react('❌'); return reply(`❌ Could not find: *${query}*`); }
        ytUrl = found.url;
        meta  = found;
      }

      if (meta.thumbnail) {
        await sock.sendMessage(jid, {
          image: { url: meta.thumbnail },
          caption: `${audioCaption(meta, botName)}\n\n⏳ _Downloading audio..._`,
        }, { quoted: msg });
      }

      const audioUrl = await getAudioUrl(ytUrl);
      if (!audioUrl) {
        await react('❌');
        return reply(`❌ *Audio download failed*\n\nAll 3 sources unavailable. Try again later.`);
      }

      const buf = await fetchBuf(audioUrl);
      if (!buf || buf.length < 10000) {
        await react('❌');
        return reply(`❌ *Audio file invalid* — try again.`);
      }

      await sock.sendMessage(jid, {
        audio: buf,
        mimetype: 'audio/mpeg',
        ptt: false,
      }, { quoted: msg });
      await react('✅');

    } catch (err) {
      console.error('[ YouTube ]', err.message);
      await react('❌').catch(() => {});
      reply('❌ Download failed. Please try again.').catch(() => {});
    }
  },
};
