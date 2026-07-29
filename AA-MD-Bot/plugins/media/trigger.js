// AA MD Bot — Trigger Canvacord Effect
// Puts someone's DP in an animated trigger sticker

import { Sticker, StickerTypes } from 'wa-sticker-formatter';

export default {
  command: 'trigger',
  alias: ['triggered'],
  description: 'Make a triggered sticker from someone\'s DP (tag or reply)',
  category: 'media',

  async execute({ sock, msg, jid, react, reply, quoted, senderJid, config }) {
    await react('⌛');
    try {
      let canvacord = null;
      try { const cc = await import('canvacord'); canvacord = cc.default ?? cc; } catch {}
      if (!canvacord?.Canvacord?.trigger) throw new Error('canvacord not available on this server');

      const TAG = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const targetJid = quoted?.key?.participant || quoted?.key?.remoteJid || TAG[0] || senderJid;
      let img;
      try { img = await sock.profilePictureUrl(targetJid, 'image'); }
      catch { img = 'https://telegra.ph/file/9521e9ee2fdbd0d6f4f1c.jpg'; }

      const result = await canvacord.Canvacord.trigger(img);
      const botName = config?.botName || 'AA MD Bot';
      const sticker = new Sticker(result, {
        pack: botName, author: 'AA Mods',
        type: StickerTypes.FULL,
        categories: ['🤩', '🎉'], quality: 75, background: 'transparent',
      });
      await sock.sendMessage(jid, { sticker: await sticker.toBuffer() }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *Trigger effect failed.*\n${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
