// ============================================
// AA MD Bot - Universal Multi-Platform Downloader
// Primary: cobalt.tools (free, no key needed)
// Platform fallbacks for each service
// ============================================

import axios from 'axios';

// URL detectors
const TT  = /https?:\/\/(www\.)?(vm\.|vt\.|m\.)?tiktok\.com\/[^\s]+/gi;
const IG  = /https?:\/\/(www\.)?instagram\.com\/[^\s]+/gi;
const MF  = /https?:\/\/(www\.)?mediafire\.com\/\S+/gi;
const PIN = /https?:\/\/(www\.)?(pinterest\.(com|fr|de|co\.uk|jp|ru|ca|it|com\.au|com\.mx|com\.br|es|pl)|pin\.it)\/[^\s]+/gi;
const FB  = /https?:\/\/(www\.|m\.|web\.)?facebook\.com\/[^\s]+/gi;
const TW  = /https?:\/\/(www\.)?(twitter\.com|x\.com)\/[^\s]+/gi;
const SC  = /https?:\/\/(www\.|on\.)?soundcloud\.com\/[^\s]+/gi;
const SP  = /https?:\/\/open\.spotify\.com\/[^\s]+/gi;
const YT  = /https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/gi;
const TH  = /https?:\/\/(www\.)?threads\.(net|com)\/[^\s]+/gi;

const clean = (m) => m?.[0]?.replace(/[.,!?;]$/, '');

const extract = (txt) => {
  if (!txt) return null;
  let m;
  m = txt.match(TT);  if (m) return { type: 'tt',  url: clean(m) };
  m = txt.match(IG);  if (m) { const u = clean(m); if (!u.includes('/stories/')) return { type: 'ig', url: u }; }
  m = txt.match(PIN); if (m) return { type: 'pin', url: clean(m) };
  m = txt.match(FB);  if (m) { const u = clean(m); if (!/\/(login|dialog|plugins)\//.test(u)) return { type: 'fb', url: u }; }
  m = txt.match(TW);  if (m) return { type: 'tw',  url: clean(m) };
  m = txt.match(TH);  if (m) return { type: 'th',  url: clean(m) };
  m = txt.match(SC);  if (m) return { type: 'sc',  url: clean(m) };
  m = txt.match(SP);  if (m) return { type: 'sp',  url: clean(m) };
  m = txt.match(YT);  if (m) return { type: 'yt',  url: clean(m) };
  m = txt.match(MF);  if (m) return { type: 'mf',  url: clean(m) };
  return null;
};

const api = axios.create({ timeout: 30000 });

// ── Cobalt.tools — free universal API ─────────────────────────────────────────
async function cobalt(url, opts = {}) {
  const { data } = await api.post('https://api.cobalt.tools/', {
    url,
    downloadMode: opts.mode || 'auto',
    filenameStyle: 'pretty',
    videoQuality: '720',
    audioFormat: 'mp3',
    ...opts,
  }, {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    timeout: 25000,
  });
  return data;
}

// ── Platform-specific fallbacks ────────────────────────────────────────────────
async function tikwm(url) {
  const { data: d } = await api.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}`);
  if (d.code !== 0 || !d.data) throw new Error(d.msg || 'TikTok API error');
  return d.data.images?.length
    ? { type: 'images', urls: d.data.images }
    : { type: 'video',  url: d.data.play };
}

async function spotifyDown(url) {
  const id = url.match(/spotify\.com\/track\/([a-zA-Z0-9]+)/)?.[1];
  if (!id) throw new Error('Invalid Spotify URL — must be a track link');
  const { data } = await api.get(`https://api.spotifydown.com/download/${id}`, {
    headers: { origin: 'https://spotifydown.com', referer: 'https://spotifydown.com' },
  });
  if (!data.success) throw new Error(data.error || 'Spotify download failed');
  return { url: data.link, title: data.metadata?.title, artist: data.metadata?.artists };
}

async function faaApi(path, url) {
  const { data: d } = await api.get(`https://api-faa.my.id/faa/${path}?url=${encodeURIComponent(url)}`);
  if (!d.status) throw new Error(d.message || `${path} API error`);
  return d.result;
}

// ── Main handler ───────────────────────────────────────────────────────────────
export default {
  command: 'dl',
  alias: ['download', 'save'],
  description: 'Multi-platform downloader: TikTok, Instagram, Facebook, Twitter/X, Pinterest, Threads, SoundCloud, Spotify, YouTube, MediaFire',
  category: 'download',

  async execute({ sock, msg, jid, text, react, reply, prefix }) {
    let raw = text?.trim();
    if (!raw) {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (quoted) raw = (quoted.conversation || quoted.extendedTextMessage?.text || '').trim();
    }
    if (!raw) return reply(
      `*🔗 Universal Downloader*\n\n` +
      `*Platforms:* TikTok • Instagram • Facebook • Twitter/X • Pinterest • Threads • SoundCloud • Spotify • YouTube • MediaFire\n\n` +
      `*Usage:* ${prefix}dl <link>\n` +
      `💡 Or just reply to any message containing a link`
    );

    const detected = extract(raw);
    if (!detected) return reply('❌ No supported link found. Paste a direct URL from one of the supported platforms.');

    await react('⏳');

    try {
      const { type, url } = detected;

      // ── TikTok ──────────────────────────────────────────────────────────────
      if (type === 'tt') {
        let result;
        try {
          const c = await cobalt(url);
          if (c.status === 'stream' || c.status === 'tunnel') {
            await sock.sendMessage(jid, { video: { url: c.url }, mimetype: 'video/mp4', caption: '🎵 *TikTok via AA MD Bot*' }, { quoted: msg });
          } else if (c.status === 'picker') {
            for (const item of c.picker.slice(0, 4)) {
              await sock.sendMessage(jid, item.type === 'video'
                ? { video: { url: item.url }, mimetype: 'video/mp4' }
                : { image: { url: item.url } }, { quoted: msg });
            }
          } else throw new Error('cobalt no stream');
        } catch {
          result = await tikwm(url);
          if (result.type === 'video') {
            await sock.sendMessage(jid, { video: { url: result.url }, mimetype: 'video/mp4', caption: '🎵 *TikTok via AA MD Bot*' }, { quoted: msg });
          } else {
            for (const img of result.urls.slice(0, 5)) {
              await sock.sendMessage(jid, { image: { url: img } }, { quoted: msg });
            }
          }
        }
      }

      // ── Instagram ───────────────────────────────────────────────────────────
      else if (type === 'ig') {
        try {
          const c = await cobalt(url);
          if (c.status === 'stream' || c.status === 'tunnel') {
            const isVid = c.url?.includes('.mp4') || c.filename?.endsWith('.mp4');
            await sock.sendMessage(jid, isVid
              ? { video: { url: c.url }, mimetype: 'video/mp4', caption: '📸 *Instagram via AA MD Bot*' }
              : { image: { url: c.url }, caption: '📸 *Instagram via AA MD Bot*' }, { quoted: msg });
          } else if (c.status === 'picker') {
            for (const item of c.picker.slice(0, 5)) {
              await sock.sendMessage(jid, item.type === 'video'
                ? { video: { url: item.url }, mimetype: 'video/mp4' }
                : { image: { url: item.url } }, { quoted: msg });
            }
          } else throw new Error('cobalt no result');
        } catch {
          const r = await faaApi('igdl', url);
          for (const link of (r.url || []).slice(0, 4)) {
            await sock.sendMessage(jid, r.metadata?.isVideo
              ? { video: { url: link }, mimetype: 'video/mp4' }
              : { image: { url: link } }, { quoted: msg });
          }
        }
      }

      // ── Facebook ────────────────────────────────────────────────────────────
      else if (type === 'fb') {
        try {
          const c = await cobalt(url);
          if (c.status === 'stream' || c.status === 'tunnel') {
            await sock.sendMessage(jid, { video: { url: c.url }, mimetype: 'video/mp4', caption: '📘 *Facebook via AA MD Bot*' }, { quoted: msg });
          } else throw new Error('cobalt no stream');
        } catch {
          const r = await faaApi('fbdownload', url);
          const dlUrl = r.media?.video_hd || r.media?.video_sd || r.media?.photo_image;
          if (!dlUrl) throw new Error('No media found in this Facebook post');
          await sock.sendMessage(jid, r.media?.video_hd || r.media?.video_sd
            ? { video: { url: dlUrl }, mimetype: 'video/mp4', caption: '📘 *Facebook via AA MD Bot*' }
            : { image: { url: dlUrl } }, { quoted: msg });
        }
      }

      // ── Twitter / X ─────────────────────────────────────────────────────────
      else if (type === 'tw') {
        const c = await cobalt(url);
        if (c.status === 'stream' || c.status === 'tunnel') {
          await sock.sendMessage(jid, { video: { url: c.url }, mimetype: 'video/mp4', caption: '🐦 *Twitter/X via AA MD Bot*' }, { quoted: msg });
        } else if (c.status === 'picker') {
          for (const item of c.picker.slice(0, 4)) {
            await sock.sendMessage(jid, item.type === 'video'
              ? { video: { url: item.url }, mimetype: 'video/mp4' }
              : { image: { url: item.url } }, { quoted: msg });
          }
        } else throw new Error('Could not find downloadable media in this tweet');
      }

      // ── Threads ─────────────────────────────────────────────────────────────
      else if (type === 'th') {
        const c = await cobalt(url);
        if (c.status === 'stream' || c.status === 'tunnel') {
          await sock.sendMessage(jid, { video: { url: c.url }, mimetype: 'video/mp4', caption: '🧵 *Threads via AA MD Bot*' }, { quoted: msg });
        } else if (c.status === 'picker') {
          for (const item of c.picker.slice(0, 4)) {
            await sock.sendMessage(jid, item.type === 'video'
              ? { video: { url: item.url }, mimetype: 'video/mp4' }
              : { image: { url: item.url } }, { quoted: msg });
          }
        } else throw new Error('No media found in this Threads post');
      }

      // ── SoundCloud ──────────────────────────────────────────────────────────
      else if (type === 'sc') {
        const c = await cobalt(url);
        if (c.status === 'stream' || c.status === 'tunnel') {
          await sock.sendMessage(jid, { audio: { url: c.url }, mimetype: 'audio/mpeg', fileName: c.filename || 'soundcloud.mp3' }, { quoted: msg });
        } else throw new Error('SoundCloud download failed — try a public track link');
      }

      // ── Spotify ─────────────────────────────────────────────────────────────
      else if (type === 'sp') {
        const r = await spotifyDown(url);
        await sock.sendMessage(jid, {
          audio: { url: r.url },
          mimetype: 'audio/mpeg',
          fileName: r.title ? `${r.title} - ${r.artist}.mp3` : 'spotify.mp3',
          ptt: false,
        }, { quoted: msg });
      }

      // ── YouTube ─────────────────────────────────────────────────────────────
      else if (type === 'yt') {
        const c = await cobalt(url, { downloadMode: 'audio', audioFormat: 'mp3' });
        if (c.status === 'stream' || c.status === 'tunnel') {
          await sock.sendMessage(jid, { audio: { url: c.url }, mimetype: 'audio/mpeg', fileName: c.filename || 'youtube.mp3' }, { quoted: msg });
        } else throw new Error('YouTube download failed — use .play for music');
      }

      // ── MediaFire ───────────────────────────────────────────────────────────
      else if (type === 'mf') {
        const r = await faaApi('mediafire', url);
        await sock.sendMessage(jid, {
          document: { url: r.download_url },
          fileName: r.filename || 'mediafire-file',
          mimetype: 'application/octet-stream',
          caption: `📦 *MediaFire Download*\n📄 ${r.filename}\n💾 ${r.size || 'Unknown size'}`,
        }, { quoted: msg });
      }

      // ── Pinterest ────────────────────────────────────────────────────────────
      else if (type === 'pin') {
        const r = await faaApi('pin-down', url);
        const items = r.medias || [];
        const vid = items.find(m => m.type === 'video');
        const img = items.find(m => m.type === 'image');
        if (vid) await sock.sendMessage(jid, { video: { url: vid.url }, mimetype: 'video/mp4' }, { quoted: msg });
        else if (img) await sock.sendMessage(jid, { image: { url: img.url } }, { quoted: msg });
        else throw new Error('No media found in this Pinterest pin');
      }

      await react('✅');
    } catch (e) {
      console.error('[dl]', e.message);
      await react('❌');
      reply(`❌ *Download failed*\n\n${e.message}\n\n💡 Try the dedicated command:\n• *.tiktok* for TikTok\n• *.ig* for Instagram\n• *.spotify* for Spotify`);
    }
  },
};
