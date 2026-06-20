export default {
  command: 'transfer',
  alias: ['send', 'give', 'pay'],
  description: 'Transfer coins to another user',
  category: 'economy',
  async execute({ reply, senderJid, msg, args, db }) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!mentions.length) return reply('❌ Mention who to send coins to!\nExample: .transfer @user 500');
    const target = mentions[0];
    if (target === senderJid) return reply('❌ You can\'t send coins to yourself!');
    const amount = parseInt(args[1] || args[0]);
    if (!amount || amount < 1) return reply('❌ Usage: .transfer @user [amount]');
    const sender = db.users.get(senderJid);
    if ((sender.balance || 0) < amount) return reply(`❌ Insufficient balance!\nYour balance: *${sender.balance || 0} 🪙*`);
    db.users.deductBalance(senderJid, amount);
    db.users.addBalance(target, amount);
    reply(`✅ *Transfer Complete!*\n\n💸 Sent: *${amount} 🪙* to @${target.split('@')[0]}\n💰 Your balance: *${db.users.get(senderJid).balance.toLocaleString()} 🪙*`, { mentions: [target] });
  },
};
