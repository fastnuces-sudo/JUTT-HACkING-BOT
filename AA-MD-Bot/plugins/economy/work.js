const jobs = [
  { name: 'Software Developer', earn: [200, 500] },
  { name: 'YouTuber', earn: [100, 800] },
  { name: 'Delivery Driver', earn: [150, 350] },
  { name: 'Teacher', earn: [200, 400] },
  { name: 'Streamer', earn: [50, 1000] },
  { name: 'Chef', earn: [150, 400] },
  { name: 'Doctor', earn: [400, 700] },
  { name: 'Artist', earn: [100, 600] },
  { name: 'Trader', earn: [50, 900] },
  { name: 'Mechanic', earn: [200, 450] },
];

const workCooldowns = new Map();

export default {
  command: 'work',
  alias: ['earn', 'job'],
  description: 'Work to earn coins',
  category: 'economy',
  async execute({ reply, senderJid, db }) {
    const now = Date.now();
    const lastWork = workCooldowns.get(senderJid);
    if (lastWork && now - lastWork < 30 * 60 * 1000) {
      const remaining = Math.ceil((30 * 60 * 1000 - (now - lastWork)) / 60000);
      return reply(`⏰ You need to rest!\n\n⏳ Work again in: *${remaining} minutes*`);
    }
    const job = jobs[Math.floor(Math.random() * jobs.length)];
    const earned = Math.floor(Math.random() * (job.earn[1] - job.earn[0])) + job.earn[0];
    workCooldowns.set(senderJid, now);
    db.users.addBalance(senderJid, earned);
    const balance = db.users.get(senderJid).balance;
    reply(`💼 *Work Complete!*\n\n👔 Job: *${job.name}*\n💵 Earned: *+${earned} 🪙*\n💰 Balance: *${balance.toLocaleString()} 🪙*\n\n⏰ Work again in 30 minutes!`);
  },
};
