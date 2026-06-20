import { db } from '../../lib/database.js';

export default {
  command: 'mode',
  alias: ['botmode'],
  description: 'Set bot mode: public (everyone) or private (only You chat)',
  category: 'owner',
  ownerOnly: true,
  superOwnerOnly: true,
  async execute({ args, reply }) {
    const mode = args[0]?.toLowerCase();

    if (!mode || !['public', 'private'].includes(mode)) {
      const current = db.settings.getValue('botMode') || 'public';
      return reply(
        `⚙️ *Bot Mode Settings*\n\n` +
        `Current mode: *${current.toUpperCase()}*\n\n` +
        `📌 *Modes:*\n` +
        `• *.mode public* — Everyone can use commands\n` +
        `• *.mode private* — Only You (self-chat) can use commands\n\n` +
        `💡 Private mode is great for personal use only.`
      );
    }

    db.settings.setValue('botMode', mode);

    const emoji = mode === 'private' ? '🔒' : '🌐';
    const desc = mode === 'private'
      ? 'Only your self-chat (You tab) can now use bot commands.'
      : 'Everyone can now use bot commands.';

    reply(`${emoji} *Bot Mode Changed!*\n\nMode: *${mode.toUpperCase()}*\n\n${desc}`);
  },
};
