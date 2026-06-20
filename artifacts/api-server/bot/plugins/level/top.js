export default {
  command: 'top',
  alias: ['topxp', 'toplevel'],
  description: 'Show top users by level and XP',
  category: 'level',
  async execute({ reply, db }) {
    const users = Object.values(db.users.all())
      .filter(u => u.xp > 0)
      .sort((a, b) => (b.xp || 0) - (a.xp || 0))
      .slice(0, 10);

    if (!users.length) return reply('📊 No ranked users yet! Start chatting to earn XP.');

    const medals = ['🥇', '🥈', '🥉'];
    let text = `🏆 *Top Users Leaderboard*\n\n`;
    users.forEach((u, i) => {
      const m = medals[i] || `${i + 1}.`;
      const name = u.name || `+${u.id?.split('@')[0]}` || 'Unknown';
      text += `${m} *${name}*\n   📊 Lv.${u.level || 1} | ⭐ ${(u.xp || 0).toLocaleString()} XP\n\n`;
    });
    reply(text.trim());
  },
};
