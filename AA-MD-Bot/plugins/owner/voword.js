// ============================================
// AA MD Bot - View-Once Reveal Guide
// Developer: Ahsan Ali | AA Mods
// ============================================

export default {
  command: 'voword',
  alias: ['voemoji', 'voreveal', 'vguide'],
  description: 'View-once reveal guide & methods',
  category: 'owner',
  ownerOnly: true,
  async execute({ reply, prefix }) {
    return reply(
      `👁️ *View-Once Reveal — All Methods*\n\n` +

      `*Method 1 — Secret word:*\n` +
      `Reply to any view-once with the word\n` +
      `*asdf*\n` +
      `Bot silently sends media to your "You" chat.\n\n` +

      `*Method 2 — 4 Same Emojis:*\n` +
      `Reply to the view-once with 4 of the same emoji:\n` +
      `🔥🔥🔥🔥  or  👀👀👀👀  or  ❤️❤️❤️❤️\n` +
      `(Any 4 same emojis — even without replying, finds recent one)\n\n` +

      `*Method 3 — Natural-looking reply:*\n` +
      `Reply with *${prefix}good*  → sends "Good 👍" in chat + reveals silently\n` +
      `Reply with *${prefix}nice*  → sends "Nice! 👌" in chat + reveals silently\n` +
      `_(Sender never knows)_\n\n` +

      `*Method 4 — Direct command:*\n` +
      `Reply to view-once and type *${prefix}avv*\n\n` +

      `*Auto-reveal all:*\n` +
      `• *${prefix}antiviewonce on* — auto-save every view-once\n\n` +

      `*Toggle 4-emoji trigger:*\n` +
      `• *${prefix}any4sameemojis on/off*\n\n` +

      `> 👁️ *AA MD Bot*`
    );
  },
};
