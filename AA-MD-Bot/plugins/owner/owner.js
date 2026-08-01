// ============================================
// Jutts Bot - Owner Info Plugin
// Developer: Sajid Jutt | Jutts Mods
// ============================================

import config from '../../config.js';
import { db } from '../../lib/database.js';

export default {
  command: 'owner',
  alias: ['developer', 'dev', 'creator'],
  description: 'Show bot owner/developer info',
  category: 'owner',
  usage: '.owner',

  async execute({ reply, sock, jid, msg }) {
    const ownerNum = (db.settings.getValue('superOwner') || config.superOwner || config.ownerNumber?.[0] || '').replace(/\D/g, '');
    const waLink   = ownerNum ? `https://wa.me/${ownerNum}` : 'Not set';
    const waNum    = ownerNum ? `+${ownerNum}` : 'Not set';

    const text =
      `╔══════════════════════════╗\n` +
      `║  👑 *Jutts Bot — Owner*  ║\n` +
      `╚══════════════════════════╝\n\n` +
      `👤 *Name:* ${config.ownerName || config.developer}\n` +
      `🏢 *Brand:* ${config.brand}\n` +
      `📱 *Number:* ${waNum}\n` +
      `🔗 *WhatsApp:* ${waLink}\n` +
      `🤖 *Bot:* ${config.botName} v${config.version}\n\n` +
      `💬 _Contact for support, custom bots & features_\n\n` +
      `> 🤖 *Powered by Jutts Bot*  👨‍💻 *Sajid Jutt*`;

    await reply(text);
  },
};
