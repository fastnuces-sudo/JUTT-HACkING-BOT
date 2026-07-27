// ============================================
// AA MD Bot - Remini AI Image Enhancer
// Primary:  davidcyriltech (confirmed working, returns JPEG)
// Fallback: princetechn remini
// Enhances blurry/low-res photos using AI
// ============================================

import axios from 'axios';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { uploadToCatbox } from '../../lib/imageUpload.js';

function getImageMsg(msg) {
  const ctx    = msg.message?.extendedTextMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;
  if (quoted?.imageMessage)       return { content: quoted,      quoted, ctx };
  if (msg.message?.imageMessage)  return { content: msg.message, quoted: null, ctx: null };
  return null;
}

// ── API fallback chain ────────────────────────────────────────────────────────
async function enhanceImage(imageUrl) {
  const apis = [
    // 1. davidcyriltech — confirmed working, returns raw JPEG bytes
    async () => {
      const res = await axios.get(
        `https://apis.davidcyriltech.my.id/remini?url=${encodeURIComponent(imageUrl)}`,
        {
          timeout: 60000,
          responseType: 'arraybuffer',
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }
      );
      const buf = Buffer.from(res.data);
      // Verify JPEG magic bytes (FF D8 FF)
      if (buf.length > 5000 && buf[0] === 0xff && buf[1] === 0xd8) return buf;
      throw new Error('Not a valid JPEG');
    },

    // 2. princetechn — returns JSON with result.image_url
    async () => {
      const res = await axios.get(
        `https://api.princetechn.com/api/tools/remini?apikey=prince_tech_api_azfsbshfb&url=${encodeURIComponent(imageUrl)}`,
        { timeout: 60000, headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      const imgUrl = res.data?.result?.image_url;
      if (!imgUrl) throw new Error('No image URL in response');
      const imgRes = await axios.get(imgUrl, {
        timeout: 30000,
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      const buf = Buffer.from(imgRes.data);
      if (buf.length > 5000) return buf;
      throw new Error('Downloaded image too small');
    },

    // 3. nexray remini (if they add support later)
    async () => {
      const res = await axios.get(
        `https://api.nexray.web.id/enhancer/remini?url=${encodeURIComponent(imageUrl)}`,
        { timeout: 60000, headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      const u = res.data?.result?.url || res.data?.url;
      if (!u) throw new Error('No URL');
      const imgRes = await axios.get(u, { timeout: 30000, responseType: 'arraybuffer' });
      const buf = Buffer.from(imgRes.data);
      if (buf.length > 5000) return buf;
      throw new Error('Too small');
    },
  ];

  for (const fn of apis) {
    try {
      const result = await fn();
      if (result) return result;
    } catch {}
  }
  return null;
}

export default {
  command: 'remini',
  alias: ['enhance', 'hd', 'hdimage', 'aienhance', 'unblur'],
  description: 'Enhance blurry/low-res photos with Remini AI',
  category: 'media',

  async execute({ sock, jid, msg, reply, react }) {
    const found = getImageMsg(msg);
    if (!found) return reply(
      `✨ *Remini AI Enhancer*\n\n` +
      `*Reply* to an image or *send an image* with *.remini* as caption.\n\n` +
      `AI sharpens blurry, low-res, or old photos.\n\n` +
      `*Aliases:* .enhance .hd .unblur\n\n` +
      `> 🤖 *AA MD Bot*`
    );

    await react('⏳');

    try {
      const { content, quoted, ctx } = found;
      const msgObj = quoted
        ? { message: content, key: { ...msg.key, id: ctx.stanzaId } }
        : msg;

      // Download image from WhatsApp
      const buffer = await downloadMediaMessage(
        msgObj, 'buffer', {},
        { reuploadRequest: sock.updateMediaMessage }
      );
      if (!buffer?.length) throw new Error('Image download failed');

      // Upload to Catbox to get a public URL
      await react('☁️');
      const imageUrl = await uploadToCatbox(buffer, 'remini_input.jpg');

      // Enhance
      await react('✨');
      const result = await enhanceImage(imageUrl);

      if (!result) {
        await react('❌');
        return reply(
          `❌ *Enhancement failed.*\n\n` +
          `The server may be busy or the image format isn't supported.\n` +
          `Try with a clear JPEG photo.\n\n` +
          `> 🤖 *AA MD Bot*`
        );
      }

      await sock.sendMessage(jid, {
        image: result,
        mimetype: 'image/jpeg',
        caption:
          `✨ *Image Enhanced!*\n\n` +
          `_Powered by Remini AI_\n\n` +
          `> 🤖 *AA MD Bot*`,
      }, { quoted: msg });
      await react('✅');

    } catch (err) {
      await react('❌');
      reply(`❌ *Error:* ${err.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
