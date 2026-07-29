// ============================================
// AA MD Bot - YouTube Downloader
// Audio : DavidCyrilTech → ABZTech (ytdlv3) → EliteProTech → fetchBuf
// Video : DavidCyrilTech → EliteProTech → ABZTech ytdl4 → direct URL send
// Search: DavidCyrilTech
// Card  : externalAdReply (title + thumbnail via contextInfo only)
// ============================================

import axios from 'axios';

const YT_REGEX =
  /(https?:\/\/(?:(?:www|m|music)\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]+\S*)/i;

const extractUrl = (t) => { if (!t) return null; const m = t.match(YT_REGEX); return m ? m[1] : null; };

// ── Download audio URL to Buffer ──────────────────────────────────────────────
async function fetchBuf(url) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 90000,
    maxContentLength: 200 * 1024 * 1024,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  return Buffer.from(res.data);
}

// ── Search (DavidCyrilTech) ────────────────────────────────────────────────────
async function searchYT(query) {
  const { data } = await axios.get(
    `https://apis.davidcyriltech.my.id/youtube/search?query=${encodeURIComponent(query)}`,
    { timeout: 15000 }
  );
  const results = data?.result || data?.results || data?.data || [];
  if (!Array.isArray(results) || !results.length) return null;
  const r = results[0];
  return {
    url:       r.url       || r.link          || r.videoUrl   || '',
    title:     r.title     || query,
    thumbnail: r.thumbnail || r.image         || '',
    duration:  r.duration  || '',
    author:    r.channel   || r.channelTitle  || '',
  };
}

// ── Audio APIs: DavidCyrilTech → ABZTech ytdlv3 → EliteProTech ────────────────
async function getAudio(ytUrl) {
  const enc = encodeURIComponent(ytUrl);

  // 1. DavidCyrilTech
  try {
    const { data: d } = await axios.get(
      `https://apis.davidcyriltech.my.id/download/ytmp3?url=${enc}`,
      { timeout: 30000 }
    );
    const r   = d?.result || d;
    const url = r?.download_url || r?.downloadUrl || r?.url || d?.url;
    if (typeof url === 'string' && url.startsWith('http')) {
      return { url, title: r?.title || d?.title || '', thumbnail: r?.thumbnail || d?.thumbnail || '', filename: r?.filename || 'audio.mp3' };
    }
  } catch {}

  // 2. ABZTech ytdlv3
  try {
    const { data: d } = await axios.get(
      `https://api-abztech.zone.id/download/ytdlv3?url=${enc}`,
      { timeout: 30000 }
    );
    const url = d?.downloadUrl || d?.download_url || d?.url || d?.result?.url;
    if (d?.status !== false && typeof url === 'string' && url.startsWith('http')) {
      return { url, title: d?.title || '', thumbnail: d?.thumbnail || '', filename: d?.filename || 'audio.mp3' };
    }
  } catch {}

  // 3. EliteProTech
  try {
    const { data: d } = await axios.get(
      `https://eliteprotech-apis.zone.id/ytdown?url=${enc}&format=mp3`,
      { timeout: 30000 }
    );
    const url = d?.downloadURL || d?.download_url || d?.url || d?.result?.url || d?.result?.download_url;
    if (typeof url === 'string' && url.startsWith('http')) {
      return { url, title: d?.title || '', thumbnail: d?.thumbnail || '', filename: d?.filename || 'audio.mp3' };
    }
  } catch {}

  return null;
}

// ── Video APIs: DavidCyrilTech → EliteProTech → ABZTech ytdl4 ─────────────────
// Returns { url, title, thumbnail, filename } — url is direct MP4 download link
async function getVideo(ytUrl) {
  const enc = encodeURIComponent(ytUrl);

  // 1. DavidCyrilTech
  try {
    const { data: d } = await axios.get(
      `https://apis.davidcyriltech.my.id/download/ytmp4?url=${enc}`,
      { timeout: 30000 }
    );
    const r   = d?.result || d;
    const url = r?.download_url || r?.downloadUrl || r?.url || d?.url;
    if (typeof url === 'string' && url.startsWith('http')) {
      return { url, title: r?.title || d?.title || '', thumbnail: r?.thumbnail || d?.thumbnail || '', filename: r?.filename || 'video.mp4' };
    }
  } catch {}

  // 2. EliteProTech
  try {
    const { data: d } = await axios.get(
      `https://eliteprotech-apis.zone.id/ytdown?url=${enc}&format=mp4`,
      { timeout: 30000 }
    );
    const url = d?.downloadURL || d?.download_url || d?.url || d?.result?.url || d?.result?.download_url;
    if (typeof url === 'string' && url.startsWith('http')) {
      return { url, title: d?.title || '', thumbnail: d?.thumbnail || '', filename: d?.filename || 'video.mp4' };
    }
  } catch {}

  // 3. ABZTech ytdl4
  try {
    const { data: d } = await axios.get(
      `https://api-abztech.zone.id/download/ytdl4?url=${enc}`,
      { timeout: 30000 }
    );
    const url = d?.downloadUrl || d?.download_url || d?.url || d?.result?.url;
    if (d?.status !== false && typeof url === 'string' && url.startsWith('http')) {
      return { url, title: d?.title || '', thumbnail: d?.thumbnail || '', filename: d?.filename || 'video.mp4' };
    }
  } catch {}

  return null;
}

// ── externalAdReply card contextInfo ──────────────────────────────────────────
function buildCtx(title, thumbnail, ytUrl) {
  return {
    externalAdReply: {
      title:                 title     || 'YouTube',
      body:                  'AA MD Bot',
      thumbnailUrl:          thumbnail || '',
      mediaType:             1,
      mediaUrl:              ytUrl     || '',
      sourceUrl:             ytUrl     || '',
      renderLargerThumbnail: true,
      showAdAttribution:     false,
    },
  };
}

// ── Captions ──────────────────────────────────────────────────────────────────
function audioCaption(meta, botName) {
  return (
    `✦✦✦✦✦✦✦✦✦✦\n🎵 ${botName} MUSIC\n✦✦✦✦✦✦✦✦✦✦\n\n` +
    `🎙 *${meta.title || 'Unknown'}*\n` +
    `🎤 ${meta.author   || 'Unknown'}\n` +
    `⏱ ${meta.duration  || '?'}\n\n` +
    `> 🤖 Powered by ${botName}\n> 👨‍💻 Ahsan Ali Wadani`
  );
}

function videoCaption(meta, botName) {
  return (
    `✦✦✦✦✦✦✦✦✦✦\n🎬 ${botName} VIDEO\n✦✦✦✦✦✦✦✦✦✦\n\n` +
    `🎙 *${meta.title || 'Unknown'}*\n` +
    `🎤 ${meta.author   || 'Unknown'}\n` +
    `⏱ ${meta.duration  || '?'}\n\n` +
    `> 🤖 Powered by ${botName}\n> 👨‍💻 Ahsan Ali Wadani`
  );
}

// ── Plugin ────────────────────────────────────────────────────────────────────
export default {
  command: 'play',
  alias: ['song', 'yt', 'ytmp3', 'mp3', 'ytmp4', 'video', 'mp4'],
  description: 'Download YouTube audio or video',
  category: 'download',

  execute: async ({ sock, msg, jid, text, command, react, reply, sendMedia, prefix, config }) => {
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
        `• *${prefix}play* <song name or YT link> — audio\n` +
        `• *${prefix}video* <name or YT link> — video\n` +
        `• *${prefix}mp3* <YT link> — direct audio\n` +
        `• *${prefix}mp4* <YT link> — direct video\n\n` +
        `💡 Reply to any message containing a YT link also works`
      );
    }

    try {

      // ════════════════════════════════════════════════════════════════════════
      // VIDEO  (.video / .mp4 / .ytmp4)
      // API se direct download URL lao → Baileys direct URL send
      // ════════════════════════════════════════════════════════════════════════
      if (command === 'mp4' || command === 'ytmp4' || command === 'video') {
        await react('🎥');

        // 1. Resolve YouTube URL (search if name given)
        let ytUrl = extractUrl(query);
        let meta  = { title: query, author: '', duration: '', thumbnail: '' };

        if (!ytUrl) {
          let found;
          try { found = await searchYT(query); } catch {}
          if (!found?.url) {
            await react('❌');
            return reply(
              `❌ *No results found for: "${query}"*\n\n` +
              `💡 Try the full title or a YouTube link:\n` +
              `• *${prefix}video* Shape of You\n` +
              `• *${prefix}video* https://youtu.be/...`
            );
          }
          ytUrl = found.url;
          meta  = found;
        }

        // 2. Get direct download URL from APIs
        const apiResult = await getVideo(ytUrl);
        if (!apiResult?.url) {
          await react('❌');
          return reply(
            `❌ *Video download failed*\n\n` +
            `All 3 video APIs unavailable:\n` +
            `• DavidCyrilTech ✗\n` +
            `• EliteProTech ✗\n` +
            `• ABZTech ✗\n\n` +
            `💡 Try again later or use a different video`
          );
        }

        // Fill in metadata from API if search didn't provide it
        if (apiResult.title)     meta.title     = meta.title     || apiResult.title;
        if (apiResult.thumbnail) meta.thumbnail = meta.thumbnail || apiResult.thumbnail;
        if (apiResult.author)    meta.author    = meta.author    || apiResult.author;

        // 3. Send video via direct URL — Baileys handles the download
        await sock.sendMessage(jid, {
          video:       { url: apiResult.url },
          mimetype:    'video/mp4',
          fileName:    apiResult.filename || `${meta.title || 'video'}.mp4`,
          caption:     videoCaption(meta, botName),
          contextInfo: buildCtx(meta.title, meta.thumbnail, ytUrl),
        }, { quoted: msg });

        await react('✅');
        return;
      }

      // ════════════════════════════════════════════════════════════════════════
      // DIRECT MP3  (.mp3 / .ytmp3)  — link only, no search
      // ════════════════════════════════════════════════════════════════════════
      if (command === 'mp3' || command === 'ytmp3') {
        await react('🎶');

        const ytUrl = extractUrl(query);
        if (!ytUrl) {
          return reply(
            `❌ *Valid YouTube link do*\n\n` +
            `Naam se search karne ke liye:\n` +
            `• *${prefix}play* <song name>`
          );
        }

        const result = await getAudio(ytUrl);
        if (!result?.url) {
          await react('❌');
          return reply(
            `❌ *Audio download failed*\n\n` +
            `All 3 audio APIs unavailable — try again later.\n` +
            `Or search: *${prefix}play* <song name>`
          );
        }

        let buf;
        try { buf = await fetchBuf(result.url); } catch {}
        if (!buf || buf.length < 10000) {
          await react('❌');
          return reply(
            `❌ *Audio file download failed*\n\n` +
            `URL received but file could not be downloaded — try again.\n` +
            `Or search: *${prefix}play* <song name>`
          );
        }

        await sendMedia({
          audio:       buf,
          mimetype:    'audio/mpeg',
          fileName:    result.filename || 'audio.mp3',
          ptt:         false,
          contextInfo: buildCtx(result.title, result.thumbnail, ytUrl),
        });
        await react('✅');
        return;
      }

      // ════════════════════════════════════════════════════════════════════════
      // PLAY / SONG / YT  — search by name OR direct link (audio)
      // ════════════════════════════════════════════════════════════════════════
      await react('📥');

      const directUrl = extractUrl(query);
      let ytUrl = directUrl;
      let meta  = { title: query, author: '', duration: '', thumbnail: '' };

      if (!ytUrl) {
        let found;
        try { found = await searchYT(query); } catch {}
        if (!found?.url) {
          await react('❌');
          return reply(
            `❌ *No results found for: "${query}"*\n\n` +
            `💡 Try a different name or a YouTube link:\n` +
            `• *${prefix}play* Shape of You Ed Sheeran\n` +
            `• *${prefix}play* https://youtu.be/...`
          );
        }
        ytUrl = found.url;
        meta  = found;
      }

      const result = await getAudio(ytUrl);
      if (!result?.url) {
        await react('❌');
        return reply(
          `❌ *Audio download failed*\n\n` +
          `All 3 audio APIs unavailable — try again later.\n` +
          `💡 Want video instead? *${prefix}video* ${query}`
        );
      }

      if (result.title)     meta.title     = meta.title     || result.title;
      if (result.thumbnail) meta.thumbnail = meta.thumbnail || result.thumbnail;

      let buf;
      try { buf = await fetchBuf(result.url); } catch {}
      if (!buf || buf.length < 10000) {
        await react('❌');
        return reply(
          `❌ *Audio file download failed*\n\n` +
          `URL received but file could not be downloaded — try again.\n` +
          `💡 Try with a direct link: *${prefix}mp3* <YT link>`
        );
      }

      await sendMedia({
        audio:       buf,
        mimetype:    'audio/mpeg',
        fileName:    result.filename || 'audio.mp3',
        ptt:         false,
        contextInfo: buildCtx(meta.title, meta.thumbnail, ytUrl),
      });
      await react('✅');

    } catch (err) {
      console.error('[ YouTube ]', err.message);
      await react('❌').catch(() => {});
      reply(
        `❌ *YouTube download failed*\n\n` +
        `Please try again or use a different YouTube link.\n` +
        `💡 You can also try: *${prefix}play* <song name>`
      ).catch(() => {});
    }
  },
};
