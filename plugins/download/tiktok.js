// ============================================
// AA MD Bot - TikTok Downloader
// Primary: tikwm.com (no watermark)
// Fallback: tiklydown.eu.org
// ============================================

import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP = path.join(__dirname, '../../temp');

const TT_RX = /https?:\/\/(www\.)?(vm\.|vt\.|m\.)?tiktok\.com\/[^\s]+/i;

// ── Method 1: tikwm.com — no watermark, supports videos + slideshows ─────────
async function tikwm(url) {
  const { data } = await axios.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    timeout: 25000,
  });
  if (data.code !== 0 || !data.data) throw new Error(data.msg || 'tikwm failed');
  return data.data;
}

// ── Method 2: tiklydown.eu.org ────────────────────────────────────────────────
async function tiklydown(url) {
  const { data } = await axios.get(
    `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`,
    {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
      timeout: 25000,
    }
  );
  if (!data?.videoUrl) throw new Error('tiklydown: no videoUrl');
  return {
    play:         data.videoUrl,
    images:       null,
    author:       { unique_id: data.author?.nickname || data.author?.name || 'unknown' },
    digg_count:   data.stats?.digg_count || 0,
    comment_count: data.stats?.comment_count || 0,
    share_count:   data.stats?.share_count || 0,
  };
}

// ── Download a video URL into a buffer (for safe WhatsApp delivery) ────────────
async function downloadVideoBuffer(videoUrl) {
  await fs.ensureDir(TEMP);
  const tmpFile = path.join(TEMP, `tt_${Date.now()}.mp4`);
  try {
    const res = await axios({
      method: 'get',
      url: videoUrl,
      responseType: 'arraybuffer',
      timeout: 60000,
      maxContentLength: 100 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer':    'https://www.tiktok.com/',
      },
    });
    const buf = Buffer.from(res.data);
    if (buf.length > 10000) return buf;
  } catch {}
  return null;
}

export default {
  command: 'tiktok',
  alias: ['tt', 'tiktokdl', 'tik', 'ttdl'],
  description: 'Download TikTok video or images (no watermark)',
  category: 'download',

  async execute({ text, msg, reply, react, sock, jid, prefix }) {
    let url = text?.trim();
    if (!url) {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (quoted) url = (quoted.conversation || quoted.extendedTextMessage?.text || '').trim();
    }
    const match = url?.match(TT_RX);
    if (!match) {
      return reply(
        `🎵 *TikTok Downloader*\n\n` +
        `*Usage:* ${prefix}tiktok <link>\n` +
        `*Example:* ${prefix}tiktok https://vm.tiktok.com/xxx\n\n` +
        `✅ No watermark • Videos & Slideshows\n\n> 🎵 *AA MD Bot*`
      );
    }

    await react('⏳');
    url = match[0].replace(/[.,!?;]$/, '');

    let d = null;
    let source = '';

    // Try tikwm first
    try {
      d = await tikwm(url);
      source = 'tikwm';
    } catch {}

    // Fallback: tiklydown
    if (!d) {
      try {
        d = await tiklydown(url);
        source = 'tiklydown';
      } catch {}
    }

    if (!d) {
      await react('❌');
      return reply(
        `❌ *TikTok download failed*\n\n` +
        `Both download sources are unavailable. The video may be private or restricted.\n\n` +
        `> 🎵 *AA MD Bot*`
      );
    }

    const caption =
      `🎵 *TikTok Download*\n\n` +
      `👤 *Author:* @${d.author?.unique_id || 'unknown'}\n` +
      `❤️ *Likes:* ${(d.digg_count || 0).toLocaleString()}\n` +
      `💬 *Comments:* ${(d.comment_count || 0).toLocaleString()}\n` +
      `🔁 *Shares:* ${(d.share_count || 0).toLocaleString()}\n\n` +
      `> 🎵 *AA MD Bot*`;

    try {
      if (d.images?.length) {
        // Slideshow: send each image
        for (const img of d.images.slice(0, 8)) {
          await sock.sendMessage(jid, { image: { url: img } }, { quoted: msg });
        }
        await sock.sendMessage(jid, { text: caption }, { quoted: msg });
      } else if (d.play) {
        // Download to buffer for reliable WhatsApp delivery
        const buf = await downloadVideoBuffer(d.play);
        if (buf) {
          await sock.sendMessage(jid, {
            video: buf, mimetype: 'video/mp4', caption,
          }, { quoted: msg });
        } else {
          // If buffer download fails, send as URL (may not always work)
          await sock.sendMessage(jid, {
            video: { url: d.play }, mimetype: 'video/mp4', caption,
          }, { quoted: msg });
        }
      } else {
        throw new Error('No video URL or images found');
      }
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ TikTok send failed: ${e.message}`);
    }
  },
};
