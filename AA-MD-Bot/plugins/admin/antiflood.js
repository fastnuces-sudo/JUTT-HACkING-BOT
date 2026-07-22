// In-memory flood tracker — { groupJid: { userJid: { count, resetAt } } }
export const floodTracker = new Map();

export default {
  command: 'antiflood',
  alias: ['floodcontrol'],
  description: 'Auto-kick members who spam messages',
  category: 'admin',
  groupOnly: true,
  adminOnly: true,
  async execute({ reply, jid, args, db }) {
    const group  = db.groups.get(jid);
    const action = args[0]?.toLowerCase();

    if (action === 'on') {
      const limit = parseInt(args[1]) || 7;
      db.groups.set(jid, { antiflood: true, antifloodLimit: limit });
      return reply(`🌊 *Anti-Flood is ON*\nMembers sending more than *${limit} messages in 10 seconds* will be kicked.`);
    }
    if (action === 'off') {
      db.groups.set(jid, { antiflood: false });
      return reply('🌊 *Anti-Flood is OFF*');
    }

    const limit = group.antifloodLimit || 7;
    reply(
      `🌊 *Anti-Flood Status:* ${group.antiflood ? `✅ ON (limit: ${limit} msgs/10s)` : '❌ OFF'}\n\n` +
      `Usage:\n.antiflood on [limit] — e.g. .antiflood on 5\n.antiflood off`
    );
  },
};
