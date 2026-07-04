import axios from 'axios';

const TT  = /(?<!\S)https?:\/\/(www\.)?(vm\.|vt\.|m\.)?tiktok\.com\/[^\s]+(?=\s|$)/gi;
const IG  = /https?:\/\/(www\.)?instagram\.com\/[^\s]+/gi;
const MF  = /(?<!\S)https?:\/\/(www\.)?mediafire\.com\/\S+(?=\s|$)/gi;
const PIN = /https?:\/\/(www\.)?(pinterest\.(com|fr|de|co\.uk|jp|ru|ca|it|com\.au|com\.mx|com\.br|es|pl)|pin\.it)\/[^\s]+/gi;
const FB  = /(?<!\S)https?:\/\/(www\.|m\.|web\.)?facebook\.com\/[^\s]+(?=\s|$)/gi;
const TW  = /(?<!\S)https?:\/\/(www\.)?(twitter\.com|x\.com)\/[^\s]+(?=\s|$)/gi;
const VD  = /https?:\/\/(www\.)?videy\.co\/[^\s]+/gi;
const TH  = /https?:\/\/(www\.)?threads\.(net|com)\/[^\s]+/gi;
const MG  = /https?:\/\/mega\.nz\/[^\s]+/gi;
const SC  = /(?<!\S)https?:\/\/(www\.|on\.)?soundcloud\.com\/[^\s]+(?=\s|$)/gi;
const SP  = /https?:\/\/open\.spotify\.com\/[^\s]+/gi;
const YT  = /https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[^\s]+/gi;
const SF  = /https?:\/\/sfile\.co\/[^\s]+/gi;

const clean = (m) => m?.[0]?.replace(/[.,!?]$/, '');

const ext = (txt) => {
  if (!txt) return null;
  let m;
  m = txt.match(TT);  if (m) return { type: 'tt',  url: clean(m) };
  m = txt.match(IG);  if (m && !clean(m).includes('/stories/')) return { type: 'ig', url: clean(m) };
  m = txt.match(PIN); if (m) return { type: 'pin', url: clean(m) };
  m = txt.match(FB);  if (m) { const u = clean(m); if (!u.includes('/login') && !u.includes('/dialog') && !u.includes('/plugins/')) return { type: 'fb', url: u }; }
  m = txt.match(TW);  if (m) return { type: 'tw',  url: clean(m) };
  m = txt.match(VD);  if (m) return { type: 'vd',  url: clean(m) };
  m = txt.match(TH);  if (m) return { type: 'th',  url: clean(m) };
  m = txt.match(MG);  if (m) return { type: 'mg',  url: clean(m) };
  m = txt.match(SC);  if (m) return { type: 'sc',  url: clean(m) };
  m = txt.match(SP);  if (m) return { type: 'sp',  url: clean(m) };
  m = txt.match(YT);  if (m) return { type: 'yt',  url: clean(m) };
  m = txt.match(SF);  if (m) return { type: 'sf',  url: clean(m) };
  m = txt.match(MF);  if (m) return { type: 'mf',  url: clean(m) };
  return null;
};

const api = axios.create({ timeout: 30000 });

const tt  = async (url) => { const { data: d } = await api.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}`); if (d.code !== 0 || !d.data) throw new Error(d.msg || 'TikTok API error'); return d.data.images?.length ? { type: 'image', data: d.data.images } : { type: 'video', data: d.data.play }; };
const ig  = async (url) => { const { data: d } = await api.get(`https://api-faa.my.id/faa/igdl?url=${encodeURIComponent(url)}`); if (!d.status || !d.result?.url) throw new Error(d.message || 'Instagram API error'); return { urls: d.result.url, isVideo: d.result.metadata?.isVideo }; };
const pin = async (url) => { const { data: d } = await api.get(`https://api-faa.my.id/faa/pin-down?url=${encodeURIComponent(url)}`); if (!d.status || !d.result?.medias) throw new Error(d.message || 'Pinterest API error'); return d.result.medias; };
const fb  = async (url) => { const { data: d } = await api.get(`https://api-faa.my.id/faa/fbdownload?url=${encodeURIComponent(url)}`); if (!d.status || !d.result?.media) throw new Error(d.message || 'Facebook API error'); return d.result.media; };
const tw  = async (url) => { const { data: d } = await api.get(`https://api.nexray.web.id/downloader/twitter?url=${encodeURIComponent(url)}`); if (!d.status || !d.result) throw new Error(d.message || 'Twitter/X API error'); return { type: d.result.type, data: d.result.download_url }; };
const vd  = async (url) => { const { data: d } = await api.get(`https://api.nexray.web.id/downloader/videy?url=${encodeURIComponent(url)}`); if (!d.status || !d.result) throw new Error(d.message || 'Videy API error'); return d.result; };
const mf  = async (url) => { const { data: d } = await api.get(`https://api-faa.my.id/faa/mediafire?url=${encodeURIComponent(url)}`); if (!d.status || !d.result) throw new Error(d.message || 'MediaFire API error'); return d.result; };
const th  = async (url) => { const { data: d } = await api.get(`https://api.nexray.web.id/downloader/threads?url=${encodeURIComponent(url)}`); if (!d.status || !d.result?.media) throw new Error(d.message || 'Threads API error'); return d.result.media; };
const mg  = async (url) => { const { data: d } = await api.get(`https://api.nexray.web.id/downloader/mega?url=${encodeURIComponent(url)}`); if (!d.status || !d.result) throw new Error(d.message || 'Mega API error'); return d.result; };
const sc  = async (url) => { const { data: d } = await api.get(`https://api.nexray.web.id/downloader/soundcloud?url=${encodeURIComponent(url)}`); if (!d.status || !d.result?.url) throw new Error(d.message || 'SoundCloud API error'); return d.result; };
const sp  = async (url) => { const { data: d } = await api.get(`https://api.nexray.web.id/downloader/spotify?url=${encodeURIComponent(url)}`); if (!d.status || !d.result?.url) throw new Error(d.message || 'Spotify API error'); return d.result; };
const yt  = async (url) => { const { data: d } = await api.get(`https://api.nexray.web.id/downloader/ytmp3?url=${encodeURIComponent(url)}`); if (!d.status || !d.result?.url) throw new Error(d.message || 'YouTube API error'); return d.result; };
const sf  = async (url) => { const { data: d } = await api.get(`https://api.nexray.web.id/downloader/sfile?url=${encodeURIComponent(url)}`); if (!d.status || !d.result?.url) throw new Error(d.message || 'Sfile API error'); return d.result; };

export default {
  command: 'dl',
  alias: ['download'],
  description: 'Multi-platform media downloader (TikTok, Instagram, Facebook, Twitter/X, Pinterest, Threads, Videy, Mega, SoundCloud, Spotify, YouTube, MediaFire, Sfile)',
  category: 'download',

  execute: async ({ sock, msg, jid, args, text, react, reply, prefix }) => {
    let raw = text?.trim();

    if (!raw) {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (quoted) raw = (quoted.conversation || quoted.extendedTextMessage?.text || '').trim();
    }

    if (!raw) {
      return reply(`*Universal Downloader*

*Supported Platforms:*
TikTok • Instagram • Pinterest • Facebook
Twitter/X • Threads • Videy • Mega
SoundCloud • Spotify • YouTube • Sfile
MediaFire

*Usage:* ${prefix}dl <url>
*Note:* Reply to a link also works`);
    }

    const url = ext(raw);
    if (!url) return reply('Invalid URL. Please provide a valid link from supported platforms.');

    await react('📥');

    try {
      switch (url.type) {
        case 'tt': {
          const r = await tt(url.url);
          if (r.type === 'video') {
            await sock.sendMessage(jid, { video: { url: r.data }, mimetype: 'video/mp4' }, { quoted: msg });
          } else if (r.type === 'image') {
            if (!r.data?.length) throw new Error('No image data found');
            for (const img of r.data) {
              await sock.sendMessage(jid, { image: { url: img } }, { quoted: msg });
            }
          }
          break;
        }

        case 'ig': {
          const { urls, isVideo } = await ig(url.url);
          if (!urls?.length) throw new Error('No media found');
          for (const link of urls) {
            if (isVideo) {
              await sock.sendMessage(jid, { video: { url: link }, mimetype: 'video/mp4' }, { quoted: msg });
            } else {
              await sock.sendMessage(jid, { image: { url: link } }, { quoted: msg });
            }
          }
          break;
        }

        case 'pin': {
          const meds = await pin(url.url);
          if (!meds?.length) throw new Error('No media found');
          const imgs = meds.filter(m => m.type === 'image');
          if (imgs.length > 0) {
            for (const img of imgs) await sock.sendMessage(jid, { image: { url: img.url } }, { quoted: msg });
          } else {
            const vid = meds.find(m => m.type === 'video');
            const gif = meds.find(m => m.type === 'gif');
            if (vid) {
              await sock.sendMessage(jid, { video: { url: vid.url }, mimetype: 'video/mp4' }, { quoted: msg });
            } else if (gif) {
              await sock.sendMessage(jid, { video: { url: gif.url }, gifPlayback: true }, { quoted: msg });
            }
          }
          break;
        }

        case 'fb': {
          const med = await fb(url.url);
          if (med.video_hd || med.video_sd) {
            await sock.sendMessage(jid, { video: { url: med.video_hd || med.video_sd }, mimetype: 'video/mp4' }, { quoted: msg });
          } else if (med.photo_image) {
            await sock.sendMessage(jid, { image: { url: med.photo_image } }, { quoted: msg });
          } else {
            throw new Error('No downloadable media found in this Facebook post');
          }
          break;
        }

        case 'tw': {
          const r = await tw(url.url);
          if (r.type === 'image') {
            if (!r.data?.length) throw new Error('No image data found');
            for (const img of r.data) await sock.sendMessage(jid, { image: { url: img.url } }, { quoted: msg });
          } else if (r.type === 'video') {
            if (!r.data?.length) throw new Error('No video data found');
            const vqs = r.data.filter(i => i.type === 'mp4');
            const best = vqs.find(v => v.resolusi === '768p') || vqs.find(v => v.resolusi === '640p') || vqs.find(v => v.resolusi === '426p') || vqs[0];
            if (best) {
              await sock.sendMessage(jid, { video: { url: best.url }, mimetype: 'video/mp4' }, { quoted: msg });
            } else {
              throw new Error('No video URL found');
            }
          }
          break;
        }

        case 'vd': {
          const vu = await vd(url.url);
          await sock.sendMessage(jid, { video: { url: vu }, mimetype: 'video/mp4' }, { quoted: msg });
          break;
        }

        case 'mf': {
          const r = await mf(url.url);
          await sock.sendMessage(jid, {
            document: { url: r.download_url },
            fileName: r.filename,
            mimetype: r.mime ? `application/${r.mime}` : 'application/octet-stream',
            caption: `*MediaFire Download*\n\n📄 *Filename:* ${r.filename}\n📦 *Size:* ${r.size}`,
          }, { quoted: msg });
          break;
        }

        case 'th': {
          const meds = await th(url.url);
          if (!meds?.length) throw new Error('No media found');
          const vids = meds.filter(m => m.thumbnail && m.thumbnail !== '-');
          const imgs = meds.filter(m => !m.thumbnail || m.thumbnail === '-');
          if (vids.length > 0) {
            await sock.sendMessage(jid, { video: { url: vids[0].url }, mimetype: 'video/mp4' }, { quoted: msg });
          } else if (imgs.length > 0) {
            for (const img of imgs) await sock.sendMessage(jid, { image: { url: img.url } }, { quoted: msg });
          }
          break;
        }

        case 'mg': {
          const r = await mg(url.url);
          const durl = Array.isArray(r.download_url) ? r.download_url[0] : r.download_url;
          await sock.sendMessage(jid, {
            document: { url: durl },
            fileName: r.filename,
            mimetype: r.mimetype || 'application/octet-stream',
            caption: `*Mega Download*\n\n📄 *Filename:* ${r.filename}\n📦 *Size:* ${r.filesize}`,
          }, { quoted: msg });
          break;
        }

        case 'sc': {
          const r = await sc(url.url);
          await sock.sendMessage(jid, {
            audio: { url: r.url },
            mimetype: 'audio/mpeg',
            fileName: r.fileName,
          }, { quoted: msg });
          break;
        }

        case 'sp': {
          const r = await sp(url.url);
          await sock.sendMessage(jid, {
            audio: { url: r.url },
            mimetype: 'audio/mpeg',
            fileName: `${r.title} - ${r.artist}.mp3`,
          }, { quoted: msg });
          break;
        }

        case 'yt': {
          const r = await yt(url.url);
          await sock.sendMessage(jid, {
            audio: { url: r.url },
            mimetype: 'audio/mpeg',
            fileName: `${r.title}.mp3`,
          }, { quoted: msg });
          break;
        }

        case 'sf': {
          const r = await sf(url.url);
          await sock.sendMessage(jid, {
            document: { url: r.url },
            fileName: r.file_name,
            mimetype: r.mimetype === '7ZIP' ? 'application/x-7z-compressed' : 'application/octet-stream',
            caption: `*Sfile Download*\n\n📄 *Filename:* ${r.file_name}\n📦 *Size:* ${r.size}`,
          }, { quoted: msg });
          break;
        }
      }

      await react('🍁');
    } catch (e) {
      console.error('[ Downloader ]', e.message);
      await react('❌');
      reply('❌ Download failed. Please try again in a few seconds.');
    }
  },
};
