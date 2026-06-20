export default {
  command: 'id',
  alias: ['jid', 'myid'],
  description: 'Get your WhatsApp JID / Group ID',
  category: 'utility',
  async execute({ reply, jid, senderJid, isGroupMsg, sock }) {
    if (isGroupMsg) {
      try {
        const meta = await sock.groupMetadata(jid);
        reply(`📋 *IDs*\n\n👥 *Group ID:* ${jid}\n👤 *Your ID:* ${senderJid}\n📛 *Group Name:* ${meta.subject}\n👑 *Owner:* ${meta.owner || 'Unknown'}`);
      } catch {
        reply(`📋 *Your ID:* ${senderJid}\n👥 *Group ID:* ${jid}`);
      }
    } else {
      reply(`📋 *Your WhatsApp JID:*\n\n\`${senderJid}\`\n\n📱 *Number:* +${senderJid.split('@')[0]}`);
    }
  },
};
