export default {
  command: 'welcome',
  alias: ['setwelcome2', 'welcometoggle'],
  description: 'Toggle welcome message in group',
  category: 'group',
  groupOnly: true,
  adminOnly: true,
  async execute({ reply, jid, args, db }) {
    const group = db.groups.get(jid);
    const action = args[0]?.toLowerCase();
    if (action === 'on') {
      db.groups.set(jid, { welcome: true });
      return reply(`✅ Welcome message is now *ON*\n\n📝 Current message:\n${group.welcomeMsg || 'Welcome @user!'}\n\nChange it with: .setwelcome [message]`);
    }
    if (action === 'off') {
      db.groups.set(jid, { welcome: false });
      return reply('❌ Welcome message is now *OFF*');
    }
    reply(`👋 *Welcome Settings*\n\n📊 Status: ${group.welcome ? '✅ ON' : '❌ OFF'}\n📝 Message: ${group.welcomeMsg || 'Welcome @user!'}\n\nUsage: .welcome on/off`);
  },
};
