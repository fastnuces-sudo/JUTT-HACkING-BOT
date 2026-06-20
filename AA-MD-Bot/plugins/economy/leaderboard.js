export default {
  command: 'leaderboard',
  alias: ['top', 'lb', 'richest'],
  description: 'Show top richest users',
  category: 'economy',
  async execute({ reply, args, db }) {
    const users = Object.values(db.users.all());
    const type = args[0]?.toLowerCase() || 'coins';

    let sorted, title;
    if (type === 'xp' || type === 'level') {
      sorted = users.sort((a, b) => (b.xp || 0) - (a.xp || 0));
      title = '⭐ Top Users by XP';
    } else {
      sorted = users.sort((a, b) => (b.balance || 0) - (a.balance || 0));
      title = '💰 Top Richest Users';
    }

    const top = sorted.slice(0, 10);
    const medals = ['🥇', '🥈', '🥉'];
    let text = `${title}\n\n`;
    top.forEach((u, i) => {
      const medal = medals[i] || `${i + 1}.`;
      const display = u.name || `+${u.id?.split('@')[0]}` || 'Unknown';
      if (type === 'xp' || type === 'level') {
        text += `${medal} ${display}\n   ⭐ ${(u.xp || 0).toLocaleString()} XP | Lv.${u.level || 1}\n\n`;
      } else {
        text += `${medal} ${display}\n   💵 ${(u.balance || 0).toLocaleString()} 🪙\n\n`;
      }
    });
    if (!top.length) text += 'No users found yet!';
    reply(text.trim());
  },
};
