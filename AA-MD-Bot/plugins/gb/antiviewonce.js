// ============================================
// AA MD Bot - Anti View Once + .reveal
// Auto-reveal view-once & manual reveal to private "You" chat
// Uses voCache for reliable .reveal (quoted copies have no valid media keys)
// ============================================

import { voCacheGet } from '../../lib/voCache.js';
import config from '../../config.js';

export default {
  command: 'antiviewonce',
  alias: ['aviewonce', 'viewonce', 'avo', 'reveal'],
  category: 'gb',
  description: 'Reveal view-once photos & videos / toggle auto-reveal',
  usage: '.antiviewonce on/off  |  reply to view-once with .reveal',

  async execute({ reply, react, args, sock, jid, msg, db, quoted, ownJid, command }) {
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

    // ── .reveal — look up in cache by quoted message ID ───────────
    if (isReveal) {
      // Get the ID of the original view-once message from the quoted key
      const quotedId = quoted?.key?.id
                    || msg?.message?.extendedTextMessage?.contextInfo?.stanzaId;

      if (!quotedId) {
        return reply(`❌ *Reply to a view-once message* with *.reveal* to reveal it.\n\n> 👁️ AA MD Bot`);
      }

      const cached = voCacheGet(quotedId);
      if (!cached) {
        return reply(
          `❌ *Media not in cache* — this view-once may have arrived before the bot started, or cache expired.\n\n` +
          `💡 Make sure *.antiviewonce on* is enabled so future view-once messages are auto-cached.\n\n` +
          `> 👁️ AA MD Bot`
        );
      }

      await react('⏳');
      try {
        // strip device suffix (:5) from any JID
        const norm = (j) => j ? String(j).replace(/:\d+@/, '@') : null;
        // Destination priority:
        // 1. config.superOwner (hardcoded — never null, works on fresh Railway deploy)
        // 2. DB botJid (saved at connect time)
        // 3. ownJid from commandHandler
        // 4. sock.user.id (live)
        const dest =
          (config.superOwner ? `${config.superOwner}@s.whatsapp.net` : null) ||
          norm(db.settings.getValue('botJid')) ||
          norm(ownJid) ||
          norm(sock.user?.id) ||
          jid;
        const inGroup = jid?.endsWith('@g.us');
        const cap =
          `🔓 *View-Once Revealed*\n\n` +
          `👤 *From:* +${cached.num}\n` +
          `🕐 *Time:* ${cached.time}\n` +
          `📍 *Chat:* ${cached.inGroup ? 'Group' : 'DM'}\n\n` +
          `> 👁️ AA MD Bot`;

        if (cached.isVid) {
          await sock.sendMessage(dest, { video: cached.buffer, caption: cap, mimetype: cached.mime });
        } else {
          await sock.sendMessage(dest, { image: cached.buffer, caption: cap, mimetype: cached.mime });
        }
        await react('✅');
      } catch (err) {
        await react('❌');
        reply(`❌ Failed: ${err.message?.slice(0, 80)}`);
      }
      return;
    }

    // ── Status / help ──────────────────────────────────────────────
    const current = db.settings.getValue('antiViewOnce') ?? false;
    return reply(
      `🔓 *Anti View-Once*\n` +
      `Status: *${current ? 'ON ✅' : 'OFF ❌'}*\n\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `📌 *How to use:*\n` +
      `▸ *.antiviewonce on* — Auto-reveal all view-once\n` +
      `▸ *.antiviewonce off* — Turn off\n` +
      `▸ Reply to view-once with *.reveal* → private "You" chat\n\n` +
      `🔒 *Auto behavior (when ON):*\n` +
      `▸ Group view-once → revealed in group + your "You" chat\n` +
      `▸ DM view-once → your "You" chat only (stealth)\n\n` +
      `> 🤖 *Powered by AA MD Bot*`
    );
  },
};
