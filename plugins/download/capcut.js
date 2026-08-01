// ============================================
// AA MD Bot - CapCut Downloader
// Strategy 1: ssstik.io API (no key needed)
// Strategy 2: link fallback message
// ============================================

import axios from 'axios';

const CAPCUT_RX = /https?:\/\/(www\.)?capcut\.com\/[^\s]+/i;

export default {
  command: 'capcut',
  alias: ['capcutdl', 'cc'],
  description: 'Download CapCut videos without watermark',
  category: 'download',

  async execute({ text, msg, reply, react, sock, jid, prefix }) {
    let url = text?.trim();
    if (!url) {
      const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (q) url = (q.conversation || q.extendedTextMessage?.text || '').trim();
    }
    const match = url?.match(CAPCUT_RX);
    if (!match) {
      return reply(
        `✂️ *CapCut Downloader*\n\n` +
        `*Usage:* ${prefix}capcut <link>\n` +
        `*Example:* ${prefix}capcut https://www.capcut.com/share/...\n\n` +
        `> ✂️ *AA MD Bot*`
      );
    }

    await react('⏳');
    url = match[0].replace(/[.,!?;]$/, '');

    try {
      // ssstik.io no-key endpoint (public, works for CapCut links)
      const formData = new URLSearchParams({
        id:     url,
        locale: 'en',
        tt:     String(Date.now()),
      });
      const res = await axios.post('https://ssstik.io/abc?url=dl', formData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent':   'Mozilla/5.0',
          'Referer':      'https://ssstik.io/',
        },
        timeout: 20000,
      });

      const html = res.data || '';
      const videoUrlMatch =
        html.match(/href="(https?:\/\/[^"]+\.mp4[^"]*)"/i) ||
        html.match(/href="(https?:\/\/[^"]+)"\s*[^>]*>\s*(?:Without|No)/i);

      const videoUrl = videoUrlMatch?.[1];
      if (!videoUrl) throw new Error('no video found in response');

      await sock.sendMessage(jid, {
        video:   { url: videoUrl },
        caption: `✂️ *CapCut Download*\n\n> 🤖 *AA MD Bot*`,
        mimetype: 'video/mp4',
      }, { quoted: msg });

      return react('✅');
    } catch {
      // Fallback: direct link approach
      try {
        const res2 = await axios.get(`https://www.capcut.com/api-common/share/link?link=${encodeURIComponent(url)}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 15000,
        });
        const d = res2.data;
        const videoUrl = d?.data?.video?.play_addr?.url_list?.[0];
        if (videoUrl) {
          await sock.sendMessage(jid, {
            video:   { url: videoUrl },
            caption: `✂️ *CapCut Download*\n\n> 🤖 *AA MD Bot*`,
            mimetype: 'video/mp4',
          }, { quoted: msg });
          return react('✅');
        }
      } catch {}

      await react('❌');
      return reply(
        `✂️ *CapCut Download*\n\n` +
        `Direct download unavailable. Use one of these free tools:\n\n` +
        `🔗 https://ssstik.io\n` +
        `🔗 https://capcutdownloader.io\n\n` +
        `_Paste your CapCut link there to download_\n\n` +
        `> ✂️ *AA MD Bot*`
      );
    }
  },
};
