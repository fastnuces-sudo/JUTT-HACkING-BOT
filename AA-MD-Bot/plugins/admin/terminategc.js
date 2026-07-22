export default {
  command: 'terminategc',
  alias: ['closegc', 'killgroup'],
  description: 'Kick all members and leave the group (owner only)',
  category: 'admin',
  groupOnly: true,
  ownerOnly: true,
  async execute({ sock, jid, msg, reply }) {
    try {
      const meta  = await sock.groupMetadata(jid);
      const botId = (sock.user?.id || '').replace(/:.*@/, '@');
      const norm  = id => id?.includes(':') ? id.split(':')[0] + '@s.whatsapp.net' : id;

      const toKick = meta.participants
        .map(p => p.id)
        .filter(id => norm(id) !== norm(botId));

      await reply(`⚠️ *Terminating group…*\nRemoving ${toKick.length} member(s) and leaving.\n_This cannot be undone._`);

      // Kick in batches of 5 to avoid rate-limit
      const BATCH = 5;
      for (let i = 0; i < toKick.length; i += BATCH) {
        await sock.groupParticipantsUpdate(jid, toKick.slice(i, i + BATCH), 'remove').catch(() => {});
        if (i + BATCH < toKick.length) await new Promise(r => setTimeout(r, 1500));
      }

      await sock.groupLeave(jid).catch(() => {});
    } catch (err) {
      reply(`❌ Failed: ${err.message}`);
    }
  },
};
