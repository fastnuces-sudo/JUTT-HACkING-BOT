export default {
  command: 'demote',
  alias: ['removeadmin'],
  description: 'Demote a group admin to member',
  category: 'admin',
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, jid, msg, reply }) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!mentions.length) return reply('❌ Mention the admin to demote.\nExample: .demote @admin');
    try {
      await sock.groupParticipantsUpdate(jid, mentions, 'demote');
      const names = mentions.map(m => `@${m.split('@')[0]}`).join(', ');
      reply(`✅ ${names} has been demoted from admin.`, { mentions });
    } catch (err) {
      reply('❌ Failed to demote. Please try again in a few seconds.');
    }
  },
};
