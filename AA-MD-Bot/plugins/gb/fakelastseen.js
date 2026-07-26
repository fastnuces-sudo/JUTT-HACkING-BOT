// ============================================
// AA MD Bot - Fake Last Seen (GB Feature)
// Sets a custom daily "last seen" time by firing
// an unavailable presence at the scheduled moment.
// While active, composing/paused presence is suppressed
// so WhatsApp doesn't accidentally reset "online".
// ============================================

/**
 * Parse a time string into 24-h "HH:MM" format.
 * Accepts: "8:30pm", "8:30 PM", "20:30", "8pm", "8 am", "08:30"
 * Returns null if unparseable.
 */
function parseTime(raw) {
  if (!raw) return null;
  const s = raw.trim().toLowerCase().replace(/\s+/g, '');

  // Match patterns like "8:30pm", "8pm", "20:30", "8:30"
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?([ap]m)?$/);
  if (!m) return null;

  let h = parseInt(m[1], 10);
  const min = parseInt(m[2] || '0', 10);
  const ampm = m[3]; // 'am', 'pm', or undefined

  if (h < 0 || h > 23 || min < 0 || min > 59) return null;

  if (ampm === 'pm' && h !== 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  if (h > 23) return null;

  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Format "HH:MM" to 12-h display, e.g. "08:30" → "8:30 AM" */
function fmt12(hhmm) {
  const [hh, mm] = hhmm.split(':').map(Number);
  const ap = hh < 12 ? 'AM' : 'PM';
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${ap}`;
}

export default {
  command: 'fakelastseen',
  alias: ['fls', 'customlastseen', 'lastseen_fake'],
  category: 'gb',
  description: 'Set a custom daily "last seen" time — bot fires offline at that exact moment',
  usage: '.fakelastseen 8:30pm  |  .fls 20:30  |  .fls off  |  .fls status',

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
          `Set a custom time with:\n` +
          `▸ *.fls 8:30pm*\n` +
          `▸ *.fls 20:30*\n\n` +
          `> 🤖 *Powered by AA MD Bot*`
        );
      }
      return reply(
        `🕐 *Fake Last Seen*\n\n` +
        `Status: *ON* ✅\n` +
        `Scheduled time: *${fmt12(time)}* (${time})\n\n` +
        `Every day at this time, bot will fire offline so\nyour last seen shows *${fmt12(time)}*.\n\n` +
        `▸ *.fls off* — disable\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    }

    // ── Disable ───────────────────────────────────────────────────────
    if (input === 'off' || input === 'disable' || input === 'stop') {
      sessionSettings.set('fake_lastseen_active', false);
      sessionSettings.set('fake_lastseen_time', null);
      // Re-send an unavailable so WA records NOW as last seen (clean state)
      try { await sock.sendPresenceUpdate('unavailable'); } catch {}
      return reply(
        `🕐 *Fake Last Seen — OFF*\n\n` +
        `Bot will no longer suppress presence updates.\n` +
        `Your last seen is now controlled normally by WhatsApp.\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    }

    // ── Set time ──────────────────────────────────────────────────────
    const parsed = parseTime(input);
    if (!parsed) {
      return reply(
        `❌ *Invalid time format.*\n\n` +
        `Examples:\n` +
        `▸ *.fls 8:30pm*\n` +
        `▸ *.fls 8:30 AM*\n` +
        `▸ *.fls 20:30*\n` +
        `▸ *.fls 14:00*\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    }

    sessionSettings.set('fake_lastseen_active', true);
    sessionSettings.set('fake_lastseen_time', parsed);

    // Immediately suppress current online presence
    try { await sock.sendPresenceUpdate('unavailable'); } catch {}

    return reply(
      `🕐 *Fake Last Seen — ON* ✅\n\n` +
      `Every day at *${fmt12(parsed)}*, bot will silently\ngo offline so your last seen shows that time.\n\n` +
      `⚠️ *Important:*\n` +
      `• Make sure last seen privacy is set to\n  *contacts* or *all* (not *none*)\n` +
      `• While active, "typing..." indicator is hidden\n` +
      `• Disable with *.fls off*\n\n` +
      `> 🤖 *Powered by AA MD Bot*`
    );
  },
};
