import moment from 'moment-timezone';
import { formatDuration } from '../../lib/helper.js';

export default {
  command: 'myprofile',
  alias: ['me', 'myinfo'],
  description: 'View your detailed profile',
  category: 'level',
  async execute({ reply, senderJid, msg, db }) {
    const user = db.users.get(senderJid);
    const name = msg.pushName || user.name || 'Unknown';
    const joined = user.createdAt ? moment(user.createdAt).format('DD MMM YYYY') : 'Unknown';
    const lastSeen = user.lastSeen ? formatDuration(Date.now() - user.lastSeen) + ' ago' : 'Now';
    const inv = user.inventory || [];
    reply(`👤 *My Profile*\n\n📛 Name: *${name}*\n📞 Number: +${senderJid.split('@')[0]}\n📅 Joined: *${joined}*\n\n📊 *Stats:*\n├ Level: *${user.level || 1}*\n├ XP: *${(user.xp || 0).toLocaleString()}*\n├ Coins: *${(user.balance || 0).toLocaleString()} 🪙*\n├ Commands Used: *${user.commandsUsed || 0}*\n└ Daily Streak: *${user.dailyStreak || 0} 🔥*\n\n🎒 *Inventory:* ${inv.length > 0 ? inv.map(i => i.name).join(', ') : 'Empty'}\n⏰ *Last Active:* ${lastSeen}`);
  },
};
