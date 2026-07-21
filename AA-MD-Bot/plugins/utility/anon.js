// ============================================
// AA MD Bot - Anonymous Message Sender
// Developer: Ahsan Ali | AA Mods
// .anon @user message      — send an anonymous message to a user
// .anon +923001234567 msg  — send to number directly
// ============================================

export default {
  command: 'anon',
  alias: ['anonymous', 'secretmsg', 'hiddenmsg'],
  description: 'Send an anonymous message to any user (sender hidden)',
  category: 'utility',

  async execute({ sock, jid, msg, reply, args, text, senderJid }) {
    // ── Help ──────────────────────────────────────────────────────────────────
    if (!args.length) {
      return reply(
        `🔒 *Anonymous Message*\n\n` +
        `Send a message to anyone anonymously — the recipient will not see your name!\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*Usage:*\n` +
        `▸ *.anon @user This is a secret message*\n` +
        `▸ *.anon +923001234567 Hello!*\n\n` +
        `*Note:*\n` +
        `• The message will be sent from the bot\n` +
        `• Your identity will not be revealed\n` +
        `• Only 1 message per use (no spam)\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    let targetJid  = null;
    let messageText = '';

    // ── Resolve target ────────────────────────────────────────────────────────

    // Case 1: mentioned user (@)
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentions.length) {
      targetJid   = mentions[0];
      // Message = everything after the @mention
      messageText = text.replace(/@\d+/g, '').trim();
    }

    // Case 2: phone number (+923... or 923...)
    if (!targetJid) {
      const numMatch = args[0]?.match(/^\+?(\d{7,15})$/);
      if (numMatch) {
        targetJid   = `${numMatch[1]}@s.whatsapp.net`;
        messageText = args.slice(1).join(' ').trim();
      }
    }

    if (!targetJid) {
      return reply(
        `❌ *Please specify a target.*\n\n` +
        `▸ *.anon @user Message*\n` +
        `▸ *.anon +923001234567 Message*\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    if (!messageText) {
      return reply(`❌ *Please include a message.*\n\nExample: *.anon @user Hello!*\n\n> 🤖 *AA MD Bot*`);
    }

    if (messageText.length > 1000) {
      return reply(`❌ Message is too long. Maximum 1000 characters.\n\n> 🤖 *AA MD Bot*`);
    }

    // Prevent self-anon
    const senderBase = senderJid.includes(':') ? senderJid.split(':')[0] + '@s.whatsapp.net' : senderJid;
    const targetBase = targetJid.includes(':') ? targetJid.split(':')[0] + '@s.whatsapp.net' : targetJid;
    if (senderBase === targetBase) {
      return reply(`❌ You cannot send an anonymous message to yourself.\n\n> 🤖 *AA MD Bot*`);
    }

    try {
      // Send to target — no sender info
      await sock.sendMessage(targetBase, {
        text:
          `🔒 *Anonymous Message*\n\n` +
          `${messageText}\n\n` +
          `_— Sent anonymously via AA MD Bot_\n\n` +
          `> 🤖 *AA MD Bot*`,
      });

      // Confirm to sender (quietly, in same chat)
      return reply(
        `✅ *Anonymous message sent!*\n\n` +
        `👤 To: @${targetBase.split('@')[0]}\n` +
        `💬 Message: _"${messageText.slice(0, 60)}${messageText.length > 60 ? '...' : ''}"_\n\n` +
        `The recipient will not know it was you.\n\n> 🤖 *AA MD Bot*`,
        { mentions: [targetJid] }
      );
    } catch (err) {
      return reply(
        `❌ *Message could not be sent.*\n\n` +
        `Reason: ${err.message}\n` +
        `(The user may have privacy settings that block messages.)\n\n> 🤖 *AA MD Bot*`
      );
    }
  },
};
