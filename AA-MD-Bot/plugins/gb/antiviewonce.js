// ============================================
// AA MD Bot - Anti View Once (GB WhatsApp Feature)
// Reveal view-once photos/videos automatically
// ============================================

export default {
  command: 'antiviewonce',
  alias: ['aviewonce', 'viewonce', 'avo'],
  category: 'gb',
  description: 'Reveal view-once photos & videos / toggle auto-reveal',
  usage: '.antiviewonce on/off  OR  reply to a view-once message',

  async execute({ reply, react, args, sock, jid, msg, db, quoted }) {
    const toggle = args[0]?.toLowerCase();

    // ── Toggle mode ────────────────────────────────────────────────
    if (toggle === 'on' || toggle === 'off') {
      const val = toggle === 'on';
      db.settings.setValue('antiViewOnce', val);
      return reply(
        `🔓 *Anti View-Once* is now *${val ? 'ON ✅' : 'OFF ❌'}*\n\n` +
        (val
          ? `Every view-once photo/video sent to the bot will be *automatically revealed* and forwarded back.\n\n📌 Works on DMs. For groups, must be enabled per group.`
          : `View-once messages will remain private.`) +
        `\n\n> 🤖 *Powered by AA MD Bot*`
      );
    }

    // ── Manual: reply to a view-once message ──────────────────────
    const q = quoted?.message || msg?.message;
    const voImage = q?.viewOnceMessage?.message?.imageMessage
                 || q?.viewOnceMessageV2?.message?.imageMessage
                 || q?.viewOnceMessageV2Extension?.message?.imageMessage;
    const voVideo = q?.viewOnceMessage?.message?.videoMessage
                 || q?.viewOnceMessageV2?.message?.videoMessage
                 || q?.viewOnceMessageV2Extension?.message?.videoMessage;
    const voMedia = voImage || voVideo;

    if (!voMedia) {
      const current = db.settings.getValue('antiViewOnce') ?? false;
      return reply(
        `🔓 *Anti View-Once*\n` +
        `Status: *${current ? 'ON ✅' : 'OFF ❌'}*\n\n` +
        `*GB WhatsApp Feature* — Reveal view-once media\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📌 *How to use:*\n` +
        `▸ *.antiviewonce on* — Auto-reveal all view-once msgs\n` +
        `▸ *.antiviewonce off* — Turn off auto-reveal\n` +
        `▸ Reply to a view-once msg with *.antiviewonce* — Reveal that one\n\n` +
        `⚠️ Please use responsibly.\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    }

    await react('⏳');
    try {
      const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
      const fakeMsg = {
        key: quoted?.key || msg?.key,
        message: { viewOnceMessage: q?.viewOnceMessage || q?.viewOnceMessageV2 || q?.viewOnceMessageV2Extension },
      };
      const buffer = await downloadMediaMessage(fakeMsg, 'buffer', {});
      if (!buffer?.length) {
        await react('❌');
        return reply(`❌ Could not reveal — media may have expired.`);
      }
      const caption = `🔓 *View-Once Revealed!*\n\n> 👁️ *Revealed via AA MD Bot*`;
      if (voImage) {
        await sock.sendMessage(jid, { image: buffer, caption, mimetype: voImage.mimetype || 'image/jpeg' });
      } else {
        await sock.sendMessage(jid, { video: buffer, caption, mimetype: voVideo.mimetype || 'video/mp4' });
      }
      await react('✅');
    } catch (err) {
      await react('❌');
      reply(`❌ Failed: ${err.message?.slice(0, 80)}`);
    }
  },
};
