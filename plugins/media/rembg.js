// ============================================
// AA MD Bot - Background Remover
// Primary:  Nexray API (confirmed working, returns PNG)
// Fallback: Additional URL-based APIs
// Accepts: reply to image OR send image with caption
// ============================================

import axios from 'axios';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { uploadToCatbox } from '../../lib/imageUpload.js';

function getImageMsg(msg) {
  const ctx   = msg.message?.extendedTextMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;
  // quoted image or own image
  if (quoted?.imageMessage)         return { content: quoted,       quoted, ctx };
  if (msg.message?.imageMessage)    return { content: msg.message,  quoted: null, ctx: null };
  return null;
}

// ── API fallback chain ────────────────────────────────────────────────────────
async function removeBgFromUrl(imageUrl) {
  const apis = [
    // 1. Nexray — returns PNG
    async () => {
      const res = await axios.get(
        `https://api.nexray.eu.cc/tools/removebg?url=${encodeURIComponent(imageUrl)}`,
        { timeout: 45000, responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      const buf = Buffer.from(res.data);
      // Verify it's a real PNG (magic bytes 89 50 4E 47)
      if (buf.length > 5000 && buf[0] === 0x89 && buf[1] === 0x50) return buf;
      throw new Error('Not a valid PNG');
    },
    // 2. Keith API
    async () => {
      const res = await axios.get(
        `https://apis-keith.vercel.app/tools/removebg?url=${encodeURIComponent(imageUrl)}`,
        { timeout: 45000, responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      const buf = Buffer.from(res.data);
      if (buf.length > 5000 && (buf[0] === 0x89 || buf[0] === 0xff)) return buf;
      throw new Error('Not a valid image');
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
  command: 'rembg',
  alias: ['removebg', 'nobg', 'bgremove', 'transparent'],
  description: 'Remove image background using AI',
  category: 'media',

  async execute({ sock, jid, msg, reply, react }) {
    const found = getImageMsg(msg);
    if (!found) return reply(
      `✂️ *Background Remover*\n\n` +
      `*Reply* to an image or *send an image* with *.rembg* as caption.\n\n` +
      `AI removes the background and returns a transparent PNG.\n\n` +
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

      // Upload to Catbox to get a public URL (required by the APIs)
      await react('☁️');
      const imageUrl = await uploadToCatbox(buffer, 'rembg_input.jpg');

      // Remove background
      await react('🎨');
      const result = await removeBgFromUrl(imageUrl);

      if (!result) {
        await react('❌');
        return reply(
          `❌ *Background removal failed.*\n\n` +
          `The server may be busy. Please try again.\n\n` +
          `> 🤖 *AA MD Bot*`
        );
      }

      await sock.sendMessage(jid, {
        image: result,
        mimetype: 'image/png',
        caption:
          `✂️ *Background Removed!*\n\n` +
          `_💡 Use .sticker to convert to a sticker_\n\n` +
          `> 🤖 *AA MD Bot*`,
      }, { quoted: msg });
      await react('✅');

    } catch (err) {
      await react('❌');
      reply(`❌ *Error:* ${err.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
