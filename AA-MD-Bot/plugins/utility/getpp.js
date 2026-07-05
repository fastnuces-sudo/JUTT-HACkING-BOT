// ============================================
// AA MD Bot - Get Profile Picture
// Developer: Ahsan Ali | AA Mods
// ============================================

export default {
  command: 'getpp',
  alias: ['spp', 'pfp', 'profilepic', 'dp'],
  description: 'Get profile picture of any WhatsApp user. Reply to a message or pass a number.',
  category: 'utility',

  async execute({ sock, msg, jid, senderJid, args, reply, react, send }) {
    await react('🖼️');

    // Determine target JID
    let targetJid = null;

    // 1. Check if replying to a message
    const ctxInfo = msg.message?.extendedTextMessage?.contextInfo
                 || msg.message?.imageMessage?.contextInfo
                 || msg.message?.videoMessage?.contextInfo;
    const quotedParticipant = ctxInfo?.participant || ctxInfo?.remoteJid;

    if (quotedParticipant) {
      targetJid = quotedParticipant;
    } else if (args[0]) {
      // 2. Phone number provided
      const num = args[0].replace(/\D/g, '');
      targetJid = `${num}@s.whatsapp.net`;
    } else {
      // 3. Own profile
      targetJid = senderJid;
    }

    try {
      const ppUrl = await sock.profilePictureUrl(targetJid, 'image');
      if (!ppUrl) throw new Error('no pp');

      const caption =
        `🖼️ *Profile Picture*\n\n` +
        `👤 *User:* ${targetJid.split('@')[0]}\n\n` +
        `> 🤖 *AA MD Bot*`;

      await sock.sendMessage(jid, { image: { url: ppUrl }, caption }, { quoted: msg });
    } catch {
      return reply(
        `❌ *No profile picture found*\n\n` +
        `The user may have hidden their DP or it doesn't exist.\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }
  },
};
