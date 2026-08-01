// ============================================
// AA MD Bot - Auto React (per connected number)
// ============================================
import config from '../../config.js';

export default {
  command: 'autoreact',
  alias: ['atr', 'reactall', 'autoemoji'],
  category: 'owner',
  ownerOnly: true,
  description: 'Toggle auto-react emoji on every incoming message (per connected number)',
  usage: '.autoreact on/off | .autoreact emoji ❤️',

  async execute({ reply, args, sessionSettings }) {
    const sub      = args[0]?.toLowerCase();
    const current  = sessionSettings.eff('autoReact', false);
    const curEmoji = sessionSettings.eff('autoReactEmoji', config.autoReactEmoji ?? '❤️');

    if (!sub || (!['on', 'off', 'emoji'].includes(sub) && args.length === 0)) {
      return reply(
        `${curEmoji} *Auto React*\n\n` +
        `Status: *${current ? '✅ ON' : '❌ OFF'}*\n` +
        `Emoji: *${curEmoji}*\n` +
        `⚠️ *Per number:* Only applies to this connected number.\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `• *.autoreact on*      — React to every incoming message\n` +
        `• *.autoreact off*     — Stop auto-reacting\n` +
        `• *.autoreact emoji ❤️* — Change reaction emoji\n\n` +
        `💡 Bot will react to every message in DMs and groups on this number.`
      );
    }

    if (sub === 'emoji') {
      const emoji = args[1];
      if (!emoji) return reply(`😊 *Current emoji:* ${curEmoji}\n\nUsage: *.autoreact emoji ❤️*`);
      sessionSettings.set('autoReactEmoji', emoji);
      return reply(`${emoji} *Auto React emoji* set to *${emoji}* for this number.`);
    }

    const value = sub === 'on';
    sessionSettings.set('autoReact', value);

    return reply(
      `${curEmoji} *Auto React* is now *${value ? 'ON ✅' : 'OFF ❌'}* for this number.\n\n` +
      (value
        ? `Bot will react to every incoming message with ${curEmoji}`
        : `Auto-react disabled for this number.`)
    );
  },
};
