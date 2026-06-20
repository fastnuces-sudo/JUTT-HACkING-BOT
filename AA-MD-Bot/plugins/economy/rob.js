const robCooldowns = new Map();

export default {
  command: 'rob',
  alias: ['steal', 'heist'],
  description: 'Try to rob another user',
  category: 'economy',
  async execute({ reply, senderJid, msg, db }) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!mentions.length) return reply('❌ Mention who to rob!\nExample: .rob @user');
    const target = mentions[0];
    if (target === senderJid) return reply('❌ You can\'t rob yourself!');

    const now = Date.now();
    const lastRob = robCooldowns.get(senderJid);
    if (lastRob && now - lastRob < 60 * 60 * 1000) {
      const remaining = Math.ceil((60 * 60 * 1000 - (now - lastRob)) / 60000);
      return reply(`⏰ You're on the run!\n\n⏳ Rob again in: *${remaining} minutes*`);
    }

    const robber = db.users.get(senderJid);
    const victim = db.users.get(target);

    if ((victim.balance || 0) < 100) return reply(`💸 @${target.split('@')[0]} is too broke to rob! (< 100 🪙)`, { mentions: [target] });

    robCooldowns.set(senderJid, now);
    const success = Math.random() > 0.45;

    if (success) {
      const stolen = Math.floor(Math.random() * Math.min(victim.balance * 0.3, 500)) + 50;
      db.users.deductBalance(target, stolen);
      db.users.addBalance(senderJid, stolen);
      reply(`🦹 *Successful Heist!*\n\n💰 You stole *${stolen} 🪙* from @${target.split('@')[0]}!\n💵 Your balance: *${db.users.get(senderJid).balance.toLocaleString()} 🪙*`, { mentions: [target] });
    } else {
      const fine = Math.floor(Math.random() * 200) + 50;
      db.users.deductBalance(senderJid, fine);
      reply(`👮 *Caught!*\n\n❌ You failed to rob @${target.split('@')[0]}!\n💸 Fine paid: *-${fine} 🪙*\n💰 Balance: *${db.users.get(senderJid).balance.toLocaleString()} 🪙*`, { mentions: [target] });
    }
  },
};
