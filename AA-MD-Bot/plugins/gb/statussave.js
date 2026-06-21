// ============================================
// AA MD Bot - Status Saver (GB WhatsApp Feature)
// Save any WhatsApp status (photo/video/text)
// ============================================

export default {
  command: 'statussave',
  alias: ['savestatus', 'statusdl', 'svs', 'dlstatus'],
  category: 'gb',
  description: 'Save a WhatsApp status — reply to a forwarded status',
  usage: '.statussave (reply to a forwarded status)',

  async execute({ reply, react, sock, jid, msg, quoted }) {
    // Must reply to a message that contains media
    const q = quoted?.message || msg?.message;

    // Find the media content from quoted message
    const mediaTypes = [
      'imageMessage',
      'videoMessage',
      'audioMessage',
      'documentMessage',
      'stickerMessage',
    ];

    let mediaType = null;
    let mediaMsg  = null;

    for (const type of mediaTypes) {
      if (q?.[type]) {
        mediaType = type;
        mediaMsg  = q[type];
        break;
      }
    }

    // Text status
    const textMsg = q?.conversation || q?.extendedTextMessage?.text;

    if (!mediaType && !textMsg) {
      return reply(
        `💾 *Status Saver*\n\n` +
        `*GB WhatsApp Feature* — Save any contact's status\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📌 *How to use:*\n` +
        `1. Forward a status to this bot chat\n` +
        `2. Reply to that forwarded message with *.statussave*\n\n` +
        `Or: Open the status, forward to bot, then reply.\n\n` +
        `Supports: 📷 Photos • 🎬 Videos • 🎵 Audio • 📄 Docs\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    }

    if (textMsg) {
      return reply(
        `📝 *Status Text Saved!*\n\n` +
        `"${textMsg}"\n\n` +
        `> 💾 *Saved via AA MD Bot*`
      );
    }

    await react('⏳');

    try {
      // Download the media from the quoted message
      const { downloadMediaMessage } = await import('@whiskeysockets/baileys');

      // Build a fake message object for downloadMediaMessage
      const fakeMsg = {
        key: quoted?.key || msg?.key,
        message: q,
      };

      const buffer = await downloadMediaMessage(fakeMsg, 'buffer', {});

      if (!buffer || !buffer.length) {
        await react('❌');
        return reply(`❌ Could not download media. Try forwarding the status again.`);
      }

      const mimetype = mediaMsg?.mimetype || 'image/jpeg';
      const isVideo  = mediaType === 'videoMessage';
      const isAudio  = mediaType === 'audioMessage';
      const isImage  = mediaType === 'imageMessage';
      const isDoc    = mediaType === 'documentMessage';

      const caption = `💾 *Status Saved!*\n\n> 📲 *Saved via AA MD Bot*`;

      if (isImage) {
        await sock.sendMessage(jid, { image: buffer, caption, mimetype });
      } else if (isVideo) {
        await sock.sendMessage(jid, { video: buffer, caption, mimetype });
      } else if (isAudio) {
        await sock.sendMessage(jid, { audio: buffer, mimetype, ptt: false });
      } else if (isDoc) {
        await sock.sendMessage(jid, {
          document: buffer,
          caption,
          mimetype,
          fileName: mediaMsg?.fileName || 'status_file',
        });
      } else {
        await sock.sendMessage(jid, { document: buffer, caption, mimetype, fileName: 'status' });
      }

      await react('✅');

    } catch (err) {
      await react('❌');
      reply(`❌ Failed to save status: ${err.message?.slice(0, 80) || 'Unknown error'}`);
    }
  },
};
