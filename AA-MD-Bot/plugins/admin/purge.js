// ============================================
// AA MD Bot - Purge / Delete Messages
// Developer: Ahsan Ali | AA Mods
// ============================================

export default {
  command: 'purge',
  alias: ['clear', 'delmsg', 'deletemsg'],
  description: 'Delete a replied-to message (or multiple). Reply to target message.',
  category: 'admin',
  groupOnly: false,
  adminOnly: false,
  ownerOnly: true,

  async execute({ sock, msg, jid, args, reply, react }) {
    const ctxInfo = msg.message?.extendedTextMessage?.contextInfo
                 || msg.message?.imageMessage?.contextInfo
                 || msg.message?.videoMessage?.contextInfo;

    if (!ctxInfo?.stanzaId) {
      return reply(
        `⚠️ *Reply to a message to delete it.*\n\n` +
        `📋 *Usage:* Reply to a message and send *.purge*\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    await react('🗑️');

    const targetKey = {
      id: ctxInfo.stanzaId,
      remoteJid: jid,
      fromMe: false,
      participant: ctxInfo.participant || undefined,
    };

    try {
      await sock.sendMessage(jid, { delete: targetKey });
      await react('✅');
    } catch {
      return reply(`❌ *Could not delete that message.*\n\nThe bot must be admin in groups.\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
