// ============================================
// AA MD Bot - Fake Last Seen (GB Feature)
//
// How it works:
//   WhatsApp records the moment you go "unavailable" as your last seen.
//   This feature suppresses all presence pings so you stay "offline",
//   then at your chosen time every day it fires one unavailable → WA
//   records that exact moment as your last seen.
//
// Persistence: stored in db.sessionSettings (Neon Postgres) — survives restarts.
// ============================================

/**
 * Parse a time string → 24-h "HH:MM".
 * Accepts: "8:30pm", "8:30 PM", "20:30", "8pm", "8 am", "08:30"
 * Returns null if unparseable.
 */
function parseTime(raw) {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().replace(/\s+/g, '');
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?([ap]m)?$/);
  if (!m) return null;

  let h   = parseInt(m[1], 10);
  const min  = parseInt(m[2] || '0', 10);
  const ampm = m[3];

  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  if (ampm === 'pm' && h !== 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  if (h > 23) return null;

  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** "HH:MM" → "8:30 PM" */
function fmt12(hhmm) {
  const [hh, mm] = hhmm.split(':').map(Number);
  const ap  = hh < 12 ? 'AM' : 'PM';
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ap}`;
}

/**
 * Returns whether the target HH:MM is still coming today or already passed.
 */
function nextFireLabel(hhmm) {
  const now  = new Date();
  const [th, tm] = hhmm.split(':').map(Number);
  const target   = new Date(now);
  target.setHours(th, tm, 0, 0);
  return target > now ? 'Today' : 'Tomorrow';
}

export default {
  command: 'fakelastseen',
  alias: ['fls', 'customlastseen', 'setlastseen'],
  category: 'gb',
  description: 'Set a custom daily "last seen" time. Setting survives bot restarts.',
  usage: '.fls 8:30pm  |  .fls 20:30  |  .fls off  |  .fls status',

  async execute({ reply, args, sock, sessionSettings }) {
    const input = args[0]?.toLowerCase();

    // ── Status ────────────────────────────────────────────────────────
    if (!input || input === 'status' || input === 'info') {
      const active = sessionSettings.eff('fake_lastseen_active', false);
      const time   = sessionSettings.eff('fake_lastseen_time', null);

      if (!active || !time) {
        return reply(
          `🕐 *Fake Last Seen*\n\n` +
          `Status: *OFF*\n\n` +
          `Set any time — the bot will go offline at that\nexact moment every day, and WhatsApp will record\nthat time as your last seen.\n\n` +
          `*Examples:*\n` +
          `▸ *.fls 8:30pm*\n` +
          `▸ *.fls 20:30*\n` +
          `▸ *.fls 14:00*\n\n` +
          `> 🤖 *Powered by AA MD Bot*`
        );
      }

      const nextFire = nextFireLabel(time);
      return reply(
        `🕐 *Fake Last Seen — ON* ✅\n\n` +
        `Scheduled time:  *${fmt12(time)}*\n` +
        `Next fire:       *${nextFire} at ${fmt12(time)}*\n\n` +
        `✔️ Saved to database — remains active even after\n   bot restarts. No need to set it again.\n\n` +
        `▸ *.fls off* — disable\n` +
        `▸ *.fls 10:00pm* — change time\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    }

    // ── Disable ───────────────────────────────────────────────────────
    if (input === 'off' || input === 'disable' || input === 'stop') {
      sessionSettings.set('fake_lastseen_active', false);
      sessionSettings.set('fake_lastseen_time', null);
      try { await sock.sendPresenceUpdate('unavailable'); } catch {}
      return reply(
        `🕐 *Fake Last Seen — OFF*\n\n` +
        `Setting removed. WhatsApp will now manage\nyour last seen normally.\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    }

    // ── Set time ──────────────────────────────────────────────────────
    const parsed = parseTime(input);
    if (!parsed) {
      return reply(
        `❌ *Invalid time format.*\n\n` +
        `Accepted formats:\n` +
        `▸ *.fls 8:30pm*\n` +
        `▸ *.fls 8:30 AM*\n` +
        `▸ *.fls 20:30*\n` +
        `▸ *.fls 14:00*\n` +
        `▸ *.fls 8pm*\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    }

    sessionSettings.set('fake_lastseen_active', true);
    sessionSettings.set('fake_lastseen_time', parsed);

    // Go offline immediately so the number is not showing as online
    try { await sock.sendPresenceUpdate('unavailable'); } catch {}

    const nextFire = nextFireLabel(parsed);

    return reply(
      `🕐 *Fake Last Seen — ON* ✅\n\n` +
      `Time set:   *${fmt12(parsed)}*\n` +
      `First fire: *${nextFire} at ${fmt12(parsed)}*\n\n` +
      `📌 *How it works:*\n` +
      `• Bot fires offline once a day at this exact time\n` +
      `• WhatsApp records that moment as your last seen\n` +
      `• Typing indicator is hidden while active\n` +
      `  (to prevent accidentally showing as online)\n` +
      `• Setting is saved to the database — active even\n` +
      `  after a bot restart, no need to set it again\n\n` +
      `⚠️ *Important:* Last seen privacy must be set to\n` +
      `*contacts* or *all*, not *none*.\n` +
      `Use: *.privacy lastseen contacts*\n\n` +
      `▸ *.fls off* — disable\n` +
      `▸ *.fls status* — check current setting\n\n` +
      `> 🤖 *Powered by AA MD Bot*`
    );
  },
};
