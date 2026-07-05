// ============================================
// AA MD Bot - Privacy Settings Viewer
// Shows current WhatsApp privacy settings
// ============================================

export default {
  command: 'privacy',
  alias: ['myprivacy', 'privacysettings'],
  description: 'View current WhatsApp privacy settings',
  category: 'owner',
  ownerOnly: true,

  async execute({ reply, react, sock, jid, msg }) {
    await react('🔒');

    try {
      const ps = await sock.fetchPrivacySettings(true);
      const name = sock.user?.name || 'Bot';

      let avatar = null;
      try { avatar = await sock.profilePictureUrl(sock.user.id, 'image'); } catch {}

      const caption =
        `🔒 *Privacy Settings*\n\n` +
        `👤 *Account:* ${name}\n` +
        `${'─'.repeat(28)}\n` +
        `🟢 *Online Status:* ${ps.online ?? 'N/A'}\n` +
        `📷 *Profile Photo:* ${ps.profile ?? 'N/A'}\n` +
        `🕐 *Last Seen:* ${ps.last ?? 'N/A'}\n` +
        `✅ *Read Receipts:* ${ps.readreceipts ?? 'N/A'}\n` +
        `💬 *Status:* ${ps.status ?? 'N/A'}\n` +
        `👥 *Group Add:* ${ps.groupadd ?? 'N/A'}\n` +
        `📞 *Call Add:* ${ps.calladd ?? 'N/A'}\n\n` +
        `> 🔒 *AA MD Bot*`;

      if (avatar) {
        await sock.sendMessage(jid, { image: { url: avatar }, caption }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: caption }, { quoted: msg });
      }

      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ Failed to fetch privacy settings: ${e.message}\n\n> 🔒 *AA MD Bot*`);
    }
  },
};
