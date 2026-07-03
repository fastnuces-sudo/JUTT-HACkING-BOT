// ============================================
// AA MD Bot - Auto Read (GB WhatsApp Feature)
// Per-number: each connected number has its own autoread setting
// ============================================

export default {
  command: 'autoread',
  alias: ['autoseen', 'readall', 'markread'],
  category: 'gb',
  description: 'Auto-mark all messages as read silently (per connected number)',
  usage: '.autoread on/off',
  ownerOnly: true,

  async execute({ reply, args, sessionSettings }) {
    const toggle  = args[0]?.toLowerCase();
    const current = sessionSettings.get('autoRead') ?? false;

    if (!toggle || !['on', 'off'].includes(toggle)) {
      return reply(
        `👁️ *Auto Read*\n` +
        `Status: *${current ? 'ON ✅' : 'OFF ❌'}*\n\n` +
        `*GB WhatsApp Feature* — Silently mark all msgs as read\n` +
        `⚠️ *Per number:* Only applies to this connected number.\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `▸ *.autoread on*  — Mark all incoming messages as read\n` +
        `▸ *.autoread off* — Stop auto-reading\n\n` +
        `📌 Blue ticks will appear on sender's side.\n` +
        `Combine with *.privacy bluetick off* to read without showing ticks.\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    }

    const val = toggle === 'on';
    sessionSettings.set('autoRead', val);
    return reply(
      `👁️ *Auto Read* is now *${val ? 'ON ✅' : 'OFF ❌'}*\n\n` +
      (val
        ? `All incoming messages on *this number* will be marked as read automatically.`
        : `Messages will only be marked read when you open them.`) +
      `\n\n> 🤖 *Powered by AA MD Bot*`
    );
  },
};
