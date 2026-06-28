// ============================================
// AA MD Bot - Anti View Once + .reveal
// Auto-reveal view-once & manual reveal to private chat
// ============================================

export default {
  command: 'antiviewonce',
  alias: ['aviewonce', 'viewonce', 'avo', 'reveal'],
  category: 'gb',
  description: 'Reveal view-once photos & videos / toggle auto-reveal',
  usage: '.antiviewonce on/off  |  reply to view-once with .antiviewonce  |  .reveal',

  async execute({ reply, react, args, sock, jid, msg, db, quoted, command }) {
    const toggle = args[0]?.toLowerCase();
    const isReveal = command === 'reveal';

    // ── Toggle mode ────────────────────────────────────────────────
    if (!isReveal && (toggle === 'on' || toggle === 'off')) {
      const val = toggle === 'on';
      db.settings.setValue('antiViewOnce', val);
      return reply(
        `🔓 *Anti View-Once* is now *${val ? 'ON ✅' : 'OFF ❌'}*\n\n` +
        (val
          ? `Every view-once photo/video will be:\n` +
            `• *Revealed in the group* (no sender tag)\n` +
            `• *Forwarded to your "You" chat* with sender number + time\n\n` +
            `📌 For groups, enable per-group too: *.antiviewonce on* in that group.`
          : `View-once messages will remain private.`) +
        `\n\n> 🤖 *Powered by AA MD Bot*`
      );
    }

    // ── Manual reveal: reply to a view-once message ───────────────
    const q = quoted?.message || msg?.message;
    const voImage = q?.viewOnceMessage?.message?.imageMessage
                 || q?.viewOnceMessageV2?.message?.imageMessage
                 || q?.viewOnceMessageV2Extension?.message?.imageMessage;
    const voVideo = q?.viewOnceMessage?.message?.videoMessage
                 || q?.viewOnceMessageV2?.message?.videoMessage
                 || q?.viewOnceMessageV2Extension?.message?.videoMessage;
    const voMedia = voImage || voVideo;

    if (!voMedia) {
      if (isReveal) {
        return reply(
          `❌ *Reply to a view-once message* with *.reveal* to reveal it.\n\n` +
          `> 👁️ AA MD Bot`
        );
      }
      const current = db.settings.getValue('antiViewOnce') ?? false;
      return reply(
        `🔓 *Anti View-Once*\n` +
        `Status: *${current ? 'ON ✅' : 'OFF ❌'}*\n\n` +
        `*GB WhatsApp Feature* — Reveal view-once media\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📌 *How to use:*\n` +
        `▸ *.antiviewonce on* — Auto-reveal all view-once msgs\n` +
        `▸ *.antiviewonce off* — Turn off auto-reveal\n` +
        `▸ Reply to a view-once with *.reveal* — Send to your private chat\n\n` +
        `🔒 *Auto behavior:*\n` +
        `▸ Group view-once → revealed in group + forwarded to your "You" chat\n` +
        `▸ DM view-once → forwarded to your "You" chat only (stealth)\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    }

    await react('⏳');
    try {
      const { downloadMediaMessage } = await import('@whiskeysockets/baileys');

      const fakeMsg = {
        key: quoted?.key || msg?.key,
        message: {
          viewOnceMessage:
            q?.viewOnceMessage || q?.viewOnceMessageV2 || q?.viewOnceMessageV2Extension,
        },
      };

      const buffer = await downloadMediaMessage(fakeMsg, 'buffer', {});
      if (!buffer?.length) {
        await react('❌');
        return reply(`❌ Could not reveal — media may have expired.`);
      }

      // Sender info from quoted message key
      const senderJid = quoted?.key?.participant || quoted?.key?.remoteJid || '';
      const num       = senderJid.split('@')[0].split(':')[0] || '?';
      const time      = new Date().toLocaleString('en-PK', {
        timeZone: 'Asia/Karachi',
        hour12: true,
      });
      const inGroup = jid?.endsWith('@g.us');

      // Always send to own "You" chat
      const ownJid = (sock.user?.id || '').replace(/:.*@/, '@') || jid;

      const privateCap =
        `🔓 *View-Once Revealed*\n\n` +
        `👤 *From:* +${num}\n` +
        `🕐 *Time:* ${time}\n` +
        `📍 *Chat:* ${inGroup ? 'Group' : 'DM'}\n\n` +
        `> 👁️ AA MD Bot`;

      if (voImage) {
        await sock.sendMessage(ownJid, {
          image: buffer,
          caption: privateCap,
          mimetype: voImage.mimetype || 'image/jpeg',
        });
      } else {
        await sock.sendMessage(ownJid, {
          video: buffer,
          caption: privateCap,
          mimetype: voVideo.mimetype || 'video/mp4',
        });
      }

      await react('✅');
      await reply(
        `✅ *Revealed!*\n\n` +
        `📤 Forwarded to your *"You"* private chat\n` +
        `👤 Sender: +${num}\n` +
        `🕐 Time: ${time}\n\n` +
        `> 👁️ AA MD Bot`
      );
    } catch (err) {
      await react('❌');
      reply(`❌ Failed: ${err.message?.slice(0, 80)}`);
    }
  },
};
