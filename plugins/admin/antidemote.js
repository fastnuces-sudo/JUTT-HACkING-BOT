export default {
  command: 'antidemote',
  alias: ['nodemote', 'protectadmin'],
  description: 'Kick anyone who demotes a group admin',
  category: 'admin',
  groupOnly: true,
  adminOnly: true,
  async execute({ reply, jid, args, db }) {
    const group  = db.groups.get(jid);
    const action = args[0]?.toLowerCase();

    if (action === 'on') {
      db.groups.set(jid, { antidemote: true });
      return reply('🛡️ *Anti-Demote is ON*\nAnyone who demotes a group admin will be kicked automatically.');
    }
    if (action === 'off') {
      db.groups.set(jid, { antidemote: false });
      return reply('🛡️ *Anti-Demote is OFF*');
    }
    reply(`🛡️ *Anti-Demote Status:* ${group.antidemote ? '✅ ON' : '❌ OFF'}\n\nUsage: .antidemote on/off`);
  },
};
