export default {
  command: 'kick',
  alias: ['remove', 'ban'],
  description: 'Kick a member from the group',
  category: 'admin',
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, jid, msg, reply, senderJid }) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!mentions.length) return reply('❌ Mention the user to kick.\nExample: .kick @user');
    try {
      const groupMeta = await sock.groupMetadata(jid);
      const rawBotId = sock.user.id;
      const botId = rawBotId.includes(':') ? rawBotId.split(':')[0] + '@s.whatsapp.net' : rawBotId;
      const norm = id => id?.includes(':') ? id.split(':')[0] + '@s.whatsapp.net' : id;
      const botAdmin = groupMeta.participants.find(p => norm(p.id) === botId)?.admin;
      if (!botAdmin) return reply('❌ I need to be an admin to kick members.');
      for (const jidToKick of mentions) {
        const isAdmin = groupMeta.participants.find(p => p.id === jidToKick)?.admin;
        if (isAdmin) { await reply(`⚠️ @${jidToKick.split('@')[0]} is an admin, cannot kick.`, { mentions: [jidToKick] }); continue; }
        await sock.groupParticipantsUpdate(jid, [jidToKick], 'remove');
        await reply(`✅ @${jidToKick.split('@')[0]} has been kicked!`, { mentions: [jidToKick] });
      }
    } catch (err) {
      reply('❌ Failed to kick. Please try again in a few seconds.');
    }
  },
};
