// ============================================
// AA MD Bot - Ghost Mode (GB WhatsApp Feature)
// Appear offline while still receiving messages
// ============================================

export default {
  command: 'ghost',
  alias: ['ghostmode', 'invisible', 'offline'],
  category: 'gb',
  description: 'Appear offline while using bot (GB feature)',
  usage: '.ghost on/off',
  ownerOnly: true,

  async execute({ reply, args, sock, db, jid }) {
    const toggle = args[0]?.toLowerCase();
    const current = db.settings.getValue('ghostMode') ?? false;

    if (!toggle || !['on', 'off'].includes(toggle)) {
      return reply(
        `👻 *Ghost Mode*  —  *${current ? 'ON ✅' : 'OFF ❌'}*\n\n` +
        `*GB WhatsApp Feature*\n` +
        `When ON, bot appears offline even while active.\n` +
        `Your "last seen" and "online" status are hidden.\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `▸ *.ghost on*  — Go invisible\n` +
        `▸ *.ghost off* — Appear online normally\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    }

    const val = toggle === 'on';
    db.settings.setValue('ghostMode', val);

    // Immediately update presence
    try {
      if (val) {
        await sock.sendPresenceUpdate('unavailable', jid);
      } else {
        await sock.sendPresenceUpdate('available', jid);
      }
    } catch {}

    return reply(
      `👻 *Ghost Mode* is now *${val ? 'ON ✅' : 'OFF ❌'}*\n\n` +
      (val
        ? `You are now *invisible* 🕵️\nBot is active but appears offline to everyone.`
        : `You are now *visible* 👁️\nOnline status will show normally.`)
    );
  },
};
