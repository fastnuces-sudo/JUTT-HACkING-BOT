import moment from 'moment-timezone';

export default {
  command: 'daily',
  alias: ['claim', 'dailyreward'],
  description: 'Claim your daily coins reward',
  category: 'economy',
  async execute({ reply, senderJid, db }) {
    const user = db.users.get(senderJid);
    const now = moment();
    const lastClaim = user.lastDaily ? moment(user.lastDaily) : null;

    if (lastClaim && now.diff(lastClaim, 'hours') < 20) {
      const nextClaim = lastClaim.clone().add(20, 'hours');
      const remaining = nextClaim.diff(now, 'minutes');
      const h = Math.floor(remaining / 60);
      const m = remaining % 60;
      return reply(`⏰ You already claimed today!\n\n⏳ Next claim in: *${h}h ${m}m*`);
    }

    const streak = lastClaim && now.diff(lastClaim, 'hours') < 44 ? (user.dailyStreak || 0) + 1 : 1;
    const bonusMultiplier = Math.min(streak, 7);
    const baseAmount = 500;
    const bonus = (bonusMultiplier - 1) * 100;
    const total = baseAmount + bonus;

    db.users.addBalance(senderJid, total);
    db.users.set(senderJid, { lastDaily: Date.now(), dailyStreak: streak });

    const newBalance = db.users.get(senderJid).balance;
    reply(`🎁 *Daily Reward Claimed!*\n\n💵 Base: *+${baseAmount} 🪙*\n🔥 Streak Bonus (Day ${streak}): *+${bonus} 🪙*\n✅ Total: *+${total} 🪙*\n\n💰 New Balance: *${newBalance.toLocaleString()} 🪙*\n🔥 Streak: *${streak} ${streak >= 7 ? '🌟 MAX!' : 'days'}*\n\nCome back in 20 hours for more!`);
  },
};
