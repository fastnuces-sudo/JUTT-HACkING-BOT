export default {
  command: 'getpp',
  alias: ['spp', 'pfp', 'profile'],
  description: "Get a user's profile picture",
  category: 'group',
  async execute({ sock, jid, msg, reply, senderJid }) {
    // Target: mentioned user → quoted user → self
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
    const quoted    = msg.message?.extendedTextMessage?.contextInfo?.participant;
    const target    = mentioned?.[0] || quoted || senderJid;

    const num = target.split('@')[0];

    try {
      const pp = await sock.profilePictureUrl(target, 'image').catch(() => null);
      if (!pp) return reply(`❌ No profile picture found for @${num}\n(Privacy settings may be blocking it.)`);

      await sock.sendMessage(jid, {
        image:   { url: pp },
        caption: `🖼️ *Profile Picture*\n\n📱 *Number:* +${num}`,
        mentions: [target],
      }, { quoted: msg });
    } catch {
      reply(`❌ Could not fetch profile picture for +${num}`);
    }
  },
};
