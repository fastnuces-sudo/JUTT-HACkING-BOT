// ============================================
// Jutts Bot - Anti Delete Plugin
// Developer: Sajid Jutt | Jutts Mods
// Works in groups (per-group) and DM (global for owner)
// ============================================

import { saveNow } from '../../lib/database.js';

export default {
  command: 'antidelete',
  alias: ['antidel', 'nodeletion'],
  description: 'Re-send deleted messages (group or DM)',
  category: 'group',
  usage: '.antidelete on/off',

  async execute({ reply, jid, args, isOwner, isGroupMsg, db }) {
    const toggle = args[0]?.toLowerCase();

    const currentVal = isGroupMsg
      ? (db.groups.get(jid)?.antidelete ?? db.settings.getValue('antidelete') ?? false)
      : (db.settings.getValue('antidelete') ?? false);

    if (!toggle || !['on', 'off'].includes(toggle)) {
      return reply(
        `🗑️ *Anti Delete* is currently *${currentVal ? 'ON ✅' : 'OFF ❌'}*\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `*.antidelete on*  — Recover deleted messages\n` +
        `*.antidelete off* — Let deleted messages stay gone\n\n` +
        (isGroupMsg
          ? `📌 Applies to *this group only*`
          : `📌 From DM → applies *globally* to all groups & DMs`)
      );
    }

    const value = toggle === 'on';

    if (isGroupMsg) {
      const group = db.groups.get(jid) || {};
      db.groups.set(jid, { ...group, antidelete: value });
      await saveNow('groups');
      return reply(
        `🗑️ *Anti Delete* is now *${value ? 'ON ✅' : 'OFF ❌'}* for this group.\n` +
        (value ? 'Deleted messages will be re-sent automatically.' : 'Deleted messages will stay gone.')
      );
    }

    // DM — owner only for global setting
    if (!isOwner) {
      return reply('⚠️ Only the bot owner can set global anti-delete from DM.');
    }

    db.settings.setValue('antidelete', value);
    await saveNow('settings');
    return reply(
      `🗑️ *Anti Delete* globally set to *${value ? 'ON ✅' : 'OFF ❌'}*.\n` +
      (value
        ? 'Deleted messages will be recovered in ALL groups and DMs.'
        : 'Anti-delete disabled globally.')
    );
  },
};
