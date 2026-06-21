import { db } from '../../lib/database.js';

export default {
  command: 'anticall',
  alias: ['blockCall', 'callblock'],
  category: 'owner',
  description: 'Block/reject incoming calls automatically',
  ownerOnly: true,
  usage: '.anticall on | .anticall off',

  async execute({ reply, args, db: dbArg }) {
    const database = dbArg || db;
    const toggle   = args[0]?.toLowerCase();
    const current  = database.settings.getValue('antiCall') ?? false;

    if (!toggle || !['on', 'off'].includes(toggle)) {
      return reply(
        `📞 *Anti-Call*  is currently *${current ? 'ON ✅' : 'OFF ❌'}*\n\n` +
        `When ON, the bot automatically rejects all incoming voice/video calls.\n\n` +
        `Usage:\n` +
        `▸ *.anticall on*  — Enable (reject all calls)\n` +
        `▸ *.anticall off* — Disable`
      );
    }

    const val = toggle === 'on';
    database.settings.setValue('antiCall', val);
    return reply(
      `📞 *Anti-Call* is now *${val ? 'ON ✅' : 'OFF ❌'}*\n\n` +
      (val
        ? `All incoming calls will be automatically rejected.`
        : `Incoming calls will ring normally now.`)
    );
  },
};
