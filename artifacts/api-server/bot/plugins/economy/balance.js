export default {
  command: 'balance',
  alias: ['bal', 'wallet', 'money'],
  description: 'Check your coin balance',
  category: 'economy',
  async execute({ reply, senderJid, db, msg }) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const target = mentions[0] || senderJid;
    const user = db.users.get(target);
    const isSelf = target === senderJid;
    reply(`💰 *${isSelf ? 'Your' : `@${target.split('@')[0]}'s`} Balance*\n\n💵 Coins: *${(user.balance || 0).toLocaleString()} 🪙*\n⭐ Level: *${user.level || 1}*\n🏆 XP: *${user.xp || 0}*\n📊 Commands Used: *${user.commandsUsed || 0}*`, mentions.length ? { mentions: [target] } : {});
  },
};
