// AA MD Bot — Hitler Canvacord Effect
// Tags or replies to get a profile pic in a Hitler-themed image

import { Sticker, StickerTypes } from 'wa-sticker-formatter';

export default {
  command: 'hitler',
  alias: [],
  description: 'Put someone\'s DP on a Hitler image (tag or reply)',
  category: 'media',

  async execute({ sock, msg, jid, react, reply, quoted, senderJid, config }) {
    await react('⌛');
    try {
      let canvacord = null;
      try { const cc = await import('canvacord'); canvacord = cc.default ?? cc; } catch {}
      if (!canvacord?.Canvacord?.hitler) throw new Error('canvacord not available on this server');

      const TAG = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const targetJid = quoted?.key?.participant || quoted?.key?.remoteJid || TAG[0] || senderJid;
      let img;
      try { img = await sock.profilePictureUrl(targetJid, 'image'); }
      catch { img = 'https://telegra.ph/file/9521e9ee2fdbd0d6f4f1c.jpg'; }

      const result = await canvacord.Canvacord.hitler(img);
      const botName = config?.botName || 'AA MD Bot';
      await sock.sendMessage(jid, {
        image: result,
        caption:
          `😈 *Hitler Effect*\n\n> 🤖 *${botName}*`,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *Hitler effect failed.*\n${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
