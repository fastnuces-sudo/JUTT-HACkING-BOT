import { saveNow } from '../../lib/database.js';

export default {
  command: 'banuser',
  alias: ['botban'],
  description: 'Ban/unban a user from bot',
  category: 'owner',
  ownerOnly: true,
  superOwnerOnly: true,
  async execute({ reply, args, msg, db }) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const target = mentions[0] || (args[1] ? `${args[1].replace(/[^0-9]/g, '')}@s.whatsapp.net` : null);
    if (!target) return reply('❌ Usage: .banuser ban @user\n.banuser unban @user');

    const action = args[0]?.toLowerCase() || 'ban';
    const banned = db.settings.getValue('bannedUsers') || [];

    if (action === 'unban') {
      const filtered = banned.filter(b => b !== target && b !== target.split('@')[0]);
      db.settings.setValue('bannedUsers', filtered);
      await saveNow('settings');
      reply(`✅ @${target.split('@')[0]} has been *unbanned*.`, { mentions: [target] });
    } else {
      if (!banned.includes(target)) banned.push(target);
      db.settings.setValue('bannedUsers', banned);
      await saveNow('settings');
      reply(`⛔ @${target.split('@')[0]} has been *banned* from the bot.`, { mentions: [target] });
    }
  },
};
