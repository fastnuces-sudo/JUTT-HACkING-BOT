// ============================================
// AA MD Bot - Clean/Strip Forwarded Message
// .rmfwd / .clean / .stripfwd
// Re-sends any message WITHOUT:
//   • "View Channel" (externalAdReply)
//   • "Forwarded many times" (forwardingScore)
// Works by: downloading media fresh + re-encoding
// images through Sharp to change the file hash
// (WhatsApp uses hash to re-attach channel metadata).
// ============================================

import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import sharp from 'sharp';

// ── Download media as raw buffer ─────────────────────────────────────────────
async function dlBuf(mediaMsg, type) {
  const stream = await downloadContentFromMessage(mediaMsg, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// ── Re-encode image through Sharp to change its SHA256 hash ─────────────────
// WhatsApp recognises channel images by hash and re-attaches "View Channel".
// One pass through Sharp with lossless=false produces a different hash.
async function reEncodeImage(buf) {
  try {
    const img = sharp(buf);
    const meta = await img.metadata();
    // Force re-compression with a slight quality nudge — visually identical,
    // but produces a different binary hash so WA loses the channel association.
    if (meta.format === 'png' || meta.format === 'webp') {
      return await img.png({ compressionLevel: 9, effort: 1 }).toBuffer();
    }
    return await img.jpeg({ quality: 92, mozjpeg: false }).toBuffer();
  } catch {
    return buf; // fallback: use as-is
  }
}

// ── Strip WhatsApp channel/newsletter footer URLs from text ──────────────────
// Channel messages often have a "whatsapp.com/channel/..." or "wa.me/..." URL
// as a footer. When re-sent as plain text, WA auto-generates a "View Channel"
// link preview card from these URLs. Strip them before sending.
function stripChannelUrls(text) {
  return text
    .replace(/https?:\/\/(?:www\.)?whatsapp\.com\/channel\/\S*/gi, '')
    .replace(/https?:\/\/wa\.me\/channel\/\S*/gi, '')
    .replace(/\n{3,}/g, '\n\n')  // collapse multiple blank lines
    .trim();
}

// ── Unwrap all envelope layers ───────────────────────────────────────────────
function unwrap(m) {
  if (!m) return m;
  for (let i = 0; i < 8; i++) {
    if (m.ephemeralMessage?.message)               { m = m.ephemeralMessage.message;               continue; }
    if (m.documentWithCaptionMessage?.message)     { m = m.documentWithCaptionMessage.message;     continue; }
    if (m.viewOnceMessage?.message)                { m = m.viewOnceMessage.message;                continue; }
    if (m.viewOnceMessageV2?.message)              { m = m.viewOnceMessageV2.message;              continue; }
    if (m.viewOnceMessageV2Extension?.message)     { m = m.viewOnceMessageV2Extension.message;     continue; }
    if (m.editedMessage?.message)                  { m = m.editedMessage.message;                  continue; }
    if (m.channelMessage?.message)                 { m = m.channelMessage.message;                 continue; }
    if (m.newsletterMessage?.message)              { m = m.newsletterMessage.message;              continue; }
    break;
  }
  return m;
}

export default {
  command: 'stripfwd',
  alias: ['rmfwd', 'cleanfwd', 'removefwd', 'notags', 'clean'],
  description: 'Re-sends a message without "View Channel" and "Forwarded many times" tags',
  category: 'owner',
  ownerOnly: true,
  // Bot's own reply() calls for this command must NOT carry forwarding/channel ctx —
  // this command exists specifically to strip those tags, so its own responses
  // should be tag-free too.
  noChannelCtx: true,

  async execute({ sock, msg, jid, reply, react, getQuoted }) {
    const quotedMsg = getQuoted();

    if (!quotedMsg) {
      return reply(
        `🧹 *Clean Message*\n\n` +
        `Kisi bhi forwarded message ko *reply* karo aur *.rmfwd* bhejo.\n\n` +
        `Bot us message ko bina *"View Channel"* aur *"Forwarded many times"* tag ke re-send karega.\n\n` +
        `*Supported:* text, image, video, audio, document, sticker\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    await react('⏳');

    const inner = unwrap(quotedMsg);
    if (!inner) {
      await react('❌');
      return reply(`❌ Message type samajh nahi aaya.\n\n> 🤖 *AA MD Bot*`);
    }

    try {
      // ── TEXT ────────────────────────────────────────────────────────────────
      const rawText =
        inner?.conversation ||
        inner?.extendedTextMessage?.text ||
        null;

      // _noChannelCtx: true tells the global sock.sendMessage patch (sessionManager.js)
      // to skip injecting the newsletter "View Channel" context for these sends.
      const CLEAN_OPTS = { quoted: msg, _noChannelCtx: true };

      if (rawText) {
        // Strip channel footer URLs that trigger "View Channel" link preview
        const cleanText = stripChannelUrls(rawText);
        if (!cleanText) {
          await react('❌');
          return reply(`❌ Message mein sirf channel link tha — strip karne ke baad kuch nahi bacha.\n\n> 🤖 *AA MD Bot*`);
        }
        await sock.sendMessage(jid, { text: cleanText }, CLEAN_OPTS);
        return await react('✅');
      }

      // ── IMAGE ────────────────────────────────────────────────────────────────
      if (inner?.imageMessage) {
        const im  = inner.imageMessage;
        const raw = await dlBuf(im, 'image');
        // Re-encode to change SHA256 hash → WA loses "View Channel" association
        const buf = await reEncodeImage(raw);
        const cleanCaption = im.caption ? stripChannelUrls(im.caption) : '';
        await sock.sendMessage(jid, {
          image: buf,
          caption: cleanCaption,
          mimetype: 'image/jpeg',
        }, CLEAN_OPTS);
        return await react('✅');
      }

      // ── VIDEO ────────────────────────────────────────────────────────────────
      if (inner?.videoMessage) {
        const vm  = inner.videoMessage;
        // GIF check first
        if (vm.gifPlayback) {
          const buf = await dlBuf(vm, 'video');
          await sock.sendMessage(jid, {
            video: buf,
            gifPlayback: true,
            caption: vm.caption ? stripChannelUrls(vm.caption) : '',
            mimetype: vm.mimetype || 'video/mp4',
          }, CLEAN_OPTS);
          return await react('✅');
        }
        const buf = await dlBuf(vm, 'video');
        await sock.sendMessage(jid, {
          video: buf,
          caption: vm.caption ? stripChannelUrls(vm.caption) : '',
          mimetype: vm.mimetype || 'video/mp4',
        }, CLEAN_OPTS);
        return await react('✅');
      }

      // ── AUDIO / PTT ──────────────────────────────────────────────────────────
      if (inner?.audioMessage) {
        const am  = inner.audioMessage;
        const buf = await dlBuf(am, 'audio');
        await sock.sendMessage(jid, {
          audio: buf,
          mimetype: am.mimetype || 'audio/ogg; codecs=opus',
          ptt: am.ptt || false,
        }, CLEAN_OPTS);
        return await react('✅');
      }

      // ── DOCUMENT ─────────────────────────────────────────────────────────────
      if (inner?.documentMessage) {
        const dm  = inner.documentMessage;
        const buf = await dlBuf(dm, 'document');
        await sock.sendMessage(jid, {
          document: buf,
          mimetype: dm.mimetype || 'application/octet-stream',
          fileName: dm.fileName || 'file',
          caption: dm.caption ? stripChannelUrls(dm.caption) : '',
        }, CLEAN_OPTS);
        return await react('✅');
      }

      // ── STICKER ──────────────────────────────────────────────────────────────
      if (inner?.stickerMessage) {
        const sm  = inner.stickerMessage;
        const buf = await dlBuf(sm, 'sticker');
        await sock.sendMessage(jid, {
          sticker: buf,
          mimetype: sm.mimetype || 'image/webp',
        }, { _noChannelCtx: true });
        return await react('✅');
      }

      await react('❌');
      return reply(
        `❌ *Is message type ko clean nahi kar sakta.*\n\n` +
        `Supported: text, image, video, audio, document, sticker\n\n` +
        `> 🤖 *AA MD Bot*`
      );

    } catch (err) {
      await react('❌');
      return reply(
        `❌ *Error:* ${err.message}\n\n` +
        `Media download fail ho sakta hai agar message expire ho gaya ho.\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }
  },
};
