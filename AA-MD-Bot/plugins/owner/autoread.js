import { db } from '../../lib/database.js';

export default {
  command: 'autoread',
  alias: ['ar', 'readall', 'bluetick'],
  category: 'owner',
  ownerOnly: true,
  description: 'Toggle auto-read (blue ticks on all incoming messages)',
  usage: '.autoread on/off',

  async execute({ reply, args, db }) {
    const toggle = args[0]?.toLowerCase();
    const current = db.settings.getValue('autoRead') ?? true;

    if (!toggle || !['on', 'off'].includes(toggle)) {
      return reply(
        `👁️ *Auto Read (Blue Ticks)*\n\n` +
        `Status: *${current ? '✅ ON' : '❌ OFF'}*\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `• *.autoread on*  — Mark all incoming messages as read (blue ticks)\n` +
        `• *.autoread off* — Stop auto-reading messages\n\n` +
        `💡 When ON, bot reads every message instantly, so senders see blue ticks.`
      );
    }

    const value = toggle === 'on';
    db.settings.setValue('autoRead', value);

    return reply(
      `👁️ *Auto Read* is now *${value ? 'ON ✅' : 'OFF ❌'}*\n\n` +
      (value
        ? `All incoming messages will be marked as read (blue ticks) instantly.`
        : `Messages will no longer be auto-read. Ticks stay grey.`)
    );
  },
};
