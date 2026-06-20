// ============================================
// AA MD Bot - Owner Info Plugin
// Developer: Ahsan Ali | AA Mods
// ============================================

import config from '../../config.js';

export default {
  command: 'owner',
  alias: ['developer', 'dev', 'creator'],
  description: 'Show bot owner/developer info',
  category: 'owner',
  usage: '.owner',

  async execute({ reply, sock, jid, msg }) {
    const ownerNum = (config.ownerNumber?.[0] || '').replace(/\D/g, '');
    const waLink   = ownerNum ? `wa.me/${ownerNum}` : 'Not set';

    const text =
      `👑 *Bot Owner / Developer*\n\n` +
      `👤 *Name:* ${config.ownerName || config.developer}\n` +
      `🏢 *Brand:* ${config.brand}\n` +
      `📱 *WhatsApp:* ${waLink}\n` +
      `🤖 *Bot:* ${config.botName}\n` +
      `🔖 *Version:* ${config.version}\n\n` +
      `💬 Contact the owner for support, features, or custom bots!\n\n` +
      `🌐 ${config.channelLink || 'https://aa-mods.vercel.app/'}`;

    await sock.sendMessage(jid, {
      text,
      contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
      },
    }, { quoted: msg });
  },
};
