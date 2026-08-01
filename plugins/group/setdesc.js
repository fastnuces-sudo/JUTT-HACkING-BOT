export default {
  command: 'setdesc',
  alias: ['setdescription', 'groupdesc'],
  description: 'Set group description',
  category: 'group',
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, jid, reply, text }) {
    if (!text) return reply('❌ Usage: .setdesc [description]');
    try {
      await sock.groupUpdateDescription(jid, text);
      reply(`✅ Group description updated!`);
    } catch (err) {
      reply('❌ Failed to update description. Please try again in a few seconds.');
    }
  },
};
