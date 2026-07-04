
export default {
  command: 'groupinfo',
  alias: ['ginfo', 'gcinfo'],
  description: 'Get detailed group information',
  category: 'admin',
  groupOnly: true,
  async execute({ sock, jid, reply }) {
    try {
      const meta = await sock.groupMetadata(jid);
      const admins = meta.participants.filter(p => p.admin).map(p => `@${p.id.split('@')[0]}`);
      const members = meta.participants.length;
      const created = new Date(meta.creation * 1000).toLocaleDateString();
      reply(`👥 *Group Information*\n\n📛 Name: *${meta.subject}*\n🆔 ID: \`${jid}\`\n📝 Description: ${meta.desc || 'None'}\n👑 Owner: @${(meta.owner || '').split('@')[0]}\n👮 Admins: ${admins.length}\n👥 Members: *${members}*\n📅 Created: ${created}\n🔒 Settings: ${meta.announce ? 'Admins only' : 'Everyone'}`);
    } catch (err) {
      reply('❌ Failed to fetch group info. Please try again in a few seconds.');
    }
  },
};
