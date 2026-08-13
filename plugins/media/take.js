// ============================================
// AA MD Bot - Sticker Take (Change Pack Name)
// Reply to any sticker to rename its pack/author
// ============================================

import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { Sticker, StickerTypes } from '../../lib/sticker.js';
import config from '../../config.js';

export default {
  command: 'take',
  alias: ['repack', 'stickerpack', 'packname'],
  description: 'Reply to any sticker to add/change its pack name and author',
  category: 'media',

  async execute({ msg, reply, react, sock, jid, args, text }) {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted?.stickerMessage) {
      return reply(
        `🏷️ *Sticker Take*\n\n` +
        `*Usage:* Reply to a sticker with:\n` +
        `*.take <pack name> | <author>*\n\n` +
        `*Examples:*\n` +
        `• *.take My Pack | Jutts Mods*\n` +
        `• *.take Funny Stickers*\n\n` +
        `> 🏷️ *Jutts Bot*`
      );
    }

    const parts = text.split('|').map(s => s.trim());
    const packName = parts[0] || config.botName || 'Jutts Bot';
    const author   = parts[1] || config.ownerName || 'Jutts Mods';

    await react('⏳');

    try {
      const stream = await downloadContentFromMessage(quoted.stickerMessage, 'sticker');
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const stickerBuf = Buffer.concat(chunks);

      const sticker = new Sticker(stickerBuf, {
        pack:       packName,
        author:     author,
        type:       StickerTypes.FULL,
        quality:    80,
        background: 'transparent',
      });

      const out = await sticker.toBuffer();
      await sock.sendMessage(jid, { sticker: out }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ Take failed: ${e.message}`);
    }
  },
};
