import { db } from '../../lib/database.js';

export default {
  command: 'dbstats',
  alias: ['database', 'dbinfo'],
  description: 'Show database statistics',
  category: 'tools',
  ownerOnly: true,
  superOwnerOnly: true,
  async execute({ reply, args }) {
    if (args[0] === 'reload') {
      await db.reload();
      return reply('✅ Database reloaded from Firebase.');
    }
    const users    = db.users.all();
    const groups   = db.groups.all();
    const settings = db.settings.get();
    const sessSets = db.sessionSettings.all();
    const userCount    = Object.keys(users).length;
    const groupCount   = Object.keys(groups).length;
    const bannedUsers  = Object.values(users).filter(u => u.banned).length;
    const topUsers     = Object.values(users).sort((a, b) => (b.xp || 0) - (a.xp || 0)).slice(0, 3);
    const sessCount    = Object.keys(sessSets).length;
    reply(
      `📊 *Database Statistics (Firebase)*\n\n` +
      `👤 Users: *${userCount}*\n` +
      `⛔ Banned: *${bannedUsers}*\n` +
      `👥 Groups: *${groupCount}*\n` +
      `📱 Sessions: *${sessCount}*\n` +
      `⚙️ Settings: *${Object.keys(settings).length}* keys\n\n` +
      `🏆 *Top Users by XP:*\n` +
      `${topUsers.map((u, i) => `${i + 1}. +${u.id?.split('@')[0] || u.id} — ${u.xp || 0} XP (Lv.${u.level || 1})`).join('\n') || 'No users yet'}\n\n` +
      `☁️ Storage: Firebase Realtime Database\n` +
      `Use: *.dbstats reload* to re-fetch from Firebase`
    );
  },
};
