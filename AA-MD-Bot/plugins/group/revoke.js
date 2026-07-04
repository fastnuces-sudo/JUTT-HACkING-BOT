export default {
  command: 'revoke',
  alias: ['revokelink', 'resetlink'],
  description: 'Revoke and reset group invite link',
  category: 'group',
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, jid, reply }) {
    try {
      await sock.groupRevokeInvite(jid);
      const newCode = await sock.groupInviteCode(jid);
      reply(`✅ *Invite link revoked!*\n\n🔗 New link:\nhttps://chat.whatsapp.com/${newCode}`);
    } catch (err) {
      reply('❌ Failed to revoke. Please try again in a few seconds.');
    }
  },
};
