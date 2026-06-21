import { db } from '../../lib/database.js';
import config from '../../config.js';

export default {
  command: 'autoreact',
  alias: ['atr', 'reactall', 'autoemoji'],
  category: 'owner',
  ownerOnly: true,
  description: 'Toggle auto-react (emoji reaction on every incoming message)',
  usage: '.autoreact on/off | .autoreact emoji ❤️',

  async execute({ reply, args, db }) {
    const sub = args[0]?.toLowerCase();
    const current = db.settings.getValue('autoReact') ?? false;
    const curEmoji = db.settings.getValue('autoReactEmoji') ?? config.autoReactEmoji ?? '❤️';

    if (!sub || (!['on', 'off', 'emoji'].includes(sub) && args.length === 0)) {
      return reply(
        `${curEmoji} *Auto React*\n\n` +
        `Status: *${current ? '✅ ON' : '❌ OFF'}*\n` +
        `Emoji: *${curEmoji}*\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `• *.autoreact on*      — React to every incoming message\n` +
        `• *.autoreact off*     — Stop auto-reacting\n` +
        `• *.autoreact emoji ❤️* — Change reaction emoji\n\n` +
        `💡 Bot will react to every message in DMs and groups.`
      );
    }

    if (sub === 'emoji') {
      const emoji = args[1];
      if (!emoji) return reply(`😊 *Current emoji:* ${curEmoji}\n\nUsage: *.autoreact emoji ❤️*`);
      db.settings.setValue('autoReactEmoji', emoji);
      return reply(`${emoji} *Auto React emoji* set to *${emoji}*`);
    }

    const value = sub === 'on';
    db.settings.setValue('autoReact', value);

    return reply(
      `${curEmoji} *Auto React* is now *${value ? 'ON ✅' : 'OFF ❌'}*\n\n` +
      (value
        ? `Bot will react to every incoming message with ${curEmoji}`
        : `Auto-react disabled.`)
    );
  },
};
