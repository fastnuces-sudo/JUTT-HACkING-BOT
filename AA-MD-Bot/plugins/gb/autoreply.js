// ============================================
// AA MD Bot - Auto Reply (GB WhatsApp Feature)
// Auto-reply when busy / set custom message
// ============================================

// In-memory store for active auto-replies per session
const _store = new Map(); // jid → { message, count }

export function getAutoReplyStore() { return _store; }

export default {
  command: 'autoreply',
  alias: ['autoresponse', 'busymode', 'busy', 'ar'],
  category: 'gb',
  description: 'Auto-reply to DMs with a custom message',
  usage: '.autoreply <message>  |  .autoreply off  |  .autoreply status',
  ownerOnly: true,

  async execute({ reply, args, sock, jid, senderJid, db }) {
    const ownerNum = senderJid?.split('@')[0]?.split(':')[0];
    const sub = args[0]?.toLowerCase();

    if (sub === 'off' || sub === 'stop' || sub === 'disable') {
      db.settings.setValue('autoReply', null);
      _store.delete(ownerNum);
      return reply(`📵 *Auto-Reply disabled.*\n\nYou will no longer send automatic responses.\n\n> 🤖 *Powered by AA MD Bot*`);
    }

    if (sub === 'status' || sub === 'info') {
      const msg = db.settings.getValue('autoReply');
      const info = _store.get(ownerNum);
      if (!msg) return reply(`📵 *Auto-Reply is OFF*\n\nUse *.autoreply <message>* to enable.\n\n> 🤖 *Powered by AA MD Bot*`);
      return reply(
        `✅ *Auto-Reply is ON*\n\n` +
        `💬 *Message:*\n"${msg}"\n\n` +
        `📊 *Replied:* ${info?.count || 0} times\n\n` +
        `Use *.autoreply off* to disable.\n\n> 🤖 *Powered by AA MD Bot*`
      );
    }

    if (!args.length) {
      const current = db.settings.getValue('autoReply');
      return reply(
        `🤖 *Auto Reply*\n` +
        `Status: *${current ? 'ON ✅' : 'OFF ❌'}*\n\n` +
        `*GB WhatsApp Feature* — Auto-respond to incoming DMs\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📌 *How to use:*\n` +
        `▸ *.autoreply I am busy, will reply later* — Set message & turn on\n` +
        `▸ *.autoreply off* — Disable auto-reply\n` +
        `▸ *.autoreply status* — Check current message & stats\n\n` +
        `📝 *Example:*\n` +
        `_.autoreply Salam! Main abhi busy hoon, thodi der mein reply karta hoon_ 🙏\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    }

    const message = args.join(' ');
    db.settings.setValue('autoReply', message);
    if (!_store.has(ownerNum)) _store.set(ownerNum, { message, count: 0 });
    else _store.get(ownerNum).message = message;

    return reply(
      `✅ *Auto-Reply enabled!*\n\n` +
      `💬 *Message set to:*\n"${message}"\n\n` +
      `Anyone who DMs the bot will get this response automatically.\n` +
      `Use *.autoreply off* to disable.\n\n` +
      `> 🤖 *Powered by AA MD Bot*`
    );
  },
};
