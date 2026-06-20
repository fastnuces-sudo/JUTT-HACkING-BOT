export default {
  command: 'antilink',
  alias: ['antilnk'],
  description: 'Toggle antilink in group',
  category: 'admin',
  groupOnly: true,
  adminOnly: true,
  async execute({ reply, jid, args, db }) {
    const group = db.groups.get(jid);
    const action = args[0]?.toLowerCase();
    if (action === 'on') {
      db.groups.set(jid, { antilink: true });
      reply('🔗 Antilink is now *ON*. Links will be deleted and sender warned.');
    } else if (action === 'off') {
      db.groups.set(jid, { antilink: false });
      reply('🔗 Antilink is now *OFF*.');
    } else {
      reply(`🔗 *Antilink Status:* ${group.antilink ? '✅ ON' : '❌ OFF'}\n\nUsage: .antilink on/off`);
    }
  },
};
