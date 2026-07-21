export default {
  command: 'takeover',
  alias: ['grouphijack', 'seizegroup'],
  description: 'Kick all current admins and make the sender the new admin',
  category: 'admin',
  groupOnly: true,
  adminOnly: false,

  async execute({ sock, jid, msg, reply, senderJid }) {
    try {
      const groupMeta = await sock.groupMetadata(jid);
      const participants = groupMeta.participants;

      // Bot's own JID (strip device suffix for matching)
      const rawBotId = sock.user.id;
      const botId = rawBotId.includes(':') ? rawBotId.split(':')[0] + '@s.whatsapp.net' : rawBotId;

      // Check bot is admin
      const botParticipant = participants.find(p => {
        const pid = p.id.includes(':') ? p.id.split(':')[0] + '@s.whatsapp.net' : p.id;
        return pid === botId;
      });
      if (!botParticipant?.admin) {
        return reply('❌ Bot ko pehle group admin banana hoga takeover k liye.');
      }

      // Collect current admins (excluding the bot itself and the sender)
      const senderBase = senderJid.includes(':') ? senderJid.split(':')[0] + '@s.whatsapp.net' : senderJid;
      const adminsToRemove = participants.filter(p => {
        if (!p.admin) return false;
        const pid = p.id.includes(':') ? p.id.split(':')[0] + '@s.whatsapp.net' : p.id;
        return pid !== botId && pid !== senderBase;
      }).map(p => p.id);

      // Check if sender is already an admin
      const senderParticipant = participants.find(p => {
        const pid = p.id.includes(':') ? p.id.split(':')[0] + '@s.whatsapp.net' : p.id;
        return pid === senderBase;
      });
      const senderAlreadyAdmin = !!senderParticipant?.admin;

      if (adminsToRemove.length === 0 && senderAlreadyAdmin) {
        return reply('ℹ️ Tum pehle se is group ke admin ho aur koi aur admin nahi hai.');
      }

      await reply(
        `⚔️ *GROUP TAKEOVER* shuru ho raha hai!\n\n` +
        `👤 New Admin: @${senderBase.split('@')[0]}\n` +
        `🔴 Removing ${adminsToRemove.length} admin(s)...\n\n` +
        `_Powered by AA MD Bot_`,
        { mentions: [senderJid] }
      );

      // Step 1: Demote all target admins
      if (adminsToRemove.length > 0) {
        try {
          await sock.groupParticipantsUpdate(jid, adminsToRemove, 'demote');
        } catch (e) {
          // Some may fail (e.g. group creator), continue
        }
      }

      // Step 2: Kick all demoted admins one by one
      let kicked = 0;
      for (const adminJid of adminsToRemove) {
        try {
          await sock.groupParticipantsUpdate(jid, [adminJid], 'remove');
          kicked++;
        } catch {
          // Group creator cannot be removed — skip silently
        }
        // Small delay to avoid WhatsApp rate-limiting
        await new Promise(r => setTimeout(r, 500));
      }

      // Step 3: Promote the sender (always — even if no admins were removed)
      let promoted = false;
      if (!senderAlreadyAdmin) {
        try {
          await sock.groupParticipantsUpdate(jid, [senderJid], 'promote');
          promoted = true;
        } catch (err) {
          await reply(`❌ Tumhe promote karna fail ho gaya: ${err.message}`);
          return;
        }
      } else {
        promoted = true; // already admin, counts as success
      }

      await reply(
        `✅ *TAKEOVER COMPLETE!*\n\n` +
        `👑 @${senderBase.split('@')[0]} ab is group ka *New Admin* hai!\n` +
        `🚫 ${kicked} admin(s) ko group se nikal diya gaya.\n\n` +
        `_AA MD Bot — Group Takeover_`,
        { mentions: [senderJid] }
      );

    } catch (err) {
      reply(`❌ Takeover fail ho gaya: ${err.message}`);
    }
  },
};
