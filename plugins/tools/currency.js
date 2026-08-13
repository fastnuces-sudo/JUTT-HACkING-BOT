// ============================================
// AA MD Bot - Currency Converter
// Uses exchangerate-api.com (free, no key)
// ============================================

import axios from 'axios';

const API = 'https://open.er-api.com/v6/latest';

export default {
  command: 'currency',
  alias: ['exchange', 'rate'],
  description: 'Convert currency with live exchange rates',
  category: 'tools',

  async execute({ text, reply, react, sock, jid, msg, prefix }) {
    if (!text) return reply(
      `💱 *Currency Converter*\n\n` +
      `*Usage:* ${prefix}currency <amount> <from> <to>\n\n` +
      `*Examples:*\n` +
      `• ${prefix}currency 100 USD PKR\n` +
      `• ${prefix}currency 50 EUR GBP\n` +
      `• ${prefix}currency 1000 PKR USD\n\n` +
      `> 💱 *AA MD Bot*`
    );

    const parts = text.trim().split(/\s+/);
    if (parts.length < 3) return reply(
      `❌ *Usage:* ${prefix}currency <amount> <FROM> <TO>\n` +
      `*Example:* ${prefix}currency 100 USD PKR\n\n` +
      `> 💱 *AA MD Bot*`
    );

    const amount = parseFloat(parts[0]);
    const from   = parts[1].toUpperCase();
    const to     = parts[2].toUpperCase();

    if (isNaN(amount) || amount <= 0) return reply(`❌ Invalid amount: *${parts[0]}*\n\n> 💱 *AA MD Bot*`);

    await react('💱');

    try {
      const { data } = await axios.get(`${API}/${from}`, { timeout: 15000 });

      if (data.result !== 'success') throw new Error('API error');
      if (!data.rates[to]) return reply(`❌ Unknown currency: *${to}*\n\nCheck the currency code (e.g. USD, EUR, PKR, GBP).\n\n> 💱 *AA MD Bot*`);

      const rate = data.rates[to];
      const result = (amount * rate).toFixed(2);
      const updated = new Date(data.time_last_update_utc).toLocaleDateString();

      await sock.sendMessage(jid, {
        text:
          `💱 *Currency Converter*\n\n` +
          `${'─'.repeat(28)}\n` +
          `💰 *${amount} ${from}* = *${result} ${to}*\n\n` +
          `📈 *Rate:* 1 ${from} = ${rate.toFixed(6)} ${to}\n` +
          `🔄 *Updated:* ${updated}\n\n` +
          `> 💱 *AA MD Bot*`,
      }, { quoted: msg });

      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ Conversion failed: ${e.message}\n\n> 💱 *AA MD Bot*`);
    }
  },
};
