export default {
  command: 'admins',
  alias: ['listadmins', 'adminlist'],
  description: 'List all group admins',
  category: 'admin',
  groupOnly: true,
  async execute({ sock, jid, msg, reply }) {
    try {
      const meta   = await sock.groupMetadata(jid);
      const admins = meta.participants.filter(p => p.admin);
      if (!admins.length) return reply('❌ No admins found in this group.');

      const list = admins.map((p, i) => {
        const num  = p.id.split('@')[0];
        const role = p.admin === 'superadmin' ? '👑 Owner' : '🛡️ Admin';
        return `${i + 1}. @${num} — ${role}`;
      }).join('\n');

      await sock.sendMessage(jid, {
        text: `🛡️ *${meta.subject} — Admins*\n\n${list}\n\n📊 *Total:* ${admins.length} admin(s)`,
        mentions: admins.map(p => p.id),
      }, { quoted: msg });
    } catch {
      reply('❌ Failed to fetch admins. Try again.');
    }
  },
};
