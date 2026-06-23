// ============================================
// AA MD Bot - Privacy Settings (GB WhatsApp Feature)
// Control last seen, profile pic, status, read receipts
// ============================================

export default {
  command: 'privacy',
  alias: ['privacyset', 'lastseen', 'readreceipt', 'bluetick'],
  category: 'gb',
  description: 'Control WhatsApp privacy settings',
  usage: '.privacy  |  .privacy lastseen none/contacts/all  |  .privacy bluetick on/off',

  async execute({ reply, args, sock, db, isOwner }) {
    const sub   = args[0]?.toLowerCase();
    const value = args[1]?.toLowerCase();

    // ── Show current settings ──────────────────────────────────────
    if (!sub) {
      const ls  = db.settings.getValue('privacy_lastseen')  || 'contacts';
      const pp  = db.settings.getValue('privacy_pp')        || 'contacts';
      const st  = db.settings.getValue('privacy_status')    || 'contacts';
      const bt  = db.settings.getValue('privacy_bluetick')  ?? true;
      return reply(
        `🔒 *Privacy Settings*\n\n` +
        `*GB WhatsApp Feature* — Full privacy control\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `👁 *Last Seen:*    \`${ls}\`\n` +
        `📸 *Profile Pic:*  \`${pp}\`\n` +
        `📊 *Status:*       \`${st}\`\n` +
        `✅ *Blue Ticks:*   \`${bt ? 'on' : 'off'}\`\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📌 *Commands:*\n` +
        `▸ *.privacy lastseen none/contacts/all*\n` +
        `▸ *.privacy pp none/contacts/all*\n` +
        `▸ *.privacy status none/contacts/all*\n` +
        `▸ *.privacy bluetick on/off*\n` +
        `▸ *.privacy lockdown* — Hide everything from everyone\n` +
        `▸ *.privacy public*   — Show everything to everyone\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    }

    // ── Lockdown preset ───────────────────────────────────────────
    if (sub === 'lockdown' || sub === 'hide' || sub === 'stealth') {
      db.settings.setValue('privacy_lastseen', 'none');
      db.settings.setValue('privacy_pp', 'none');
      db.settings.setValue('privacy_status', 'none');
      db.settings.setValue('privacy_bluetick', false);
      try {
        await sock.updateLastSeenPrivacy('none');
        await sock.updateProfilePicturePrivacy('none');
        await sock.updateStatusPrivacy('none');
        await sock.updateReadReceiptsPrivacy('none');
      } catch {}
      return reply(
        `🔒 *Lockdown Mode ON!*\n\n` +
        `• Last Seen: *Hidden*\n• Profile Pic: *Hidden*\n• Status: *Hidden*\n• Blue Ticks: *OFF*\n\n` +
        `Nobody can see any of your info.\n\n> 🤖 *Powered by AA MD Bot*`
      );
    }

    // ── Public preset ─────────────────────────────────────────────
    if (sub === 'public' || sub === 'open') {
      db.settings.setValue('privacy_lastseen', 'all');
      db.settings.setValue('privacy_pp', 'all');
      db.settings.setValue('privacy_status', 'all');
      db.settings.setValue('privacy_bluetick', true);
      try {
        await sock.updateLastSeenPrivacy('all');
        await sock.updateProfilePicturePrivacy('all');
        await sock.updateStatusPrivacy('all');
        await sock.updateReadReceiptsPrivacy('matched_last_seen');
      } catch {}
      return reply(
        `🌐 *Public Mode ON!*\n\n` +
        `• Last Seen: *Everyone*\n• Profile Pic: *Everyone*\n• Status: *Everyone*\n• Blue Ticks: *ON*\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    }

    // ── Blue tick / Read receipts ─────────────────────────────────
    if (sub === 'bluetick' || sub === 'readreceipt' || sub === 'rt') {
      if (!value || !['on', 'off'].includes(value)) {
        return reply(`❌ Usage: *.privacy bluetick on/off*`);
      }
      const val = value === 'on';
      db.settings.setValue('privacy_bluetick', val);
      try {
        await sock.updateReadReceiptsPrivacy(val ? 'matched_last_seen' : 'none');
      } catch {}
      return reply(
        `${val ? '✅' : '🚫'} *Blue Ticks* are now *${val ? 'ON' : 'OFF'}*\n\n` +
        (val ? `People can see when you read their messages.` : `People cannot see when you read their messages.`) +
        `\n\n> 🤖 *Powered by AA MD Bot*`
      );
    }

    // ── Last seen / PP / Status ───────────────────────────────────
    const allowed = ['none', 'contacts', 'contact_blacklist', 'all'];
    if (!value || !allowed.includes(value)) {
      return reply(`❌ Usage: *.privacy ${sub} none/contacts/all*`);
    }

    if (sub === 'lastseen' || sub === 'ls') {
      db.settings.setValue('privacy_lastseen', value);
      try { await sock.updateLastSeenPrivacy(value); } catch {}
      return reply(`👁 *Last Seen* set to: *${value}*\n\n> 🤖 *Powered by AA MD Bot*`);
    }

    if (sub === 'pp' || sub === 'profilepic' || sub === 'photo') {
      db.settings.setValue('privacy_pp', value);
      try { await sock.updateProfilePicturePrivacy(value); } catch {}
      return reply(`📸 *Profile Picture* visibility set to: *${value}*\n\n> 🤖 *Powered by AA MD Bot*`);
    }

    if (sub === 'status' || sub === 'about') {
      db.settings.setValue('privacy_status', value);
      try { await sock.updateStatusPrivacy(value); } catch {}
      return reply(`📊 *Status* visibility set to: *${value}*\n\n> 🤖 *Powered by AA MD Bot*`);
    }

    return reply(`❌ Unknown setting. Type *.privacy* to see all options.`);
  },
};
