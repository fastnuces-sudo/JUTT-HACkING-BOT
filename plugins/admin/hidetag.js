export default {
  command: 'hidetag',
  alias: ['htag', 'stag', 'silenttag'],
  description: 'Tag all group members silently — they get notified but not visibly mentioned',
  category: 'admin',
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, jid, msg, reply, text }) {
    try {
      const meta = await sock.groupMetadata(jid);
      const members = meta.participants.map(p => p.id);
      const message = text || '📢 Message from admin';
      await sock.sendMessage(jid, { text: message, mentions: members }, { quoted: msg });
    } catch {
      reply('❌ Failed to send hidetag message.');
    }
  },
};
