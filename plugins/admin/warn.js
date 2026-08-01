export default {
  command: 'warn',
  alias: ['warning'],
  description: 'Warn a group member (3 warns = kick)',
  category: 'admin',
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, jid, msg, reply, db }) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!mentions.length) return reply('❌ Mention a user to warn.\nExample: .warn @user');
    const target = mentions[0];
    const group = db.groups.get(jid);
    if (!group.warnings) group.warnings = {};
    group.warnings[target] = (group.warnings[target] || 0) + 1;
    db.groups.set(jid, { warnings: group.warnings });
    const count = group.warnings[target];
    if (count >= 3) {
      await sock.groupParticipantsUpdate(jid, [target], 'remove').catch(() => {});
      reply(`⚠️ @${target.split('@')[0]} has been kicked after *3 warnings*!`, { mentions: [target] });
      group.warnings[target] = 0;
      db.groups.set(jid, { warnings: group.warnings });
    } else {
      reply(`⚠️ *Warning ${count}/3* for @${target.split('@')[0]}.\n\n${count === 2 ? '🚨 One more warning = kick!' : 'Next warning: 2/3'}`, { mentions: [target] });
    }
  },
};
