// ============================================
// AA MD Bot - View-Once Emoji Reveal
// Developer: Ahsan Ali | AA Mods
// React to any view-once with 4 same emojis
// as a quoted reply → reveals in "You" chat
// ============================================

export default {
  command: 'voword',
  alias: ['voemoji', 'voreveal'],
  description: 'View-once reveal info',
  category: 'owner',
  ownerOnly: true,
  async execute({ reply, prefix }) {
    return reply(
      `👁️ *View-Once Reveal — How It Works*\n\n` +
      `*Method 1 — Secret word:*\n` +
      `Reply to any view-once message with the word\n` +
      `*asdf*\n` +
      `Bot will silently send the media to your "You" chat.\n\n` +
      `*Method 2 — Same emoji x4:*\n` +
      `Reply with 4 of the same emoji:\n` +
      `🔥🔥🔥🔥  or  👀👀👀👀  or  ❤️❤️❤️❤️\n` +
      `(Any 4 same emojis work)\n\n` +
      `*Method 3 — Command:*\n` +
      `Reply to the view-once and type *${prefix}avv*\n\n` +
      `*Auto-reveal all:*\n` +
      `• *${prefix}antiviewonce on* — auto-save every view-once\n\n` +
      `> 👁️ *AA MD Bot*`
    );
  },
};
