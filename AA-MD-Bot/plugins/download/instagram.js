// ============================================
// AA MD Bot - Instagram Downloader
// Primary: cobalt.tools → fallback: faa API
// ============================================

import axios from 'axios';

const api = axios.create({ timeout: 25000 });
const IG_RX = /https?:\/\/(www\.)?instagram\.com\/[^\s]+/i;

async function cobaltIG(url) {
  const { data } = await api.post('https://api.cobalt.tools/', { url, downloadMode: 'auto', filenameStyle: 'pretty' }, {
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    timeout: 20000,
  });
  return data;
}

async function faaIG(url) {
  const { data } = await api.get(`https://api-faa.my.id/faa/igdl?url=${encodeURIComponent(url)}`);
  if (!data.status) throw new Error(data.message || 'Instagram API error');
  return data.result;
}

export default {
  command: 'ig',
  alias: ['insta', 'instagram', 'igdl', 'reel'],
  description: 'Download Instagram posts, reels, carousels',
  category: 'download',

  async execute({ text, msg, reply, react, sock, jid, prefix }) {
    let url = text?.trim();
    if (!url) {
      const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (q) url = (q.conversation || q.extendedTextMessage?.text || '').trim();
    }
    const match = url?.match(IG_RX);
    if (!match) return reply(
      `📸 *Instagram Downloader*\n\n` +
      `*Usage:* ${prefix}ig <link>\n` +
      `*Supports:* Posts • Reels • Carousels\n\n` +
      `*Example:* ${prefix}ig https://www.instagram.com/p/xxx\n\n` +
      `> 📸 *AA MD Bot*`
    );

    await react('⏳');
    url = match[0].replace(/[.,!?;]$/, '');

    try {
      const c = await cobaltIG(url);
      if (c.status === 'stream' || c.status === 'tunnel') {
        const isVid = c.url?.includes('.mp4') || c.filename?.endsWith('.mp4');
        await sock.sendMessage(jid, isVid
          ? { video: { url: c.url }, mimetype: 'video/mp4', caption: '📸 *Instagram via AA MD Bot*' }
          : { image: { url: c.url }, caption: '📸 *Instagram via AA MD Bot*' }, { quoted: msg });
        await react('✅');
      } else if (c.status === 'picker') {
        for (const item of c.picker.slice(0, 6)) {
          await sock.sendMessage(jid, item.type === 'video'
            ? { video: { url: item.url }, mimetype: 'video/mp4' }
            : { image: { url: item.url } }, { quoted: msg });
        }
        await react('✅');
      } else throw new Error('cobalt: ' + (c.error?.code || 'no result'));
    } catch {
      try {
        const r = await faaIG(url);
        const urls = r.url || [];
        if (!urls.length) throw new Error('No media found');
        for (const link of urls.slice(0, 6)) {
          await sock.sendMessage(jid, r.metadata?.isVideo
            ? { video: { url: link }, mimetype: 'video/mp4', caption: '📸 *Instagram via AA MD Bot*' }
            : { image: { url: link }, caption: '📸 *Instagram via AA MD Bot*' }, { quoted: msg });
        }
        await react('✅');
      } catch (e2) {
        await react('❌');
        reply(`❌ *Instagram download failed*\n\n${e2.message}\n\n💡 Make sure the post is public.`);
      }
    }
  },
};
