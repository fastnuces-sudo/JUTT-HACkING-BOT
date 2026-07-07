// ============================================
// AA MD Bot - Crypto Prices
// Developer: Ahsan Ali | AA Mods
// ============================================

import axios from 'axios';

const COIN_IDS = {
  btc:'bitcoin',eth:'ethereum',bnb:'binancecoin',sol:'solana',
  xrp:'ripple',ada:'cardano',doge:'dogecoin',dot:'polkadot',
  matic:'matic-network',ltc:'litecoin',avax:'avalanche-2',
  shib:'shiba-inu',uni:'uniswap',link:'chainlink',atom:'cosmos',
  trx:'tron',xlm:'stellar',algo:'algorand',near:'near',
};

const POPULAR = ['bitcoin','ethereum','binancecoin','solana','ripple','dogecoin'];

export default {
  command: 'crypto',
  alias: ['price', 'btc', 'eth', 'cryptoprice', 'coinprice'],
  description: 'Get live cryptocurrency prices',
  category: 'search',

  async execute({ args, reply, react }) {
    await react('💰');

    let coinInput = (args[0] || '').toLowerCase().trim();
    const coinId = COIN_IDS[coinInput] || coinInput || null;
    const ids = coinId ? coinId : POPULAR.join(',');

    try {
      const { data } = await axios.get(
        `https://api.coingecko.com/api/v3/simple/price`,
        {
          params: {
            ids: ids,
            vs_currencies: 'usd,pkr',
            include_24hr_change: true,
            include_market_cap: true,
          },
          timeout: 8000,
        }
      );

      if (!data || Object.keys(data).length === 0) throw new Error('No data');

      let text = `💰 *Live Crypto Prices*\n\n`;
      for (const [id, info] of Object.entries(data)) {
        const name = id.charAt(0).toUpperCase() + id.slice(1);
        const usd = info.usd?.toLocaleString() || 'N/A';
        const pkr = info.pkr?.toLocaleString() || 'N/A';
        const chg = info.usd_24h_change;
        const chgStr = chg != null ? (chg >= 0 ? `📈 +${chg.toFixed(2)}%` : `📉 ${chg.toFixed(2)}%`) : '';
        text += `*${name}*\n💵 $${usd} | 🇵🇰 ₨${pkr} ${chgStr}\n\n`;
      }
      text += `> 💰 *AA MD Bot* · Data by CoinGecko`;
      return reply(text);
    } catch {
      return reply(
        `💰 *Crypto Prices*\n\n` +
        `⚠️ Could not fetch prices. Try: *.crypto btc*, *.crypto eth*, *.crypto sol*\n\n> 🤖 *AA MD Bot*`
      );
    }
  },
};
