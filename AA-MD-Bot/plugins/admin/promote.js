export default {
  command: 'promote',
  alias: ['makeadmin'],
  description: 'Promote a member to group admin',
  category: 'admin',
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, jid, msg, reply }) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!mentions.length) return reply('❌ Mention the user to promote.\nExample: .promote @user');
    try {
      const groupMeta = await sock.groupMetadata(jid);
      const rawBotId = sock.user.id;
      const botId = rawBotId.includes(':') ? rawBotId.split(':')[0] + '@s.whatsapp.net' : rawBotId;
      const norm = id => id?.includes(':') ? id.split(':')[0] + '@s.whatsapp.net' : id;
      const botAdmin = groupMeta.participants.find(p => norm(p.id) === botId)?.admin;
      if (!botAdmin) return reply('❌ I need to be an admin to promote members.');
      await sock.groupParticipantsUpdate(jid, mentions, 'promote');
      const names = mentions.map(m => `@${m.split('@')[0]}`).join(', ');
      reply(`✅ ${names} has been promoted to admin! 👑`, { mentions });
    } catch (err) {
      reply('❌ Failed to promote. Please try again in a few seconds.');
    }
  },
};
