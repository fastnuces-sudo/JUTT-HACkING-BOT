// ============================================
// AA MD Bot - Anonymous Message Sender
// Two-way relay: replies come back anonymously
// ============================================

import {
  anonSessions,
  startAnonSession,
  endAnonSessionBySender,
} from '../../lib/anonRelay.js';

function norm(jid) {
  if (!jid) return '';
  return jid.includes(':') ? jid.split(':')[0] + '@s.whatsapp.net' : jid;
}

export default {
  command: 'anon',
  alias: ['anonymous', 'secretmsg'],
  description: 'Send anonymous messages — your number is never shown',
  category: 'utility',

  async execute({ sock, jid, msg, reply, args, text, senderJid, sessionId }) {
    const senderBase = norm(senderJid);

    // ── .anon end — close active session ────────────────────────────────────
    if (args[0]?.toLowerCase() === 'end') {
      const ended = endAnonSessionBySender(senderBase);
      return reply(
        ended
          ? `🔒 *Anonymous session closed.*\n\nThe other person can no longer reply to you anonymously.\n\n> 🤖 *AA MD Bot*`
          : `ℹ️ You have no active anonymous session.\n\n> 🤖 *AA MD Bot*`
      );
    }

    // ── .anon status ─────────────────────────────────────────────────────────
    if (args[0]?.toLowerCase() === 'status') {
      let found = false;
      for (const session of anonSessions.values()) {
        if (norm(session.senderJid) === senderBase) { found = true; break; }
      }
      return reply(
        found
          ? `🟢 *Anonymous session ACTIVE.*\n\nReplies from the recipient are being forwarded to you.\nSend *.anon end* to close it.\n\n> 🤖 *AA MD Bot*`
          : `⚪ No active anonymous session.\n\n> 🤖 *AA MD Bot*`
      );
    }

    // ── Help ──────────────────────────────────────────────────────────────────
    if (!args.length) {
      return reply(
        `🔒 *Anonymous Message*\n\n` +
        `Send messages without revealing your number.\n` +
        `If the recipient replies to the bot, their reply comes back to you — both sides stay anonymous.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `*Send:*\n` +
        `▸ *.anon @user Your message*\n` +
        `▸ *.anon +923001234567 Hello!*\n\n` +
        `*Manage:*\n` +
        `▸ *.anon status* — check if session is active\n` +
        `▸ *.anon end*    — close session\n\n` +
        `*How it works:*\n` +
        `• Recipient sees a plain text message — no "Anonymous" label\n` +
        `• Your number is never visible\n` +
        `• Their replies are forwarded to you anonymously\n` +
        `• Session lasts 24 hours\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    // ── Resolve target ────────────────────────────────────────────────────────
    let targetJid = null;
    let messageText = '';

    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (mentions.length) {
      targetJid   = norm(mentions[0]);
      messageText = text.replace(/@\d+/g, '').trim();
    }

    if (!targetJid) {
      const numMatch = args[0]?.match(/^\+?(\d{7,15})$/);
      if (numMatch) {
        targetJid   = `${numMatch[1]}@s.whatsapp.net`;
        messageText = args.slice(1).join(' ').trim();
      }
    }

    if (!targetJid) {
      return reply(
        `❌ *Specify a target.*\n\n▸ *.anon @user Message*\n▸ *.anon +923001234567 Message*\n\n> 🤖 *AA MD Bot*`
      );
    }

    if (!messageText) {
      return reply(
        `❌ *Please include a message.*\n\nExample: *.anon @user Assalamualaikum!*\n\n> 🤖 *AA MD Bot*`
      );
    }

    if (senderBase === targetJid) {
      return reply(`❌ You cannot message yourself anonymously.\n\n> 🤖 *AA MD Bot*`);
    }

    if (messageText.length > 1000) {
      return reply(`❌ Message too long — max 1000 characters.\n\n> 🤖 *AA MD Bot*`);
    }

    try {
      // ── Send plain text — no "Anonymous" header, looks like any normal message ──
      await sock.sendMessage(targetJid, { text: messageText });

      // ── Register relay so their replies come back to sender ──────────────────
      startAnonSession(senderBase, targetJid, sock, sessionId);

      return reply(
        `✅ *Message sent anonymously!*\n\n` +
        `📨 To: +${targetJid.split('@')[0]}\n` +
        `💬 _"${messageText.slice(0, 80)}${messageText.length > 80 ? '...' : ''}"_\n\n` +
        `↩️ If they reply, it comes back to you here.\n` +
        `Send *.anon end* to close the session early.\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    } catch (err) {
      return reply(
        `❌ *Could not deliver message.*\n\n` +
        `Reason: _${err.message}_\n` +
        `_(Recipient may have privacy settings blocking unknown numbers.)_\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }
  },
};
