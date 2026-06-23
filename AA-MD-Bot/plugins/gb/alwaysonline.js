// ============================================
// AA MD Bot - Always Online (GB WhatsApp Feature)
// Keep presence as "online" permanently
// ============================================

let _interval = null;

export default {
  command: 'alwaysonline',
  alias: ['onlinemode', 'keeponline', 'stayonline', 'ao'],
  category: 'gb',
  description: 'Always appear online on WhatsApp',
  usage: '.alwaysonline on/off',
  ownerOnly: true,

  async execute({ reply, args, sock, db }) {
    const toggle = args[0]?.toLowerCase();
    const current = db.settings.getValue('alwaysOnline') ?? false;

    if (!toggle || !['on', 'off'].includes(toggle)) {
      return reply(
        `🟢 *Always Online*\n` +
        `Status: *${current ? 'ON ✅' : 'OFF ❌'}*\n\n` +
        `*GB WhatsApp Feature* — Stay permanently online\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `▸ *.alwaysonline on*  — Always appear online\n` +
        `▸ *.alwaysonline off* — Normal online status\n\n` +
        `⚠️ Note: Ghost Mode & Always Online cannot be active together.\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    }

    const val = toggle === 'on';
    db.settings.setValue('alwaysOnline', val);

    if (val) {
      // Turn off ghost mode if it was on
      db.settings.setValue('ghostMode', false);
      // Start presence interval
      if (_interval) clearInterval(_interval);
      _interval = setInterval(async () => {
        try { await sock.sendPresenceUpdate('available'); } catch {}
      }, 10000);
      // Immediate update
      try { await sock.sendPresenceUpdate('available'); } catch {}
      return reply(
        `🟢 *Always Online* is now *ON ✅*\n\n` +
        `You will now appear *permanently online* to everyone.\n` +
        `Ghost Mode has been turned off.\n\n` +
        `Use *.alwaysonline off* to stop.\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    } else {
      if (_interval) { clearInterval(_interval); _interval = null; }
      try { await sock.sendPresenceUpdate('unavailable'); } catch {}
      return reply(
        `⚫ *Always Online* is now *OFF ❌*\n\n` +
        `Your online status is back to normal.\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    }
  },
};
