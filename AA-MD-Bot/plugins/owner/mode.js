// ============================================
// AA MD Bot - Bot Mode (per connected number)
// public = everyone, private = only self-chat
// ============================================

import { saveNow } from '../../lib/database.js';

export default {
  command: 'mode',
  alias: ['botmode'],
  description: 'Set bot mode for this number: public (everyone) or private (only You)',
  category: 'owner',
  ownerOnly: true,
  async execute({ args, reply, sessionSettings }) {
    const mode    = args[0]?.toLowerCase();
    const current = sessionSettings.eff('botMode', 'public');

    if (!mode || !['public', 'private'].includes(mode)) {
      return reply(
        `⚙️ *Bot Mode Settings*\n\n` +
        `Current mode: *${current.toUpperCase()}*\n` +
        `⚠️ *Per number:* Each connected number has its own mode.\n\n` +
        `📌 *Modes:*\n` +
        `• *.mode public*  — Everyone can use commands\n` +
        `• *.mode private* — Only You (self-chat) can use commands\n\n` +
        `💡 Private mode is great for personal use only.`
      );
    }

    sessionSettings.set('botMode', mode);
    await saveNow('sessionSettings');

    const emoji = mode === 'private' ? '🔒' : '🌐';
    const desc  = mode === 'private'
      ? 'Only your self-chat (You tab) on *this number* can now use bot commands.'
      : 'Everyone can now use bot commands on *this number*.';

    reply(`${emoji} *Bot Mode Changed!*\n\nMode: *${mode.toUpperCase()}*\n\n${desc}`);
  },
};
