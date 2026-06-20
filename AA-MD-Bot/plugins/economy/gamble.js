export default {
  command: 'gamble',
  alias: ['bet', 'casino', 'slot'],
  description: 'Gamble your coins at the casino',
  category: 'economy',
  async execute({ reply, senderJid, args, db }) {
    const amount = parseInt(args[0]);
    if (!amount || amount < 10) return reply('❌ Usage: .gamble [amount]\nMinimum: 10 🪙');
    const user = db.users.get(senderJid);
    if ((user.balance || 0) < amount) return reply(`❌ Not enough coins!\nYour balance: *${user.balance || 0} 🪙*`);

    const slots = ['🍒', '🍋', '🍊', '🍇', '🍓', '💎', '7️⃣', '🎰'];
    const s1 = slots[Math.floor(Math.random() * slots.length)];
    const s2 = slots[Math.floor(Math.random() * slots.length)];
    const s3 = slots[Math.floor(Math.random() * slots.length)];
    const roll = `[ ${s1} | ${s2} | ${s3} ]`;

    let result, earned;
    if (s1 === s2 && s2 === s3) {
      if (s1 === '💎') { result = 'JACKPOT! 💎'; earned = amount * 10; }
      else if (s1 === '7️⃣') { result = 'TRIPLE 7! 🎉'; earned = amount * 5; }
      else { result = 'Three of a kind! 🎊'; earned = amount * 3; }
    } else if (s1 === s2 || s2 === s3 || s1 === s3) {
      result = 'Two of a kind!'; earned = Math.floor(amount * 1.5);
    } else {
      result = 'No match 😞'; earned = -amount;
    }

    if (earned > 0) {
      db.users.addBalance(senderJid, earned);
    } else {
      db.users.deductBalance(senderJid, amount);
    }

    const newBalance = db.users.get(senderJid).balance;
    reply(`🎰 *Casino Slot Machine*\n\n${roll}\n\n${result}\n${earned > 0 ? `✅ Won: *+${earned} 🪙*` : `❌ Lost: *-${amount} 🪙*`}\n💰 Balance: *${newBalance.toLocaleString()} 🪙*`);
  },
};
