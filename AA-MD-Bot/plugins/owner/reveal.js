// ============================================
// AA MD Bot - View-Once Reveal Plugin
// Developer: Ahsan Ali | AA Mods
//
// Strategy (silva-md-bot inspired):
//  1. PRIMARY  — download directly from the quoted message's media keys
//               (works even if the bot missed capturing it on arrival)
//  2. FALLBACK — check the in-memory store or disk index by stanzaId
//  3. ARG MODE — .reveal <msgId> looks up the store/disk by message ID
// ============================================

import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { viewOnceStore, getIndexEntry, handleManualReveal } from '../../lib/antiViewOnce.js';
import fs from 'fs-extra';
import moment from 'moment-timezone';
import config from '../../config.js';

// ── Extract any media from a quotedMessage object ─────────────────────────────
// Unwraps viewOnce wrappers and returns { mediaMsg, isVid, mime }
function extractQuotedMedia(quotedMsg) {
  if (!quotedMsg) return null;

  // Walk common wrappers first: viewOnceMessageV2, viewOnceMessage, ephemeralMessage
  const inner =
    quotedMsg?.viewOnceMessageV2?.message ||
    quotedMsg?.viewOnceMessageV2Extension?.message ||
    quotedMsg?.viewOnceMessage?.message ||
    quotedMsg?.ephemeralMessage?.message ||
    quotedMsg;

  // Now find the actual media
  if (inner?.imageMessage) return { mediaMsg: inner.imageMessage, isVid: false, mime: inner.imageMessage.mimetype || 'image/jpeg' };
  if (inner?.videoMessage) return { mediaMsg: inner.videoMessage, isVid: true,  mime: inner.videoMessage.mimetype || 'video/mp4'  };
  if (inner?.audioMessage) return { mediaMsg: inner.audioMessage, isVid: false, mime: inner.audioMessage.mimetype || 'audio/mp4', isAudio: true };

  // Direct fields (when WhatsApp strips the wrapper)
  if (quotedMsg?.imageMessage) return { mediaMsg: quotedMsg.imageMessage, isVid: false, mime: quotedMsg.imageMessage.mimetype || 'image/jpeg' };
  if (quotedMsg?.videoMessage) return { mediaMsg: quotedMsg.videoMessage, isVid: true,  mime: quotedMsg.videoMessage.mimetype || 'video/mp4'  };
  if (quotedMsg?.audioMessage) return { mediaMsg: quotedMsg.audioMessage, isVid: false, mime: quotedMsg.audioMessage.mimetype || 'audio/mp4', isAudio: true };

  return null;
}

// ── Download buffer from a Baileys media message ──────────────────────────────
async function dlBuf(mediaMsg, type) {
  const stream = await downloadContentFromMessage(mediaMsg, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default {
  command: 'reveal',
  alias: ['vv', 'vo', 'viewonce', 'openvv', 'showvo'],
  description: 'Reveal a view-once — reply to it, or pass a message ID',
  category: 'owner',
  ownerOnly: true,

  async execute({ sock, msg, jid, args, reply, react }) {
    await react('👁️');

    const tz      = config.timezone || 'Asia/Karachi';
    const date    = moment().tz(tz).format('DD/MM/YYYY');
    const timeStr = moment().tz(tz).format('HH:mm:ss');

    const selfNum = sock.user?.id?.split('@')[0]?.split(':')[0];
    const selfJid = selfNum ? `${selfNum}@s.whatsapp.net` : jid;

    // ══ MODE A: .reveal <msgId> — look up from store ══════════════════════════
    if (args[0]) {
      const msgId = args[0].trim();
      const inMem = viewOnceStore.get(msgId);
      const onDisk = !inMem ? getIndexEntry(msgId) : null;

      if (!inMem && !onDisk) {
        await react('❌');
        return reply(
          `❌ *View-Once not found*\n\n` +
          `No cached media for that ID.\n\n` +
          `💡 *Better way:* Reply directly to the view-once and send *.reveal* — no ID needed.\n\n` +
          `> 👁️ *AA MD Bot*`
        );
      }
      await handleManualReveal(msgId, sock, selfJid);
      await react('✅');
      return;
    }

    // ══ MODE B: Reply to a view-once ══════════════════════════════════════════
    // Get contextInfo from the command message (whichever wrapper holds it)
    const msgContent = msg.message || {};
    const ctxInfo =
      msgContent?.extendedTextMessage?.contextInfo ||
      msgContent?.imageMessage?.contextInfo ||
      msgContent?.videoMessage?.contextInfo ||
      msgContent?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo ||
      null;

    const quotedMsg  = ctxInfo?.quotedMessage;
    const stanzaId   = ctxInfo?.stanzaId;

    // ── Step 1: Try downloading directly from quotedMessage (silva approach) ──
    // Most reliable — works even if the bot wasn't running when the view-once arrived.
    if (quotedMsg) {
      const extracted = extractQuotedMedia(quotedMsg);
      if (extracted) {
        try {
          const type = extracted.isAudio ? 'audio' : (extracted.isVid ? 'video' : 'image');
          const buf  = await dlBuf(extracted.mediaMsg, type);

          if (buf?.length > 0) {
            const cap =
              `🔓 *View-Once Revealed*\n\n` +
              `📅 *Date:* ${date}\n` +
              `⏰ *Time:* ${timeStr}\n` +
              `📁 *Type:* ${extracted.isAudio ? 'AUDIO' : extracted.isVid ? 'VIDEO' : 'IMAGE'}\n\n` +
              `> 👁️ *AA MD Bot*`;

            if (extracted.isAudio) {
              await sock.sendMessage(selfJid, {
                audio: buf, mimetype: extracted.mime,
                ptt: extracted.mediaMsg?.ptt || false,
              }).catch(() => {});
            } else if (extracted.isVid) {
              await sock.sendMessage(selfJid, {
                video: buf, caption: cap, mimetype: extracted.mime,
              }).catch(() => {});
            } else {
              await sock.sendMessage(selfJid, {
                image: buf, caption: cap, mimetype: extracted.mime,
              }).catch(() => {});
            }

            await react('✅');
            return;
          }
        } catch (e) {
          // Download from quoted failed — fall through to store lookup below
        }
      }
    }

    // ── Step 2: Store lookup by stanzaId (in-memory or disk index) ────────────
    if (stanzaId) {
      // Retry up to 3s in case view-once is still being downloaded via messages.update
      let stored = viewOnceStore.get(stanzaId);
      if (!stored) {
        for (let i = 0; i < 6; i++) {
          await new Promise(r => setTimeout(r, 500));
          stored = viewOnceStore.get(stanzaId);
          if (stored) break;
        }
      }
      // Disk fallback
      if (!stored) {
        const meta = getIndexEntry(stanzaId);
        if (meta?.savedPath) {
          try {
            const diskBuf = await fs.readFile(meta.savedPath);
            if (diskBuf?.length > 0) stored = { ...meta, buf: diskBuf };
          } catch {}
        }
      }

      if (stored) {
        const cap =
          `🔓 *View-Once Revealed*\n\n` +
          `📅 *Date:* ${date}\n` +
          `⏰ *Time:* ${timeStr}\n` +
          `📁 *Type:* ${stored.isVid ? 'VIDEO' : 'IMAGE'}\n` +
          `💬 *Caption:* "${stored.caption || 'None'}"\n\n` +
          `> 👁️ *AA MD Bot*`;

        await sock.sendMessage(
          selfJid,
          stored.isVid
            ? { video: stored.buf, caption: cap, mimetype: stored.mime }
            : { image: stored.buf, caption: cap, mimetype: stored.mime }
        ).catch(() => {});

        await react('✅');
        return;
      }
    }

    // ── Nothing worked ─────────────────────────────────────────────────────────
    await react('❌');
    return reply(
      `❌ *View-Once not found*\n\n` +
      `Please *reply directly* to the view-once message and send *.reveal*.\n\n` +
      `📌 *Make sure:*\n` +
      `• You are replying to the actual view-once (not a forwarded copy)\n` +
      `• The original message is still on WhatsApp's servers\n\n` +
      `> 👁️ *AA MD Bot*`
    );
  },
};
