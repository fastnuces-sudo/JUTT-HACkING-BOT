export default {
  command: 'antibot',
  alias: ['botprotect'],
  description: 'Toggle auto-kick of bots in group',
  category: 'group',
  groupOnly: true,
  adminOnly: true,
  async execute({ reply, jid, args, db }) {
    const group = db.groups.get(jid);
    const action = args[0]?.toLowerCase();
    if (action === 'on') {
      db.groups.set(jid, { antibot: true });
      return reply('🤖 Antibot is now *ON*. Bots will be kicked automatically.');
    }
    if (action === 'off') {
      db.groups.set(jid, { antibot: false });
      return reply('🤖 Antibot is now *OFF*.');
    }
    reply(`🤖 *Antibot Status:* ${group.antibot ? '✅ ON' : '❌ OFF'}\n\nUsage: .antibot on/off`);
  },
};
