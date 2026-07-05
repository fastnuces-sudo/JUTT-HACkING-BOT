// ============================================
// AA MD Bot - Anti View Once + .reveal
// Auto-reveal view-once & manual reveal to private "You" chat
// Uses voCache for reliable .reveal (quoted copies have no valid media keys)
// NOTE: This is the ONLY plugin that should own antiviewonce/reveal/viewonce
// commands. Do not add duplicate plugins for these — command names are
// first-come-first-served in the plugin loader, and duplicates silently
// shadow each other causing hard-to-diagnose behavior (e.g. reveal posting
// in the wrong chat, or the toggle writing to a settings key nobody reads).
// ============================================

import { voCacheGet, voCacheHas } from '../../lib/voCache.js';
import logger from '../../lib/logger.js';

export default {
  command: 'antiviewonce',
  alias: ['aviewonce', 'viewonce', 'avo', 'reveal', 'rv', 'unviewonce', 'antiview', 'noviewonce'],
  category: 'gb',
  description: 'Reveal view-once photos & videos / toggle auto-reveal',
  usage: '.antiviewonce on/off  |  reply to view-once with .reveal',

  async execute({ reply, react, args, sock, jid, msg, db, quoted, ownJid, command, isOwner, isGroupMsg }) {
    const toggle = args[0]?.toLowerCase();
    const isReveal = command === 'reveal' || command === 'rv' || command === 'unviewonce';

    // ── Toggle mode ────────────────────────────────────────────────
    if (!isReveal && (toggle === 'on' || toggle === 'off')) {
      const val = toggle === 'on';

      if (isGroupMsg) {
        const group = db.groups.get(jid) || {};
        db.groups.set(jid, { ...group, antiviewonce: val });
        return reply(
          `👁️ *Anti View-Once* is now *${val ? 'ON ✅' : 'OFF ❌'}* for this group.\n` +
          (val
            ? 'View-once photos/videos sent here will be revealed automatically.'
            : 'View-once media will stay hidden in this group.')
        );
      }

      // DM — owner only for the global setting
      if (!isOwner) {
        return reply('⚠️ Only the bot owner can set global anti-view-once from DM.');
      }

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
        logger.warn({ quotedId, hasIt: voCacheHas(quotedId) }, '.reveal: quoted message ID not found in voCache');
        return reply(
          `❌ *Media not in cache* — this view-once may have arrived before the bot started, or cache expired.\n\n` +
          `💡 Make sure *.antiviewonce on* is enabled so future view-once messages are auto-cached.\n\n` +
          `> 👁️ AA MD Bot`
        );
      }

      await react('⏳');
      try {
        // Same method as antidelete: extract pure number from sock.user.id
        // sock.user.id = "923xxxxxxxx:5@s.whatsapp.net" → split → "923xxxxxxxx"
        const selfNum = sock.user?.id?.split('@')[0]?.split(':')[0];
        const dest    = selfNum ? `${selfNum}@s.whatsapp.net` : null;

        if (!dest) {
          await react('❌');
          return reply('❌ Bot not fully connected yet — please wait a moment and try again.');
        }
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
        reply('❌ Failed to reveal. Please try again in a few seconds.');
      }
      return;
    }

    // ── Status / help ──────────────────────────────────────────────
    const current = isGroupMsg
      ? (db.groups.get(jid)?.antiviewonce ?? db.settings.getValue('antiViewOnce') ?? false)
      : (db.settings.getValue('antiViewOnce') ?? false);
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
