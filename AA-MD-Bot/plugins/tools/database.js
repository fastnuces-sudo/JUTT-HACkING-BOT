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
    const groups   = db.groups.all();
    const settings = db.settings.get();
    const sessSets = db.sessionSettings.all();
    const bdays    = db.birthdays.all();
    const groupCount = Object.keys(groups).length;
    const sessCount  = Object.keys(sessSets).length;
    const bdayCount  = Object.keys(bdays).length;
    reply(
      `📊 *Database Statistics*\n\n` +
      `👥 Groups: *${groupCount}*\n` +
      `📱 Sessions: *${sessCount}*\n` +
      `🎂 Birthdays: *${bdayCount}*\n` +
      `⚙️ Settings: *${Object.keys(settings).length}* keys\n\n` +
      `☁️ Storage: Firebase Realtime Database\n` +
      `Use: *.dbstats reload* to re-fetch from Firebase`
    );
  },
};
