export default {
  command: 'xp',
  alias: ['givexp', 'addxp'],
  description: 'Give XP to a user (sudo only)',
  category: 'level',
  sudoOnly: true,
  async execute({ reply, msg, args, db }) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!mentions.length || !args[1]) return reply('❌ Usage: .xp @user [amount]');
    const target = mentions[0];
    const amount = parseInt(args[1]);
    if (!amount || amount < 1) return reply('❌ Invalid XP amount');
    const result = db.users.addXP(target, amount);
    reply(`✅ Added *${amount} XP* to @${target.split('@')[0]}\n\n⭐ XP: *${result.xp.toLocaleString()}*\n📊 Level: *${result.level}*${result.leveled ? '\n🎉 *LEVEL UP!*' : ''}`, { mentions: [target] });
  },
};
