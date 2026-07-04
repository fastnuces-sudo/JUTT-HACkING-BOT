// ============================================
// AA MD Bot - ViewOnce Keyword Reveal
// Developer: Ahsan Ali | AA Mods
// Set a secret keyword — reply to any view-once with it
// to instantly forward the revealed media to your private chat
// ============================================

export default {
  command: 'voword',
  alias: ['vokeyword', 'vokey'],
  category: 'owner',
  description: 'Set a secret keyword to auto-reveal view-once to your private chat',
  usage: '.voword <keyword>  |  .voword off',
  ownerOnly: true,

  async execute({ reply, react, args, db }) {
    const input = args[0]?.trim();

    if (!input) {
      const current = db.settings.getValue('voKeyword');
      return reply(
        `👁️ *ViewOnce Keyword Reveal*\n\n` +
        `Status: *${current ? `"${current}" ✅` : 'NOT SET ❌'}*\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📌 *How it works:*\n` +
        `▸ Set a secret keyword (e.g. "show")\n` +
        `▸ Whenever someone sends a view-once to any chat, the bot silently caches it\n` +
        `▸ Reply to that view-once message with your keyword\n` +
        `▸ Bot instantly forwards the revealed media to your private "You" chat\n\n` +
        `📌 *Commands:*\n` +
        `▸ *.voword show* — set "show" as keyword\n` +
        `▸ *.voword off* — disable keyword reveal\n\n` +
        `> 👁️ *AA MD Bot*`
      );
    }

    if (input.toLowerCase() === 'off') {
      db.settings.setValue('voKeyword', null);
      await react('✅');
      return reply(
        `👁️ *ViewOnce Keyword Reveal* is now *OFF ❌*\n\n` +
        `View-once media will no longer be auto-forwarded via keyword.\n\n` +
        `> 👁️ *AA MD Bot*`
      );
    }

    // Validate keyword — no spaces, not too long
    if (input.includes(' ')) {
      return reply(`❌ Keyword cannot contain spaces. Use a single word like: *.voword show*`);
    }
    if (input.length > 30) {
      return reply(`❌ Keyword too long (max 30 characters).`);
    }

    db.settings.setValue('voKeyword', input);
    await react('✅');
    return reply(
      `👁️ *ViewOnce Keyword Reveal* is now *ON ✅*\n\n` +
      `🔑 *Keyword:* \`${input}\`\n\n` +
      `📌 *How to use:*\n` +
      `▸ When someone sends a view-once in any chat\n` +
      `▸ Reply to it with: *${input}*\n` +
      `▸ Bot will instantly forward the revealed photo/video to your *"You" private chat*\n\n` +
      `💡 *Tip:* Make it something short and personal so others won't guess it.\n` +
      `💡 Keyword is *case-insensitive* — "SHOW" and "show" both work.\n\n` +
      `> 👁️ *AA MD Bot*`
    );
  },
};
