export default {
  command: 'groupsettings',
  alias: ['gsettings'],
  description: 'View/manage all group settings',
  category: 'group',
  groupOnly: true,
  adminOnly: true,
  async execute({ reply, jid, db, sock }) {
    const group = db.groups.get(jid);
    let meta;
    try { meta = await sock.groupMetadata(jid); } catch {}
    reply(`⚙️ *Group Settings*\n\n👋 Welcome: ${group.welcome ? '✅' : '❌'}\n🔗 Antilink: ${group.antilink ? '✅' : '❌'}\n🤖 Antibot: ${group.antibot ? '✅' : '❌'}\n🔇 Muted: ${group.muted ? '✅' : '❌'}\n\n🛠️ *Commands:*\n• .welcome on/off\n• .antilink on/off\n• .antibot on/off\n• .mute / .unmute\n• .setwelcome [msg]\n• .setname [name]\n• .setdesc [desc]`);
  },
};
