export default {
  command: 'levelinfo',
  alias: ['lvlinfo', 'xpinfo'],
  description: 'Show XP needed for next level',
  category: 'level',
  async execute({ reply, senderJid, db }) {
    const user = db.users.get(senderJid);
    const level = user.level || 1;
    const xp = user.xp || 0;

    const levelTable = [];
    for (let l = level; l <= level + 5; l++) {
      const required = Math.pow((l / 0.1), 2);
      levelTable.push(`Lv.${l} → Lv.${l + 1}: *${Math.floor(required - xp > 0 ? required - xp : 0).toLocaleString()} XP needed*`);
    }

    reply(`📈 *Level Progress*\n\n📊 Current Level: *${level}*\n⭐ Current XP: *${xp.toLocaleString()}*\n\n🗺️ *Roadmap:*\n${levelTable.join('\n')}\n\n💡 Earn XP by:\n• Sending messages (+${5} XP)\n• Using commands (+${10} XP)`);
  },
};
