// ============================================
// AA MD Bot - Anonymous Message Sender
// Developer: Ahsan Ali | AA Mods
// .anon @user message      — anonymously kisi ko msg bhejo
// .anon +923001234567 msg  — number directly
// ============================================

export default {
  command: 'anon',
  alias: ['anonymous', 'secretmsg', 'hiddenmsg'],
  description: 'Anonymously kisi bhi user ko message bhejo (sender hidden)',
  category: 'utility',

  async execute({ sock, jid, msg, reply, args, text, senderJid }) {
    // ── Help ──────────────────────────────────────────────────────────────────
    if (!args.length) {
      return reply(
        `🔒 *Anonymous Message*\n\n` +
        `Kisi ko bhi anonymously message bhejo — sender ka naam nahi pata chalega!\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*Usage:*\n` +
        `▸ *.anon @user Yeh secret message hai*\n` +
        `▸ *.anon +923001234567 Hello!*\n\n` +
        `*Note:*\n` +
        `• Message bot ki taraf se jayega\n` +
        `• Tumhara naam bilkul show nahi hoga\n` +
        `• Sirf 1 message send hoga (spam allowed nahi)\n\n` +
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
        `❌ *Target specify karo.*\n\n` +
        `▸ *.anon @user Message*\n` +
        `▸ *.anon +923001234567 Message*\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    if (!messageText) {
      return reply(`❌ *Message bhi likhna hai.*\n\nExample: *.anon @user Hello yaar!*\n\n> 🤖 *AA MD Bot*`);
    }

    if (messageText.length > 1000) {
      return reply(`❌ Message bohot lamba hai. Max 1000 characters.\n\n> 🤖 *AA MD Bot*`);
    }

    // Prevent self-anon
    const senderBase = senderJid.includes(':') ? senderJid.split(':')[0] + '@s.whatsapp.net' : senderJid;
    const targetBase = targetJid.includes(':') ? targetJid.split(':')[0] + '@s.whatsapp.net' : targetJid;
    if (senderBase === targetBase) {
      return reply(`❌ Khud ko anonymous message nahi bhej sakte.\n\n> 🤖 *AA MD Bot*`);
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
        `✅ *Anonymous message bhej diya!*\n\n` +
        `👤 To: @${targetBase.split('@')[0]}\n` +
        `💬 Message: _"${messageText.slice(0, 60)}${messageText.length > 60 ? '...' : ''}"_\n\n` +
        `Recipient ko tumhara naam nahi pata chalega.\n\n> 🤖 *AA MD Bot*`,
        { mentions: [targetJid] }
      );
    } catch (err) {
      return reply(
        `❌ *Message send nahi hua.*\n\n` +
        `Wajah: ${err.message}\n` +
        `(User ne privacy settings set ki ho sakti hain.)\n\n> 🤖 *AA MD Bot*`
      );
    }
  },
};
