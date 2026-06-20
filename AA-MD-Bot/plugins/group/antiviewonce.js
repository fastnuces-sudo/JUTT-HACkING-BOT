// ============================================
// AA MD Bot - Anti View Once Plugin
// Developer: Ahsan Ali | AA Mods
// Works in groups (per-group) and DM (global for owner)
// ============================================

export default {
  command: 'antiviewonce',
  alias: ['antiview', 'noviewonce'],
  description: 'Reveal view-once media automatically (group or DM)',
  category: 'group',
  usage: '.antiviewonce on/off',

  async execute({ reply, jid, args, isOwner, isGroupMsg, db }) {
    const toggle = args[0]?.toLowerCase();

    // Get current state
    const currentVal = isGroupMsg
      ? (db.groups.get(jid)?.antiviewonce ?? db.settings.getValue('antiviewonce') ?? false)
      : (db.settings.getValue('antiviewonce') ?? false);

    if (!toggle || !['on', 'off'].includes(toggle)) {
      return reply(
        `👁️ *Anti View-Once* is currently *${currentVal ? 'ON ✅' : 'OFF ❌'}*\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `*.antiviewonce on*  — Reveal view-once media automatically\n` +
        `*.antiviewonce off* — Keep view-once media hidden\n\n` +
        (isGroupMsg
          ? `📌 Applies to *this group only*`
          : `📌 From DM → applies *globally* to all groups & DMs`)
      );
    }

    const value = toggle === 'on';

    if (isGroupMsg) {
      const group = db.groups.get(jid) || {};
      db.groups.set(jid, { ...group, antiviewonce: value });
      return reply(
        `👁️ *Anti View-Once* is now *${value ? 'ON ✅' : 'OFF ❌'}* for this group.\n` +
        (value ? 'View-once media will be revealed automatically in this group.' : 'View-once media will stay hidden.')
      );
    }

    // DM — owner only for global setting
    if (!isOwner) {
      return reply('⚠️ Only the bot owner can set global anti-view-once from DM.');
    }

    db.settings.setValue('antiviewonce', value);
    return reply(
      `👁️ *Anti View-Once* globally set to *${value ? 'ON ✅' : 'OFF ❌'}*.\n` +
      (value
        ? 'View-once media will be revealed automatically in ALL groups and DMs.'
        : 'Anti-view-once disabled globally.')
    );
  },
};
