export default {
  command: 'setwelcome',
  alias: ['welcomemsg'],
  description: 'Set custom welcome message',
  category: 'admin',
  groupOnly: true,
  adminOnly: true,
  async execute({ reply, jid, args, text, db }) {
    const group = db.groups.get(jid);
    if (args[0] === 'off') {
      db.groups.set(jid, { welcome: false });
      return reply('👋 Welcome message is now *OFF*.');
    }
    if (!text) return reply('❌ Usage: .setwelcome [message]\nVariables: @user, @group\nOr: .setwelcome off');
    db.groups.set(jid, { welcome: true, welcomeMsg: text });
    reply(`✅ Welcome message set!\n\n📝 Preview:\n${text.replace('@user', 'NewMember').replace('@group', 'This Group')}`);
  },
};
