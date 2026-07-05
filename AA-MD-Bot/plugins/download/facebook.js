// ============================================
// AA MD Bot - Facebook Downloader
// cobalt.tools → faa API fallback
// ============================================

import axios from 'axios';

const api = axios.create({ timeout: 25000 });
const FB_RX = /https?:\/\/(www\.|m\.|web\.)?facebook\.com\/[^\s]+/i;

async function cobaltFB(url) {
  const { data } = await api.post('https://api.cobalt.tools/', { url, downloadMode: 'auto', filenameStyle: 'pretty' }, {
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    timeout: 20000,
  });
  return data;
}

async function faaFB(url) {
  const { data } = await api.get(`https://api-faa.my.id/faa/fbdownload?url=${encodeURIComponent(url)}`);
  if (!data.status) throw new Error(data.message || 'Facebook API error');
  return data.result;
}

export default {
  command: 'fb',
  alias: ['facebook', 'fbdl', 'fbvideo'],
  description: 'Download Facebook videos and photos',
  category: 'download',

  async execute({ text, msg, reply, react, sock, jid, prefix }) {
    let url = text?.trim();
    if (!url) {
      const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (q) url = (q.conversation || q.extendedTextMessage?.text || '').trim();
    }
    const match = url?.match(FB_RX);
    if (!match) return reply(
      `📘 *Facebook Downloader*\n\n` +
      `*Usage:* ${prefix}fb <link>\n` +
      `*Supports:* Videos • Photos\n\n` +
      `*Example:* ${prefix}fb https://www.facebook.com/watch?v=xxx\n\n` +
      `> 📘 *AA MD Bot*`
    );

    await react('⏳');
    url = match[0].replace(/[.,!?;]$/, '');

    try {
      const c = await cobaltFB(url);
      if (c.status === 'stream' || c.status === 'tunnel') {
        await sock.sendMessage(jid, { video: { url: c.url }, mimetype: 'video/mp4', caption: '📘 *Facebook via AA MD Bot*' }, { quoted: msg });
        await react('✅');
      } else throw new Error('cobalt no stream');
    } catch {
      try {
        const r = await faaFB(url);
        const media = r.media || r;
        const videoUrl = media.video_hd || media.video_sd;
        const imgUrl   = media.photo_image;
        if (videoUrl) {
          await sock.sendMessage(jid, { video: { url: videoUrl }, mimetype: 'video/mp4', caption: '📘 *Facebook via AA MD Bot*' }, { quoted: msg });
        } else if (imgUrl) {
          await sock.sendMessage(jid, { image: { url: imgUrl }, caption: '📘 *Facebook via AA MD Bot*' }, { quoted: msg });
        } else throw new Error('No media found in this Facebook post');
        await react('✅');
      } catch (e2) {
        await react('❌');
        reply(`❌ *Facebook download failed*\n\n${e2.message}\n\n💡 Make sure the post is public and not age-restricted.`);
      }
    }
  },
};
