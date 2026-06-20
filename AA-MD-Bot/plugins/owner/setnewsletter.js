// ============================================
// AA MD Bot - Set Newsletter JID (Owner)
// Developer: Ahsan Ali | AA Mods
// Sets the WhatsApp Channel JID so every bot reply
// carries a real "View channel" button via
// forwardedNewsletterMessageInfo approach.
// ============================================

export default {
  command: 'setnewsletter',
  alias: ['setnewsletterjid', 'newsletterjid'],
  description: 'Set the WhatsApp Channel newsletter JID for the View Channel button',
  category: 'owner',
  ownerOnly: true,
  usage: '.setnewsletter <newsletter-jid@newsletter>',

  async execute({ reply, args }) {
    const jid = args[0]?.trim();

    if (!jid) {
      const current = global._AA_NEWSLETTER_JID || 'Not set';
      return reply(
        `📢 *Set Newsletter JID*\n\n` +
        `*Current JID:* \`${current}\`\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `This JID links every bot reply to the WhatsApp Channel with a real *"View channel"* button.\n\n` +
        `*How to get your newsletter JID:*\n` +
        `1. Open WhatsApp → your Channel\n` +
        `2. The JID format is: \`120363xxxxxxxxx@newsletter\`\n` +
        `3. Use *.setnewsletter 120363xxxxxxxxx@newsletter*\n\n` +
        `*Usage:* \`.setnewsletter 120363xxxxxxxxx@newsletter\``
      );
    }

    if (!jid.endsWith('@newsletter')) {
      return reply(
        `⚠️ Invalid newsletter JID format.\n\n` +
        `It must end with *@newsletter*\n` +
        `Example: \`.setnewsletter 120363xxxxxxxxx@newsletter\``
      );
    }

    global._AA_NEWSLETTER_JID  = jid;
    global._AA_NEWSLETTER_NAME = args[1] ? args.slice(1).join(' ') : 'AA MD Bot';

    return reply(
      `✅ *Newsletter JID Set!*\n\n` +
      `📢 *JID:* \`${jid}\`\n` +
      `🏷️ *Name:* ${global._AA_NEWSLETTER_NAME}\n\n` +
      `Every bot reply will now carry a real *"View channel"* button linking to your WhatsApp Channel.`
    );
  },
};
