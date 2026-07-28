// ============================================
// AA MD Bot - Clean Message
// Developer: Ahsan Ali | AA Mods
// Reply to any message with .clean to re-send
// it without "View Channel" and "Forwarded many
// times" tags (strips all contextInfo/forwarding).
// ============================================

import { downloadContentFromMessage } from '@whiskeysockets/baileys';

async function dlBuf(mediaMsg, type) {
  const stream = await downloadContentFromMessage(mediaMsg, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// Unwrap all envelope layers and return the innermost message object
function unwrap(m) {
  if (!m) return m;
  for (let i = 0; i < 6; i++) {
    if (m.ephemeralMessage?.message)           { m = m.ephemeralMessage.message;           continue; }
    if (m.documentWithCaptionMessage?.message) { m = m.documentWithCaptionMessage.message; continue; }
    if (m.viewOnceMessage?.message)            { m = m.viewOnceMessage.message;            continue; }
    if (m.viewOnceMessageV2?.message)          { m = m.viewOnceMessageV2.message;          continue; }
    break;
  }
  return m;
}

export default {
  command: 'clean',
  alias: ['nofwd', 'notag', 'removetag', 'clearmsg'],
  description: 'Reply to any message — re-sends it without "View Channel" and "Forwarded" tags',
  category: 'owner',
  ownerOnly: true,

  async execute({ sock, msg, jid, reply, react, getQuoted }) {
    const quotedMsg = getQuoted();

    if (!quotedMsg) {
      return reply(
        `🧹 *Clean Message*\n\n` +
        `Kisi bhi message ko *reply* karo aur *.clean* type karo.\n` +
        `Bot us message ko bina *"View Channel"* aur *"Forwarded many times"* tag ke re-send kar dega.\n\n` +
        `> 🧹 *AA MD Bot*`
      );
    }

    await react('⏳');

    const inner = unwrap(quotedMsg);

    try {
      // ── TEXT ──────────────────────────────────────────────────────────────
      const text =
        inner?.conversation ||
        inner?.extendedTextMessage?.text ||
        null;

      if (text) {
        await sock.sendMessage(jid, { text }, { quoted: msg });
        return await react('✅');
      }

      // ── IMAGE ─────────────────────────────────────────────────────────────
      if (inner?.imageMessage) {
        const im = inner.imageMessage;
        const buf = await dlBuf(im, 'image');
        await sock.sendMessage(jid, {
          image: buf,
          caption: im.caption || '',
          mimetype: im.mimetype || 'image/jpeg',
        }, { quoted: msg });
        return await react('✅');
      }

      // ── VIDEO ─────────────────────────────────────────────────────────────
      if (inner?.videoMessage) {
        const vm = inner.videoMessage;
        const buf = await dlBuf(vm, 'video');
        await sock.sendMessage(jid, {
          video: buf,
          caption: vm.caption || '',
          mimetype: vm.mimetype || 'video/mp4',
        }, { quoted: msg });
        return await react('✅');
      }

      // ── AUDIO / PTT ───────────────────────────────────────────────────────
      if (inner?.audioMessage) {
        const am = inner.audioMessage;
        const buf = await dlBuf(am, 'audio');
        await sock.sendMessage(jid, {
          audio: buf,
          mimetype: am.mimetype || 'audio/ogg; codecs=opus',
          ptt: am.ptt || false,
        }, { quoted: msg });
        return await react('✅');
      }

      // ── DOCUMENT ──────────────────────────────────────────────────────────
      if (inner?.documentMessage) {
        const dm = inner.documentMessage;
        const buf = await dlBuf(dm, 'document');
        await sock.sendMessage(jid, {
          document: buf,
          mimetype: dm.mimetype || 'application/octet-stream',
          fileName: dm.fileName || 'file',
          caption: dm.caption || '',
        }, { quoted: msg });
        return await react('✅');
      }

      // ── STICKER ───────────────────────────────────────────────────────────
      if (inner?.stickerMessage) {
        const sm = inner.stickerMessage;
        const buf = await dlBuf(sm, 'sticker');
        await sock.sendMessage(jid, {
          sticker: buf,
          mimetype: sm.mimetype || 'image/webp',
        }, { quoted: msg });
        return await react('✅');
      }

      // ── GIF (animated video) ──────────────────────────────────────────────
      if (inner?.videoMessage?.gifPlayback) {
        const gm = inner.videoMessage;
        const buf = await dlBuf(gm, 'video');
        await sock.sendMessage(jid, {
          video: buf,
          gifPlayback: true,
          caption: gm.caption || '',
          mimetype: gm.mimetype || 'video/mp4',
        }, { quoted: msg });
        return await react('✅');
      }

      await react('❌');
      return reply(
        `❌ *Is message type ko clean nahi kar sakta.*\n\n` +
        `Supported types: text, image, video, audio, document, sticker\n\n` +
        `> 🧹 *AA MD Bot*`
      );

    } catch (err) {
      await react('❌');
      return reply(
        `❌ *Error:* ${err.message}\n\n` +
        `Media download fail ho sakta hai agar message expire ho gaya ho.\n\n` +
        `> 🧹 *AA MD Bot*`
      );
    }
  },
};
