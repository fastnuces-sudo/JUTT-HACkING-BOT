// ============================================
// AA MD Bot - TikTok Downloader
// No watermark via tikwm.com + cobalt fallback
// ============================================

import axios from 'axios';

const api = axios.create({ timeout: 25000 });

async function tikwm(url) {
  const { data: d } = await api.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}`);
  if (d.code !== 0 || !d.data) throw new Error(d.msg || 'TikTok fetch failed');
  return d.data;
}

async function cobaltTT(url) {
  const { data } = await api.post('https://api.cobalt.tools/', { url, downloadMode: 'auto', filenameStyle: 'pretty' }, {
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    timeout: 20000,
  });
  return data;
}

const TT_RX = /https?:\/\/(www\.)?(vm\.|vt\.|m\.)?tiktok\.com\/[^\s]+/i;

export default {
  command: 'tiktok',
  alias: ['tt', 'tiktokdl', 'tik'],
  description: 'Download TikTok video or images (no watermark)',
  category: 'download',

  async execute({ text, msg, reply, react, sock, jid, prefix }) {
    let url = text?.trim();
    if (!url) {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (quoted) url = (quoted.conversation || quoted.extendedTextMessage?.text || '').trim();
    }
    const match = url?.match(TT_RX);
    if (!match) return reply(
      `🎵 *TikTok Downloader*\n\n` +
      `*Usage:* ${prefix}tiktok <link>\n` +
      `*Example:* ${prefix}tiktok https://vm.tiktok.com/xxx\n\n` +
      `✅ No watermark • Videos & Slideshows\n\n> 🎵 *AA MD Bot*`
    );

    await react('⏳');
    url = match[0].replace(/[.,!?;]$/, '');

    try {
      const d = await tikwm(url);

      const caption =
        `🎵 *TikTok Download*\n\n` +
        `👤 *Author:* @${d.author?.unique_id || 'unknown'}\n` +
        `❤️ *Likes:* ${(d.digg_count || 0).toLocaleString()}\n` +
        `💬 *Comments:* ${(d.comment_count || 0).toLocaleString()}\n` +
        `🔁 *Shares:* ${(d.share_count || 0).toLocaleString()}\n\n` +
        `> 🎵 *AA MD Bot*`;

      if (d.images?.length) {
        // Slideshow
        for (const img of d.images.slice(0, 8)) {
          await sock.sendMessage(jid, { image: { url: img } }, { quoted: msg });
        }
        await sock.sendMessage(jid, { text: caption }, { quoted: msg });
      } else if (d.play) {
        await sock.sendMessage(jid, { video: { url: d.play }, mimetype: 'video/mp4', caption }, { quoted: msg });
      } else throw new Error('No video URL found');

      await react('✅');
    } catch {
      // Fallback to cobalt
      try {
        const c = await cobaltTT(url);
        if (c.status === 'stream' || c.status === 'tunnel') {
          await sock.sendMessage(jid, { video: { url: c.url }, mimetype: 'video/mp4', caption: '🎵 *TikTok via AA MD Bot*' }, { quoted: msg });
          await react('✅');
        } else if (c.status === 'picker') {
          for (const item of c.picker.slice(0, 6)) {
            await sock.sendMessage(jid, item.type === 'video'
              ? { video: { url: item.url }, mimetype: 'video/mp4' }
              : { image: { url: item.url } }, { quoted: msg });
          }
          await react('✅');
        } else throw new Error(c.error?.code || 'Unknown error');
      } catch (e2) {
        await react('❌');
        reply(`❌ TikTok download failed: ${e2.message}`);
      }
    }
  },
};
