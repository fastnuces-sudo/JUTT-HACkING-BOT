export default {
  command: 'banuser',
  alias: ['botban'],
  description: 'Ban/unban a user from bot (owner only)',
  category: 'owner',
  ownerOnly: true,
  async execute({ reply, args, msg, db }) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const target = mentions[0] || (args[1] ? `${args[1].replace(/[^0-9]/g, '')}@s.whatsapp.net` : null);
    if (!target) return reply('❌ Usage: .banuser @user or .banuser ban/unban number');
    const action = args[0]?.toLowerCase() || 'ban';
    const user = db.users.get(target);
    if (action === 'unban') {
      db.users.set(target, { banned: false });
      reply(`✅ @${target.split('@')[0]} has been *unbanned* from the bot.`, { mentions: [target] });
    } else {
      db.users.set(target, { banned: true });
      reply(`⛔ @${target.split('@')[0]} has been *banned* from using the bot.`, { mentions: [target] });
    }
  },
};
