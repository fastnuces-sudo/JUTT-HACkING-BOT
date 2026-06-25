import { db } from '../../lib/database.js';

export default {
  command: 'anticall',
  alias: ['blockCall', 'callblock'],
  category: 'owner',
  description: 'Block/reject incoming calls + set custom reply message',
  ownerOnly: true,
  usage: '.anticall on | .anticall off | .anticall msg <your message>',

  async execute({ reply, args, text, db: dbArg }) {
    const database = dbArg || db;
    const toggle   = args[0]?.toLowerCase();
    const current  = database.settings.getValue('antiCall') ?? false;
    const currentMsg = database.settings.getValue('antiCallMsg') || '';

    // ── .anticall msg <text> — set custom reply ──────────────────
    if (toggle === 'msg') {
      const newMsg = args.slice(1).join(' ').trim()
                  || text?.replace(/^anticall\s+msg\s*/i, '').trim();
      if (!newMsg) {
        return reply(
          `📵 *Anti-Call Message*\n\n` +
          `Current message:\n_${currentMsg || '(default — not set)'}_ \n\n` +
          `Usage: *.anticall msg <your message>*\n` +
          `Example: *.anticall msg Bhai bot ha, call mat karo 😅*\n\n` +
          `To reset to default: *.anticall msgreset*`
        );
      }
      database.settings.setValue('antiCallMsg', newMsg);
      return reply(
        `✅ *Anti-Call Message Updated!*\n\n` +
        `📩 Callers will now receive:\n\n_${newMsg}_`
      );
    }

    // ── .anticall msgreset — clear custom message ────────────────
    if (toggle === 'msgreset') {
      database.settings.setValue('antiCallMsg', '');
      return reply(`🔄 Anti-call message reset to *default*.`);
    }

    // ── .anticall on/off ─────────────────────────────────────────
    if (!toggle || !['on', 'off'].includes(toggle)) {
      return reply(
        `📞 *Anti-Call* is currently *${current ? 'ON ✅' : 'OFF ❌'}*\n\n` +
        `When ON, the bot automatically rejects all incoming voice/video calls and sends a reply message to the caller.\n\n` +
        `*Commands:*\n` +
        `▸ *.anticall on*  — Enable (reject all calls)\n` +
        `▸ *.anticall off* — Disable\n` +
        `▸ *.anticall msg <text>* — Set custom reply for callers\n` +
        `▸ *.anticall msgreset* — Reset to default message\n\n` +
        `*Current reply:*\n_${currentMsg || '(default message)'}_ `
      );
    }

    const val = toggle === 'on';
    database.settings.setValue('antiCall', val);
    return reply(
      `📞 *Anti-Call* is now *${val ? 'ON ✅' : 'OFF ❌'}*\n\n` +
      (val
        ? `All incoming calls will be automatically rejected.\n📩 Reply message: _${currentMsg || 'default'}_\n\nChange reply: *.anticall msg <text>*`
        : `Incoming calls will ring normally now.`)
    );
  },
};
