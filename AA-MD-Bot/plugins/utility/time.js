import moment from 'moment-timezone';

const zones = {
  pk: 'Asia/Karachi',
  us: 'America/New_York',
  uk: 'Europe/London',
  ae: 'Asia/Dubai',
  in: 'Asia/Kolkata',
  jp: 'Asia/Tokyo',
  au: 'Australia/Sydney',
  ca: 'America/Toronto',
};

export default {
  command: 'time',
  alias: ['clock'],
  description: 'Get time for any timezone',
  category: 'utility',
  async execute({ reply, args }) {
    const tz = args[0] ? (zones[args[0].toLowerCase()] || args[0]) : 'Asia/Karachi';
    try {
      const m = moment().tz(tz);
      reply(`🕐 *Time Info*\n\n🌍 Timezone: *${tz}*\n📅 Date: *${m.format('DD MMMM YYYY')}*\n⏰ Time: *${m.format('hh:mm:ss A')}*\n📆 Day: *${m.format('dddd')}*`);
    } catch {
      reply(`❌ Unknown timezone: ${tz}\n\nShortcuts: ${Object.keys(zones).join(', ')}`);
    }
  },
};
