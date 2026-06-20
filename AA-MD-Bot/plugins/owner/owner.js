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
    const ownerNum = (config.superOwner || config.ownerNumber?.[0] || '').replace(/\D/g, '');
    const waLink   = ownerNum ? `https://wa.me/${ownerNum}` : 'Not set';
    const waNum    = ownerNum ? `+${ownerNum}` : 'Not set';

    const text =
      `╔══════════════════════════╗\n` +
      `║  👑 *AA MD Bot — Owner*  ║\n` +
      `╚══════════════════════════╝\n\n` +
      `👤 *Name:* ${config.ownerName || config.developer}\n` +
      `🏢 *Brand:* ${config.brand}\n` +
      `📱 *Number:* ${waNum}\n` +
      `🔗 *WhatsApp:* ${waLink}\n` +
      `🤖 *Bot:* ${config.botName} v${config.version}\n\n` +
      `💬 _Contact for support, custom bots & features_\n\n` +
      `🌐 https://aa-mods.vercel.app/`;

    await reply(text);
  },
};
