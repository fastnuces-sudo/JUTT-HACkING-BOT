// ============================================
// AA MD Bot - Delete All My Messages (.aj)
// Owner only — deletes every tracked sent
// message in the current chat for everyone.
// ============================================

import { popSentMessages, countSentMessages } from '../../lib/msgTracker.js';

const DELAY_MS = 350; // pause between deletions to avoid WA rate-limit

export default {
  command: 'aj',
  alias: ['clearme', 'delsent', 'deleteall', 'clearall'],
  description: 'Delete all your sent messages in this chat (for everyone)',
  category: 'owner',
  ownerOnly: true,

  async execute({ sock, jid, msg, reply, react, sessionId }) {
    const total = countSentMessages(sessionId, jid);

    if (total === 0) {
      return reply(
        `🗑️ *Delete My Messages*\n\n` +
        `No tracked messages found in this chat.\n\n` +
        `_Only messages sent after the bot started are tracked._\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    await react('🗑️');

    // Pop all tracked keys (clears the store for this chat immediately)
    const keys = popSentMessages(sessionId, jid);

    // Also include the .aj command message itself
    keys.push({ ...msg.key });

    let deleted = 0;
    let failed  = 0;

    for (const key of keys) {
      try {
        await sock.sendMessage(jid, { delete: key });
        deleted++;
        // Small delay — avoids WhatsApp rate-limit on bulk deletes
        await new Promise(r => setTimeout(r, DELAY_MS));
      } catch {
        failed++;
      }
    }

    // Send a summary only if something failed
    if (failed > 0) {
      await sock.sendMessage(jid, {
        text:
          `✅ *Done* — deleted *${deleted}* message${deleted !== 1 ? 's' : ''}.\n` +
          `⚠️ *${failed}* could not be deleted (too old or already gone).\n\n` +
          `> 🤖 *AA MD Bot*`,
      }).catch(() => {});
    }
  },
};
