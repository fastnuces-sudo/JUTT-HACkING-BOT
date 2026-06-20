const shopItems = [
  { id: 'vip', name: '👑 VIP Badge', price: 5000, desc: 'Show off your VIP status' },
  { id: 'shield', name: '🛡️ Rob Shield', price: 2000, desc: 'Protect from being robbed (24h)' },
  { id: 'luckycharm', name: '🍀 Lucky Charm', price: 1500, desc: 'Boost gamble chances (1h)' },
  { id: 'xpboost', name: '⚡ XP Boost', price: 3000, desc: 'Double XP for 2 hours' },
  { id: 'dailyboost', name: '📅 Daily Boost', price: 2500, desc: '2x daily reward for 3 days' },
];

export default {
  command: 'shop',
  alias: ['store', 'buy'],
  description: 'View or buy items from the shop',
  category: 'economy',
  async execute({ reply, args, senderJid, db }) {
    if (!args[0] || args[0] === 'list') {
      const user = db.users.get(senderJid);
      let text = `🏪 *Bot Shop*\n💰 Your Balance: *${(user.balance || 0).toLocaleString()} 🪙*\n\n`;
      shopItems.forEach((item, i) => {
        text += `${i + 1}. ${item.name}\n   📝 ${item.desc}\n   💵 Price: *${item.price.toLocaleString()} 🪙*\n   ID: \`${item.id}\`\n\n`;
      });
      text += `\nUsage: .shop buy [item_id]`;
      return reply(text);
    }

    if (args[0] === 'buy') {
      const itemId = args[1]?.toLowerCase();
      const item = shopItems.find(i => i.id === itemId);
      if (!item) return reply(`❌ Item not found. Use *.shop* to see available items.`);
      const user = db.users.get(senderJid);
      if ((user.balance || 0) < item.price) return reply(`❌ Not enough coins!\nNeed: *${item.price} 🪙* | Have: *${user.balance || 0} 🪙*`);
      db.users.deductBalance(senderJid, item.price);
      const inv = user.inventory || [];
      inv.push({ id: item.id, name: item.name, boughtAt: Date.now() });
      db.users.set(senderJid, { inventory: inv });
      reply(`✅ *Purchase Successful!*\n\n${item.name}\n📝 ${item.desc}\n💸 Paid: *${item.price} 🪙*\n💰 Remaining: *${db.users.get(senderJid).balance.toLocaleString()} 🪙*`);
    }
  },
};
