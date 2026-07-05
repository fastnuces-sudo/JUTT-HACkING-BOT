// ============================================
// AA MD Bot - View-Once Keyword Setter
// Developer: Ahsan Ali | AA Mods
// Set a secret keyword — reply to any view-once
// with that keyword and it reveals to "You" chat.
// ============================================

export default {
  command: 'voword',
  alias: ['vokeyword', 'vokey'],
  description: 'Set/remove the secret keyword for view-once reveal via reply',
  category: 'owner',
  ownerOnly: true,
  async execute({ args, reply, db }) {
    const current = db.settings.getValue('voKeyword') || null;

    if (!args[0]) {
      return reply(
        `👁️ *View-Once Keyword*\n\n` +
        `Current keyword: ${current ? `*${current}*` : '_not set_'}\n\n` +
        `📌 *How it works:*\n` +
        `Set a secret keyword. When someone sends you a view-once,\n` +
        `just *reply* to that message with your keyword — the bot\n` +
        `will immediately send the media to your *"You"* private chat.\n\n` +
        `✅ No msgId needed — just reply!\n\n` +
        `📋 *Usage:*\n` +
        `• *.voword show* — set keyword to "show"\n` +
        `• *.voword off* — remove the keyword\n\n` +
        `> 👁️ *AA MD Bot*`
      );
    }

    const kw = args[0].toLowerCase().trim();

    if (kw === 'off' || kw === 'remove' || kw === 'none') {
      settings.setValue('voKeyword', null);
      return reply(
        `✅ *View-Once keyword removed*\n\n` +
        `Reply-based reveal is now *OFF*.\n\n` +
        `> 👁️ *AA MD Bot*`
      );
    }

    settings.setValue('voKeyword', kw);
    return reply(
      `✅ *View-Once Keyword Set!*\n\n` +
      `Keyword: *${kw}*\n\n` +
      `📌 *How to use:*\n` +
      `When someone sends you a view-once photo/video,\n` +
      `just *reply* to their message with:\n` +
      `"*${kw}*"\n\n` +
      `The bot will instantly forward the media to your *"You"* chat. 🔓\n\n` +
      `> 👁️ *AA MD Bot*`
    );
  },
};
