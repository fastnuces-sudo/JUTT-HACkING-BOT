// ============================================
// AA MD Bot - Stock Price Lookup
// Uses Yahoo Finance public API — no key needed
// Commands: .stock .stockprice .shares
// ============================================
import axios from 'axios';

export default {
  command: 'stock',
  alias: ['stockprice', 'shares', 'stonks', 'ticker'],
  description: 'Live stock prices from Yahoo Finance',
  category: 'search',

  async execute({ text, reply, react, prefix }) {
    if (!text) return reply(
      `📈 *Stock Price Lookup*\n\n` +
      `*Usage:* ${prefix}stock <symbol>\n\n` +
      `*Examples:*\n` +
      `• ${prefix}stock AAPL  (Apple)\n` +
      `• ${prefix}stock TSLA  (Tesla)\n` +
      `• ${prefix}stock AMZN  (Amazon)\n` +
      `• ${prefix}stock MSFT  (Microsoft)\n` +
      `• ${prefix}stock GOOGL (Google)\n` +
      `• ${prefix}stock NVDA  (Nvidia)\n\n` +
      `> 📈 *AA MD Bot*`
    );

    const symbol = text.trim().split(/\s+/)[0].toUpperCase();
    await react('📈');

    try {
      const { data } = await axios.get(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
        {
          params: { interval: '1d', range: '1d' },
          headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
          timeout: 15000,
        }
      );

      const result = data?.chart?.result?.[0];
      if (!result) throw new Error('Symbol not found or market closed');

      const meta    = result.meta;
      const price   = meta.regularMarketPrice;
      const prev    = meta.chartPreviousClose || meta.previousClose;
      const change  = price - prev;
      const changePct = ((change / prev) * 100);
      const arrow   = change >= 0 ? '🟢 ▲' : '🔴 ▼';
      const currency= meta.currency || 'USD';

      reply(
        `📈 *${meta.longName || meta.shortName || symbol}* (${symbol})\n\n` +
        `💵 *Price:* ${currency} ${price?.toFixed(2)}\n` +
        `${arrow} *Change:* ${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)\n\n` +
        `📊 *Today*\n` +
        `• Open: ${currency} ${meta.regularMarketOpen?.toFixed(2) || 'N/A'}\n` +
        `• High: ${currency} ${meta.regularMarketDayHigh?.toFixed(2) || 'N/A'}\n` +
        `• Low:  ${currency} ${meta.regularMarketDayLow?.toFixed(2) || 'N/A'}\n` +
        `• Prev: ${currency} ${prev?.toFixed(2) || 'N/A'}\n\n` +
        `📦 *Volume:* ${(meta.regularMarketVolume || 0).toLocaleString()}\n` +
        `🏢 *Exchange:* ${meta.exchangeName || 'N/A'}\n` +
        `📅 *Market State:* ${meta.marketState || 'N/A'}\n\n` +
        `> 📈 *AA MD Bot*`
      );
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *Stock lookup failed*\n\nSymbol: \`${symbol}\`\n${e.message}\n\nMake sure the ticker symbol is correct.\n\n> 📈 *AA MD Bot*`);
    }
  },
};
