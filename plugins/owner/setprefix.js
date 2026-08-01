import { saveNow } from '../../lib/database.js';

export default {
  command: 'setprefix',
  alias: ['prefix'],
  description: 'Change bot command prefix',
  category: 'owner',
  ownerOnly: true,
  async execute({ reply, args, db }) {
    if (!args[0]) {
      const current = db.settings.getValue('prefix') || ['.'];
      return reply(`🔧 *Current Prefix:* ${current.join(', ')}\n\nUsage: .setprefix [new prefix]`);
    }
    const newPrefix = args[0];
    db.settings.setValue('prefix', [newPrefix]);
    await saveNow('settings');
    reply(`✅ Prefix changed to: *${newPrefix}*\n\nNow use *${newPrefix}menu* to see commands.`);
  },
};
