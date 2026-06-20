export default {
  command: 'rank',
  alias: ['level', 'lvl', 'profile'],
  description: 'Check your rank and level',
  category: 'level',
  async execute({ reply, senderJid, msg, db }) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const target = mentions[0] || senderJid;
    const user = db.users.get(target);
    const isSelf = target === senderJid;

    const level = user.level || 1;
    const xp = user.xp || 0;
    const nextLevelXP = Math.pow((level / 0.1), 2);
    const currentLevelXP = level > 1 ? Math.pow(((level - 1) / 0.1), 2) : 0;
    const progress = Math.floor(((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 10);
    const bar = '█'.repeat(Math.max(0, progress)) + '░'.repeat(Math.max(0, 10 - progress));

    const allUsers = Object.values(db.users.all()).sort((a, b) => (b.xp || 0) - (a.xp || 0));
    const rankPos = allUsers.findIndex(u => u.id === target) + 1;

    reply(`⭐ *${isSelf ? 'Your' : `${user.name || target.split('@')[0]}'s`} Profile*\n\n🏆 Rank: *#${rankPos}*\n📊 Level: *${level}*\n✨ XP: *${xp.toLocaleString()}*\n\n[${bar}] ${progress * 10}%\nProgress: *${Math.max(0, xp - currentLevelXP).toLocaleString()} / ${Math.floor(nextLevelXP - currentLevelXP).toLocaleString()} XP*\n\n💰 Balance: *${(user.balance || 0).toLocaleString()} 🪙*\n📱 Commands: *${user.commandsUsed || 0}*\n${user.dailyStreak ? `🔥 Daily Streak: *${user.dailyStreak} days*` : ''}`, mentions.length ? { mentions: [target] } : {});
  },
};
