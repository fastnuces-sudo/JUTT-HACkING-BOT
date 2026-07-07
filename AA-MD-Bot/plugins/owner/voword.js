// ============================================
// AA MD Bot - View-Once Emoji Reveal
// Developer: Ahsan Ali | AA Mods
// React to any view-once with 4 same emojis
// as a quoted reply → reveals in "You" chat
// ============================================

export default {
  command: 'voword',
  alias: ['voemoji', 'voreveal'],
  description: 'View-once emoji reveal info (reply with 4 same emojis to reveal)',
  category: 'owner',
  ownerOnly: true,
  async execute({ reply, prefix }) {
    return reply(
      `👁️ *View-Once Emoji Reveal*\n\n` +
      `*How it works:*\n` +
      `When someone sends you a view-once photo or video,\n` +
      `just *reply* to that message with *4 of the same emoji*\n` +
      `and the bot will instantly send the media to your *"You"* private chat.\n\n` +
      `*Examples:*\n` +
      `• Reply with: 🔥🔥🔥🔥\n` +
      `• Reply with: 👀👀👀👀\n` +
      `• Reply with: 😂😂😂😂\n` +
      `• Reply with: ❤️❤️❤️❤️\n` +
      `(Any 4 same emojis work!)\n\n` +
      `*Auto-reveal all view-once:*\n` +
      `• *${prefix}antiviewonce on* — reveal ALL view-once automatically\n` +
      `• *${prefix}antiviewonce off* — only reveal via emoji trigger\n\n` +
      `*Manual reveal:*\n` +
      `• *${prefix}avv* — reply to a view-once message with this command\n\n` +
      `> 👁️ *AA MD Bot*`
    );
  },
};
