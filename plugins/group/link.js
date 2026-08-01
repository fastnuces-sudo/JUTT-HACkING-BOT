export default {
  command: 'link',
  alias: ['invitelink', 'grouplink'],
  description: 'Get group invite link',
  category: 'group',
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, jid, reply }) {
    try {
      const code = await sock.groupInviteCode(jid);
      reply(`🔗 *Group Invite Link*\n\nhttps://chat.whatsapp.com/${code}\n\n⚠️ Share carefully!`);
    } catch (err) {
      reply('❌ Failed to get link. Please try again in a few seconds.');
    }
  },
};
