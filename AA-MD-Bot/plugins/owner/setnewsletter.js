// ============================================
// AA MD Bot - Set Newsletter JID (Owner)
// Persists JID to db so it survives restarts.
// ============================================

import { db } from '../../lib/database.js';

export default {
  command: 'setnewsletter',
  alias: ['setnewsletterjid', 'newsletterjid'],
  description: 'Set WhatsApp Channel JID for View Channel button',
  category: 'owner',
  ownerOnly: true,
  superOwnerOnly: true,
  usage: '.setnewsletter <jid@newsletter> [Channel Name]',

  async execute({ reply, args }) {
    const jid = args[0]?.trim();

    if (!jid) {
      const current = global._AA_NEWSLETTER_JID || db.settings.getValue('newsletterJid') || 'Not set';
      return reply(
        `📢 *Newsletter JID Setup*\n\n` +
        `*Current JID:* \`${current}\`\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `*How to find your JID:*\n` +
        `1. Open WhatsApp → your Channel\n` +
        `2. Go to Channel Info → share link\n` +
        `3. Send: *.setnewsletter <jid@newsletter>*\n\n` +
        `JID format: \`120363xxxxxxxxx@newsletter\`\n\n` +
        `*Example:*\n` +
        `\`.setnewsletter 120363288818481660@newsletter AA MD Bot\``
      );
    }

    if (!jid.endsWith('@newsletter')) {
      return reply(
        `⚠️ Invalid JID format.\n\n` +
        `Must end with *@newsletter*\n` +
        `Example: \`120363288818481660@newsletter\``
      );
    }

    const name = args.length > 1 ? args.slice(1).join(' ') : 'AA MD Bot';

    global._AA_NEWSLETTER_JID  = jid;
    global._AA_NEWSLETTER_NAME = name;

    // Persist so it survives bot restarts
    db.settings.setValue('newsletterJid', jid);
    db.settings.setValue('newsletterName', name);

    return reply(
      `✅ *Newsletter JID Saved!*\n\n` +
      `📢 *JID:* \`${jid}\`\n` +
      `🏷️ *Name:* ${name}\n\n` +
      `Every bot reply now carries a real *"View Channel"* button. ✨\n` +
      `_This setting will persist after bot restarts._`
    );
  },
};
