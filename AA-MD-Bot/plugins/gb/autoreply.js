// ============================================
// AA MD Bot - Auto Reply (GB WhatsApp Feature)
// Per-number: each connected number has its own auto-reply
// ============================================

export function getAutoReplyStore() { return new Map(); } // kept for compat

export default {
  command: 'autoreply',
  alias: ['autoresponse', 'busymode', 'busy', 'ar'],
  category: 'gb',
  description: 'Auto-reply to DMs with a custom message (per connected number)',
  usage: '.autoreply <message>  |  .autoreply off  |  .autoreply status',
  ownerOnly: true,

  async execute({ reply, args, sessionSettings }) {
    const sub = args[0]?.toLowerCase();

    if (sub === 'off' || sub === 'stop' || sub === 'disable') {
      sessionSettings.set('autoReply', null);
      return reply(`📵 *Auto-Reply disabled.*\n\nThis number will no longer send automatic responses.\n\n> 🤖 *Powered by AA MD Bot*`);
    }

    if (sub === 'status' || sub === 'info') {
      const msg = sessionSettings.get('autoReply');
      if (!msg) return reply(`📵 *Auto-Reply is OFF*\n\nUse *.autoreply <message>* to enable.\n\n> 🤖 *Powered by AA MD Bot*`);
      return reply(
        `✅ *Auto-Reply is ON*\n\n` +
        `💬 *Message:*\n"${msg}"\n\n` +
        `Use *.autoreply off* to disable.\n\n> 🤖 *Powered by AA MD Bot*`
      );
    }

    if (!args.length) {
      const current = sessionSettings.get('autoReply');
      return reply(
        `🤖 *Auto Reply*\n` +
        `Status: *${current ? 'ON ✅' : 'OFF ❌'}*\n\n` +
        `*GB WhatsApp Feature* — Auto-respond to incoming DMs\n` +
        `⚠️ *Per number:* Only this connected number will auto-reply.\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📌 *How to use:*\n` +
        `▸ *.autoreply I am busy, will reply later* — Set message & turn on\n` +
        `▸ *.autoreply off* — Disable auto-reply\n` +
        `▸ *.autoreply status* — Check current message\n\n` +
        `📝 *Example:*\n` +
        `_.autoreply Salam! Main abhi busy hoon, thodi der mein reply karta hoon_ 🙏\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    }

    const message = args.join(' ');
    sessionSettings.set('autoReply', message);

    return reply(
      `✅ *Auto-Reply enabled!*\n\n` +
      `💬 *Message set to:*\n"${message}"\n\n` +
      `Anyone who DMs *this number* will get this response automatically.\n` +
      `Other connected numbers are *not affected*.\n` +
      `Use *.autoreply off* to disable.\n\n` +
      `> 🤖 *Powered by AA MD Bot*`
    );
  },
};
