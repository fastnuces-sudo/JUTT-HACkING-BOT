// ============================================
// AA MD Bot - Ghost Mode (GB WhatsApp Feature)
// Per-number: each connected number has its own ghost mode
// ============================================

export default {
  command: 'ghost',
  alias: ['ghostmode', 'invisible', 'offline'],
  category: 'gb',
  description: 'Appear offline while using bot (per connected number)',
  usage: '.ghost on/off',
  ownerOnly: true,

  async execute({ reply, args, sock, jid, sessionId, sessionSettings }) {
    const toggle  = args[0]?.toLowerCase();
    const current = sessionSettings.get('ghostMode') ?? false;

    if (!toggle || !['on', 'off'].includes(toggle)) {
      return reply(
        `👻 *Ghost Mode*  —  *${current ? 'ON ✅' : 'OFF ❌'}*\n\n` +
        `*GB WhatsApp Feature*\n` +
        `When ON, this number appears offline even while active.\n` +
        `⚠️ *Per number:* Only applies to this connected number.\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `▸ *.ghost on*  — Go invisible\n` +
        `▸ *.ghost off* — Appear online normally\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    }

    const val = toggle === 'on';
    sessionSettings.set('ghostMode', val);

    if (val) {
      // Stop always-online interval for this session if running
      sessionSettings.set('alwaysOnline', false);
      try {
        const { stopAlwaysOnline } = await import('./alwaysonline.js');
        stopAlwaysOnline(sessionId);
      } catch {}
    }

    try {
      await sock.sendPresenceUpdate(val ? 'unavailable' : 'available', jid);
    } catch {}

    return reply(
      `👻 *Ghost Mode* is now *${val ? 'ON ✅' : 'OFF ❌'}*\n\n` +
      (val
        ? `This number is now *invisible* 🕵️\nActive but appears offline to everyone.\nAlways Online has been stopped.`
        : `This number is now *visible* 👁️\nOnline status will show normally.`)
    );
  },
};
