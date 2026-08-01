import axios from 'axios';

const INSTANCES = [
  'https://inv.tux.pizza',
  'https://invidious.privacydev.net',
  'https://invidious.nerdvpn.de',
  'https://yt.cdaut.de',
  'https://iv.melmac.space',
  'https://invidious.fdn.fr',
];

async function apiGet(endpoint, params = {}) {
  for (const base of INSTANCES) {
    try {
      const res = await axios.get(`${base}/api/v1/${endpoint}`, {
        params, timeout: 12000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AA-MD-Bot/3.0)' },
      });
      if (res.data) return { data: res.data, instance: base };
    } catch {}
  }
  throw new Error('All Invidious instances unavailable');
}

export async function searchVideo(query, limit = 1) {
  const { data } = await apiGet('search', { q: query, type: 'video', page: 1 });
  return (data || []).slice(0, limit);
}

export async function getVideoInfo(videoId) {
  const { data, instance } = await apiGet(`videos/${videoId}`);
  return { ...data, _instance: instance };
}

export function getBestAudioUrl(info) {
  const formats = (info.adaptiveFormats || []).filter(f => f.type?.startsWith('audio/'));
  formats.sort((a, b) => parseInt(b.bitrate || 0) - parseInt(a.bitrate || 0));
  if (!formats.length) return null;
  let url = formats[0].url;
  if (!url.startsWith('http')) url = `${info._instance}${url}`;
  return url;
}

export function getBestVideoUrl(info, maxHeight = 480) {
  // formatStreams = muxed (audio+video in one file) — best for direct download
  const muxed = (info.formatStreams || [])
    .filter(f => f.type?.startsWith('video/') || f.container === 'mp4')
    .filter(f => {
      const h = parseInt((f.resolution || '0p').replace('p', ''));
      return h <= maxHeight;
    })
    .sort((a, b) => {
      const ha = parseInt((a.resolution || '0p').replace('p', ''));
      const hb = parseInt((b.resolution || '0p').replace('p', ''));
      return hb - ha;
    });

  if (!muxed.length) return null;
  let url = muxed[0].url;
  if (!url.startsWith('http')) url = `${info._instance}${url}`;
  return url;
}

export function formatViews(views) {
  if (!views) return '—';
  if (views >= 1e9) return (views / 1e9).toFixed(1) + 'B';
  if (views >= 1e6) return (views / 1e6).toFixed(1) + 'M';
  if (views >= 1e3) return (views / 1e3).toFixed(1) + 'K';
  return String(views);
}
