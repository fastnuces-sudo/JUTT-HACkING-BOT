// ============================================
// AA MD Bot - Reveal View-Once Plugin
// Developer: Ahsan Ali | AA Mods
// Reply to any view-once → get it as normal media
// ============================================

import { downloadContentFromMessage } from '@whiskeysockets/baileys';

async function downloadMedia(mediaMsg, mediaType) {
  const stream = await downloadContentFromMessage(mediaMsg, mediaType);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default {
  command: 'reveal',
  alias: ['rv', 'unviewonce', 'viewonce'],
  description: 'Reveal a view-once photo or video (reply to it)',
  category: 'Media',
  usage: '.reveal (reply to a view-once message)',

  async execute({ sock, jid, reply, getQuoted }) {
    const quoted = getQuoted();

    if (!quoted) {
      return reply(
        `👁️ *Reveal View-Once*\n\n` +
        `Reply to a view-once photo or video with *.reveal* to get it as a normal image/video.\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📌 Works on any view-once message received in DM or groups.`
      );
    }

    const qMsg = quoted;

    const vMsg =
      qMsg.viewOnceMessage?.message ||
      qMsg.viewOnceMessageV2?.message?.viewOnceMessage?.message ||
      qMsg.viewOnceMessageV2ExpiryExtension?.message?.viewOnceMessage?.message ||
      qMsg;

    const isImage = !!(vMsg.imageMessage || qMsg.imageMessage);
    const isVideo = !!(vMsg.videoMessage || qMsg.videoMessage);

    if (!isImage && !isVideo) {
      return reply('⚠️ The replied message is not a view-once photo or video. Please reply to a view-once message.');
    }

    const mediaType = isImage ? 'image' : 'video';
    const mediaMsg  = vMsg[`${mediaType}Message`] || qMsg[`${mediaType}Message`];

    if (!mediaMsg) {
      return reply('⚠️ Could not find the media in the replied message.');
    }

    await reply(`⏳ Revealing view-once ${mediaType}...`);

    try {
      const buffer = await downloadMedia(mediaMsg, mediaType);
      await sock.sendMessage(jid, {
        [mediaType]: buffer,
        caption: `👁️ *View-once ${mediaType === 'image' ? 'photo' : 'video'} revealed*`,
        mimetype: mediaType === 'image' ? 'image/jpeg' : 'video/mp4',
      });
    } catch (err) {
      await reply(
        `❌ *Could not reveal media*\n\n${err.message}\n\n` +
        `💡 This can happen if the view-once already expired before I received it.`
      );
    }
  },
};
