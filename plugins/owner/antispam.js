import { db, saveNow } from '../../lib/database.js';

export default {
  command: 'antispam',
  alias: ['nospam', 'spamblock'],
  category: 'owner',
  description: 'Block users who spam commands too fast',
  ownerOnly: true,
  usage: '.antispam on | .antispam off',

  async execute({ reply, args, db: dbArg, config: cfgArg }) {
    const database = dbArg || db;
    const toggle   = args[0]?.toLowerCase();
    const current  = database.settings.getValue('antiSpam') ?? false;

    if (!toggle || !['on', 'off'].includes(toggle)) {
      return reply(
        `🛡️ *Anti-Spam* is currently *${current ? 'ON ✅' : 'OFF ❌'}*\n\n` +
        `When ON, users who send commands too fast are temporarily rate-limited.\n\n` +
        `Usage:\n` +
        `▸ *.antispam on*  — Enable rate limiting\n` +
        `▸ *.antispam off* — Disable`
      );
    }

    const val = toggle === 'on';
    database.settings.setValue('antiSpam', val);
    await saveNow('settings');
    return reply(
      `🛡️ *Anti-Spam* is now *${val ? 'ON ✅' : 'OFF ❌'}*\n\n` +
      (val
        ? `Users who spam commands will be temporarily blocked.`
        : `Rate limiting disabled — all users can use commands freely.`)
    );
  },
};
