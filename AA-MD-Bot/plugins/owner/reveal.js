// ============================================
// AA MD Bot - View-Once Reveal Plugin
// Developer: Ahsan Ali | AA Mods
// Reveal a captured view-once by replying to
// the original message, or by passing a msgId.
// Works with both in-memory store and disk index.
// ============================================

import { viewOnceStore, handleManualReveal, handleRevealByReply, getIndexEntry } from '../../lib/antiViewOnce.js';

export default {
  command: 'reveal',
  alias: ['vo', 'viewonce', 'showvo'],
  description: 'Reveal a captured view-once — reply to the message or pass its ID',
  category: 'owner',
  ownerOnly: true,

  async execute({ sock, msg, jid, args, reply, react }) {
    await react('👁️');

    // ── Method 1: explicit msgId passed as argument ───────────────────────────
    if (args[0]) {
      const msgId = args[0].trim();
      // Check if it exists first to give a meaningful reply
      const inMemory  = viewOnceStore.get(msgId);
      const onDisk    = !inMemory ? getIndexEntry(msgId) : null;
      if (!inMemory && !onDisk) {
        await react('❌');
        return reply(
          `❌ *View-Once not found*\n\n` +
          `No cached media for that message ID.\n\n` +
          `💡 *Tips:*\n` +
          `• The bot must have been running when the view-once arrived.\n` +
          `• Reply directly to the view-once message with *.reveal* (no ID needed).\n\n` +
          `> 👁️ *AA MD Bot*`
        );
      }
      await handleManualReveal(msgId, sock, jid);
      await react('✅');
      return;
    }

    // ── Method 2: reply to a view-once (or any message) ──────────────────────
    const found = await handleRevealByReply(msg, sock);
    if (found) {
      await react('✅');
      return;
    }

    // Not a reply to a cached view-once
    await react('❌');
    return reply(
      `❌ *View-Once not found*\n\n` +
      `The message you replied to is not a captured view-once,\n` +
      `or it has expired from the cache.\n\n` +
      `💡 *How to use:*\n` +
      `• *Reply* to a view-once message and send *.reveal*\n` +
      `• Or: *.reveal <msgId>* to reveal by ID\n\n` +
      `📌 *Make sure:*\n` +
      `• The bot was running when the view-once arrived.\n` +
      `• You set a keyword with *.voword <keyword>* for auto-reveal.\n\n` +
      `> 👁️ *AA MD Bot*`
    );
  },
};
