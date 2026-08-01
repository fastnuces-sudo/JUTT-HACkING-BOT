// ============================================
// Jutts Bot - Good / Nice / Any4SameEmojis
// Developer: Sajid Jutt | Jutts Mods
//
// .good / .nice  — natural-looking replies that secretly reveal a view-once
//                  to the owner's "You" chat. Sender only sees "Good 👍" or "Nice! 👌".
// .any4sameemojis — toggle the 4-same-emoji viewonce trigger on/off
// ============================================

import { handleRevealByReply } from '../../lib/antiViewOnce.js';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import moment from 'moment-timezone';
import config from '../../config.js';
import { db } from '../../lib/database.js';

// ── Download buffer from a Baileys media message ──────────────────────────────
async function dlBuf(mediaMsg, type) {
  const stream = await downloadContentFromMessage(mediaMsg, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// ── Extract media from quoted message (mirrors reveal.js exactly) ─────────────
function extractQuotedMedia(quotedMsg) {
  if (!quotedMsg) return null;
  const inner =
    quotedMsg?.viewOnceMessageV2?.message ||
    quotedMsg?.viewOnceMessageV2Extension?.message ||
    quotedMsg?.viewOnceMessage?.message ||
    quotedMsg?.ephemeralMessage?.message ||
    quotedMsg;

  if (inner?.imageMessage) return { mediaMsg: inner.imageMessage, isVid: false, isAudio: false, mime: inner.imageMessage.mimetype || 'image/jpeg' };
  if (inner?.videoMessage) return { mediaMsg: inner.videoMessage, isVid: true,  isAudio: false, mime: inner.videoMessage.mimetype || 'video/mp4'  };
  if (inner?.audioMessage) return { mediaMsg: inner.audioMessage, isVid: false, isAudio: true,  mime: inner.audioMessage.mimetype || 'audio/mp4'  };
  if (quotedMsg?.imageMessage) return { mediaMsg: quotedMsg.imageMessage, isVid: false, isAudio: false, mime: quotedMsg.imageMessage.mimetype || 'image/jpeg' };
  if (quotedMsg?.videoMessage) return { mediaMsg: quotedMsg.videoMessage, isVid: true,  isAudio: false, mime: quotedMsg.videoMessage.mimetype || 'video/mp4'  };
  if (quotedMsg?.audioMessage) return { mediaMsg: quotedMsg.audioMessage, isVid: false, isAudio: true,  mime: quotedMsg.audioMessage.mimetype || 'audio/mp4'  };
  return null;
}

// ── Shared reveal logic — mirrors reveal.js Step 1 + Step 2 exactly ───────────
async function doReveal(sock, msg, selfJid, label) {
  const tz      = config.timezone || 'Asia/Karachi';
  const date    = moment().tz(tz).format('DD/MM/YYYY');
  const timeStr = moment().tz(tz).format('HH:mm:ss');

  const cap =
    `🔓 *View-Once Revealed*\n\n` +
    `📅 *Date:* ${date}\n` +
    `⏰ *Time:* ${timeStr}\n` +
    `🔑 *Trigger:* ${label}\n\n` +
    `> 👁️ *Jutts Bot*`;

  // ── Step 1: direct download from quotedMessage media keys (same as reveal.js) ─
  const msgContent = msg.message || {};
  const ctxInfo =
    msgContent?.extendedTextMessage?.contextInfo ||
    msgContent?.imageMessage?.contextInfo ||
    msgContent?.videoMessage?.contextInfo ||
    msgContent?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo ||
    null;
  const quotedMsg = ctxInfo?.quotedMessage;

  if (quotedMsg) {
    const extracted = extractQuotedMedia(quotedMsg);
    if (extracted) {
      try {
        const type = extracted.isAudio ? 'audio' : (extracted.isVid ? 'video' : 'image');
        const buf  = await dlBuf(extracted.mediaMsg, type);
        if (buf?.length > 0) {
          if (extracted.isAudio) {
            await sock.sendMessage(selfJid, {
              audio: buf, mimetype: extracted.mime,
              ptt: extracted.mediaMsg?.ptt || false,
            }).catch(() => {});
          } else if (extracted.isVid) {
            await sock.sendMessage(selfJid, { video: buf, caption: cap, mimetype: extracted.mime }).catch(() => {});
          } else {
            await sock.sendMessage(selfJid, { image: buf, caption: cap, mimetype: extracted.mime }).catch(() => {});
          }
          return true;
        }
      } catch {}
    }
  }

  // ── Step 2: handleRevealByReply — in-memory store + disk index by stanzaId ──
  let found = await handleRevealByReply(msg, sock);
  if (!found) {
    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 500));
      found = await handleRevealByReply(msg, sock);
      if (found) break;
    }
  }
  if (found) return true;

  return false;
}

export default {
  command: 'good',
  alias: ['nice', 'any4sameemojis'],
  description: 'Natural-looking view-once reveal / toggle 4-emoji trigger',
  category: 'owner',
  ownerOnly: true,

  async execute({ command, args, sock, msg, jid, reply }) {
    // ── .any4sameemojis — toggle the prefix+4-same-emoji viewonce trigger ──────────
    if (command === 'any4sameemojis') {
      const sub     = (args[0] || '').toLowerCase();
      const current = db.settings.getValue('emojiRevealEnabled') !== false; // default ON

      if (!sub || (sub !== 'on' && sub !== 'off')) {
        return reply(
          `🔥 *Prefix + 4-Same-Emoji ViewOnce Trigger*\n\n` +
          `Status: *${current ? '✅ ON' : '❌ OFF'}*\n\n` +
          `📌 *How it works:*\n` +
          `Type a dot (.) followed by 4 identical emojis\n` +
          `while replying to a view-once (or without replying):\n\n` +
          `• *.🔥🔥🔥🔥*\n` +
          `• *.👀👀👀👀*\n` +
          `• *.❤️❤️❤️❤️*\n\n` +
          `→ Bot silently sends it to your "You" chat.\n\n` +
          `📋 *Toggle:*\n` +
          `• *.any4sameemojis on*  — enable\n` +
          `• *.any4sameemojis off* — disable\n\n` +
          `> 👁️ *Jutts Bot*`
        );
      }

      const enable = sub === 'on';
      db.settings.setValue('emojiRevealEnabled', enable);
      return reply(
        `${enable ? '✅' : '❌'} *4-Same-Emoji Trigger ${enable ? 'Enabled' : 'Disabled'}*\n\n` +
        `${enable ? 'Replying with 4 same emojis now reveals view-once.' : 'Emoji trigger disabled. Use .avv or .good/.nice to reveal.'}\n\n` +
        `> 👁️ *Jutts Bot*`
      );
    }

    // ── .good / .nice — silent reveal to self-chat only ────────────────────
    const selfNum = sock.user?.id?.split('@')[0]?.split(':')[0];
    const selfJid = selfNum ? `${selfNum}@s.whatsapp.net` : null;
    if (!selfJid) return;

    const label = command === 'good' ? '.good' : '.nice';
    await doReveal(sock, msg, selfJid, label);
    // Completely silent — no reply, no react
  },
};
