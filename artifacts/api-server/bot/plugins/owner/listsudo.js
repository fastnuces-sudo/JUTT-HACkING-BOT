export default {
  command: 'listsudo',
  alias: ['sudolist', 'owners'],
  description: 'List all sudo/owner users',
  category: 'owner',
  sudoOnly: true,
  async execute({ reply, db }) {
    const settings = db.settings.get();
    const owners = settings.owners || [];
    const sudo = settings.sudo || [];
    let text = `👑 *Bot Access Control*\n\n`;
    text += `🔴 *Owners (${owners.length}):*\n`;
    text += owners.length ? owners.map((o, i) => `  ${i + 1}. +${o}`).join('\n') : '  None configured';
    text += `\n\n🟡 *Sudo Users (${sudo.length}):*\n`;
    text += sudo.length ? sudo.map((s, i) => `  ${i + 1}. +${s}`).join('\n') : '  None configured';
    reply(text);
  },
};
