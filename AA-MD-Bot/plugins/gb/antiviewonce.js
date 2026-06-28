// ============================================
// AA MD Bot - Anti View Once + .reveal
// Auto-reveal view-once & manual reveal to private "You" chat
// ============================================

export default {
  command: 'antiviewonce',
  alias: ['aviewonce', 'viewonce', 'avo', 'reveal'],
  category: 'gb',
  description: 'Reveal view-once photos & videos / toggle auto-reveal',
  usage: '.antiviewonce on/off  |  reply to view-once with .reveal',

  async execute({ reply, react, args, sock, jid, msg, db, quoted, ownJid, command }) {
    const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
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
            `• *Revealed in group* (no sender tag)\n` +
            `• *Forwarded to your "You" chat* with sender number + time\n\n` +
            `📌 For groups, enable per-group too.`
          : `View-once messages will remain private.`) +
        `\n\n> 🤖 *Powered by AA MD Bot*`
      );
    }

    // ── Extract view-once from quoted message ──────────────────────
    // quoted is passed from commandHandler (built from contextInfo)
    const q = quoted?.message;

    const voImage = q?.viewOnceMessage?.message?.imageMessage
                 || q?.viewOnceMessageV2?.message?.imageMessage
                 || q?.viewOnceMessageV2Extension?.message?.imageMessage;
    const voVideo = q?.viewOnceMessage?.message?.videoMessage
                 || q?.viewOnceMessageV2?.message?.videoMessage
                 || q?.viewOnceMessageV2Extension?.message?.videoMessage;
    const voMedia = voImage || voVideo;

    if (!voMedia) {
      if (isReveal) {
        return reply(`❌ *Reply to a view-once message* with *.reveal* to reveal it.\n\n> 👁️ AA MD Bot`);
      }
      const current = db.settings.getValue('antiViewOnce') ?? false;
      return reply(
        `🔓 *Anti View-Once*\n` +
        `Status: *${current ? 'ON ✅' : 'OFF ❌'}*\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📌 *How to use:*\n` +
        `▸ *.antiviewonce on* — Auto-reveal all view-once\n` +
        `▸ *.antiviewonce off* — Turn off\n` +
        `▸ Reply to view-once with *.reveal* → private chat\n\n` +
        `🔒 *Auto behavior (when ON):*\n` +
        `▸ Group view-once → revealed in group + your "You" chat\n` +
        `▸ DM view-once → your "You" chat only (stealth)\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    }

    await react('⏳');
    try {
      // Build a proper fake message for downloadMediaMessage
      const voKey = q?.viewOnceMessage || q?.viewOnceMessageV2 || q?.viewOnceMessageV2Extension;
      const fakeMsg = {
        key: quoted?.key || msg?.key,
        message: { viewOnceMessageV2: { message: voKey?.message || voKey } },
      };

      const buffer = await downloadMediaMessage(
        fakeMsg, 'buffer', {},
        { reuploadRequest: sock.updateMediaMessage }
      ).catch(() => null);

      if (!buffer?.length) {
        await react('❌');
        return reply(`❌ Could not reveal — media may have expired.`);
      }

      const mime = (voImage || voVideo)?.mimetype || (voImage ? 'image/jpeg' : 'video/mp4');
      const isVid = !!voVideo;

      // Sender info from quoted key
      const senderJid = quoted?.key?.participant || quoted?.key?.remoteJid || '';
      const num  = senderJid.split('@')[0].split(':')[0] || '?';
      const time = new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi', hour12: true });
      const inGroup = jid?.endsWith('@g.us');

      // Target: bot's own "You" private chat
      const dest = ownJid || jid;

      const cap =
        `🔓 *View-Once Revealed*\n\n` +
        `👤 *From:* +${num}\n` +
        `🕐 *Time:* ${time}\n` +
        `📍 *Chat:* ${inGroup ? 'Group' : 'DM'}\n\n` +
        `> 👁️ AA MD Bot`;

      if (isVid) {
        await sock.sendMessage(dest, { video: buffer, caption: cap, mimetype: mime });
      } else {
        await sock.sendMessage(dest, { image: buffer, caption: cap, mimetype: mime });
      }

      // Only react in current chat — no text reply (keeps it clean/stealthy)
      await react('✅');

    } catch (err) {
      await react('❌');
      reply(`❌ Failed: ${err.message?.slice(0, 80)}`);
    }
  },
};
