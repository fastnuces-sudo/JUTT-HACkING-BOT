export default {
  command: 'tagall',
  alias: ['mentionall', 'everyone'],
  description: 'Tag all group members',
  category: 'admin',
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, jid, msg, reply, text }) {
    try {
      const groupMeta = await sock.groupMetadata(jid);
      const members = groupMeta.participants.map(p => p.id);
      const message = text || '📢 Attention everyone!';
      const mentionText = members.map(m => `@${m.split('@')[0]}`).join(' ');
      await sock.sendMessage(jid, {
        text: `${message}\n\n${mentionText}`,
        mentions: members,
      }, { quoted: msg });
    } catch (err) {
      reply('❌ Failed to tag everyone. Please try again in a few seconds.');
    }
  },
};
