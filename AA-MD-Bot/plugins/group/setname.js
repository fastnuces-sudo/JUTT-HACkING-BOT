export default {
  command: 'setname',
  alias: ['rename', 'groupname'],
  description: 'Set group name',
  category: 'group',
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, jid, reply, text }) {
    if (!text) return reply('❌ Usage: .setname [new name]');
    if (text.length > 25) return reply('❌ Group name max 25 characters');
    try {
      await sock.groupUpdateSubject(jid, text);
      reply(`✅ Group name changed to: *${text}*`);
    } catch (err) {
      reply('❌ Failed to change name. Please try again in a few seconds.');
    }
  },
};
