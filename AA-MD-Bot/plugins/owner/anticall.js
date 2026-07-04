// ============================================
// AA MD Bot - Anti-Call (per connected number)
// Block/reject incoming calls + custom reply
// ============================================

export default {
  command: 'anticall',
  alias: ['blockCall', 'callblock'],
  category: 'owner',
  description: 'Block/reject incoming calls (per connected number)',
  ownerOnly: true,
  usage: '.anticall on | .anticall off | .anticall msg <your message>',

  async execute({ reply, args, text, sessionSettings }) {
    const toggle     = args[0]?.toLowerCase();
    const current    = sessionSettings.eff('antiCall', false);
    const currentMsg = sessionSettings.eff('antiCallMsg', '');

    // ── .anticall msg <text> — set custom reply ──────────────────
    if (toggle === 'msg') {
      const newMsg = args.slice(1).join(' ').trim()
                  || text?.replace(/^anticall\s+msg\s*/i, '').trim();
      if (!newMsg) {
        return reply(
          `📵 *Anti-Call Message*\n\n` +
          `Current message:\n_${currentMsg || '(default — not set)'}_ \n\n` +
          `Usage: *.anticall msg <your message>*\n` +
          `Example: *.anticall msg Sorry, this is a bot, please don't call 😅*\n\n` +
          `To reset to default: *.anticall msgreset*`
        );
      }
      sessionSettings.set('antiCallMsg', newMsg);
      return reply(
        `✅ *Anti-Call Message Updated!*\n\n` +
        `📩 Callers will now receive:\n\n_${newMsg}_`
      );
    }

    // ── .anticall msgreset — clear custom message ────────────────
    if (toggle === 'msgreset') {
      sessionSettings.set('antiCallMsg', '');
      return reply(`🔄 Anti-call message reset to *default* for this number.`);
    }

    // ── .anticall on/off ─────────────────────────────────────────
    if (!toggle || !['on', 'off'].includes(toggle)) {
      return reply(
        `📞 *Anti-Call* is currently *${current ? 'ON ✅' : 'OFF ❌'}*\n` +
        `⚠️ *Per number:* Only applies to this connected number.\n\n` +
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
    sessionSettings.set('antiCall', val);
    return reply(
      `📞 *Anti-Call* is now *${val ? 'ON ✅' : 'OFF ❌'}* for this number.\n\n` +
      (val
        ? `All incoming calls on this number will be automatically rejected.`
        : `Calls will no longer be auto-rejected on this number.`)
    );
  },
};
