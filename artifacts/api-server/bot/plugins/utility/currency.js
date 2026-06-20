import axios from 'axios';

export default {
  command: 'currency',
  alias: ['convert', 'fx'],
  description: 'Convert currency amounts',
  category: 'utility',
  async execute({ reply, args }) {
    if (args.length < 3) return reply('❌ Usage: .currency [amount] [from] [to]\nExample: .currency 100 USD PKR');
    const amount = parseFloat(args[0]);
    const from = args[1].toUpperCase();
    const to = args[2].toUpperCase();
    if (isNaN(amount)) return reply('❌ Invalid amount');
    try {
      const res = await axios.get(`https://api.exchangerate-api.com/v4/latest/${from}`, { timeout: 10000 });
      const rate = res.data.rates?.[to];
      if (!rate) return reply(`❌ Unsupported currency: ${to}`);
      const result = (amount * rate).toFixed(2);
      reply(`💱 *Currency Converter*\n\n${amount} ${from} = *${result} ${to}*\n\n📊 Rate: 1 ${from} = ${rate.toFixed(4)} ${to}\n📅 Updated: ${res.data.date}`);
    } catch {
      reply('❌ Failed to fetch exchange rates. Try again.');
    }
  },
};
