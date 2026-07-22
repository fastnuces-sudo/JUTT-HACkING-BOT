export default {
  command: 'dmall',
  alias: ['msgall', 'dmeveryone'],
  description: 'Send a DM to all group members (owner only)',
  category: 'admin',
  groupOnly: true,
  ownerOnly: true,
  async execute({ sock, jid, reply, text }) {
    if (!text) return reply('❌ Usage: .dmall [message]');

    const meta    = await sock.groupMetadata(jid).catch(() => null);
    if (!meta) return reply('❌ Could not fetch group members.');

    const botId  = (sock.user?.id || '').replace(/:.*@/, '@');
    const norm   = id => id?.includes(':') ? id.split(':')[0] + '@s.whatsapp.net' : id;
    const toSend = meta.participants.filter(p => norm(p.id) !== norm(botId));

    await reply(`📨 *Sending DM to ${toSend.length} members…*`);

    let sent = 0, failed = 0;
    for (const p of toSend) {
      try {
        await sock.sendMessage(p.id, { text });
        sent++;
      } catch { failed++; }
      await new Promise(r => setTimeout(r, 500));
    }

    reply(`✅ *Done!*\n📨 Sent: ${sent}\n❌ Failed: ${failed}`);
  },
};
