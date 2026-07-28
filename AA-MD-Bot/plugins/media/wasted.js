// AA MD Bot — Wasted Canvacord Effect
// Puts someone's DP in a GTA "wasted" sticker

import { Sticker, StickerTypes } from 'wa-sticker-formatter';

export default {
  command: 'wasted',
  alias: ['gtawasted'],
  description: 'Make a GTA wasted sticker from someone\'s DP (tag or reply)',
  category: 'media',

  async execute({ sock, msg, jid, react, reply, quoted, senderJid, config }) {
    await react('⌛');
    try {
      let canvacord = null;
      try { const cc = await import('canvacord'); canvacord = cc.default ?? cc; } catch {}
      if (!canvacord?.Canvacord?.wasted) throw new Error('canvacord not available on this server');

      const TAG = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const targetJid = quoted?.key?.participant || quoted?.key?.remoteJid || TAG[0] || senderJid;
      let img;
      try { img = await sock.profilePictureUrl(targetJid, 'image'); }
      catch { img = 'https://telegra.ph/file/9521e9ee2fdbd0d6f4f1c.jpg'; }

      const result = await canvacord.Canvacord.wasted(img);
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
      reply(`╭━━━ᕙ    ᖴᗴᗴ-᙭ᗰᗪツ    ᕗ━━━\n├━━━≫ ERROR ≪━━━\n├ \n├ ${e.message}\n╰━━━━━━━━━━━━━━━━ᕗ\n> ©𝖕𝖔𝖜𝖊𝖗𝖊𝖉 𝖇𝖞 𝕬𝕬 𝕸𝕯 𝕭𝖔𝖙`);
    }
  },
};
