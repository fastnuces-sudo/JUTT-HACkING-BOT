// ============================================
// AA MD Bot - Country Info
// Uses restcountries.com (free, no key needed)
// ============================================

import axios from 'axios';

const BASE = 'https://restcountries.com/v3.1';

function fmt(n) {
  if (!n) return 'N/A';
  return n.toLocaleString();
}

export default {
  command: 'country',
  alias: ['countryinfo', 'nation', 'flag'],
  description: 'Get detailed information about any country',
  category: 'search',

  async execute({ text, reply, react, sock, jid, msg, prefix }) {
    if (!text) return reply(
      `🌍 *Country Info*\n\n` +
      `*Usage:* ${prefix}country <name or code>\n\n` +
      `*Examples:*\n` +
      `• ${prefix}country Pakistan\n` +
      `• ${prefix}country Saudi Arabia\n` +
      `• ${prefix}country UK\n\n` +
      `> 🌍 *AA MD Bot*`
    );

    await react('🌍');

    try {
      const query = text.trim();
      let endpoint = `${BASE}/name/${encodeURIComponent(query)}?fullText=false`;
      if (query.length <= 3) endpoint = `${BASE}/alpha/${encodeURIComponent(query)}`;

      const { data } = await axios.get(endpoint, { timeout: 10000 });
      const c = Array.isArray(data) ? data[0] : data;

      const name       = c.name?.common || 'N/A';
      const official   = c.name?.official || name;
      const capital    = c.capital?.[0] || 'N/A';
      const region     = c.region || 'N/A';
      const subregion  = c.subregion || 'N/A';
      const population = fmt(c.population);
      const area       = fmt(c.area) + ' km²';
      const languages  = Object.values(c.languages || {}).join(', ') || 'N/A';
      const currencies = Object.values(c.currencies || {}).map(cu => `${cu.name} (${cu.symbol || '?'})`).join(', ') || 'N/A';
      const timezone   = c.timezones?.[0] || 'N/A';
      const tld        = c.tld?.[0] || 'N/A';
      const calling    = '+' + (c.idd?.root || '').replace('+', '') + (c.idd?.suffixes?.[0] || '');
      const flag       = c.flag || '';
      const flagUrl    = c.flags?.png || c.flags?.svg;
      const borders    = c.borders?.join(', ') || 'None (island or no borders)';
      const independent = c.independent ? '✅ Yes' : '❌ No';
      const unMember   = c.unMember ? '✅ Yes' : '❌ No';

      const info =
        `${flag} *${name}*\n` +
        `🏛️ _${official}_\n\n` +
        `${'─'.repeat(28)}\n` +
        `🏙️ *Capital:* ${capital}\n` +
        `🌍 *Region:* ${region} > ${subregion}\n` +
        `👥 *Population:* ${population}\n` +
        `📐 *Area:* ${area}\n` +
        `🗣️ *Language(s):* ${languages}\n` +
        `💰 *Currency:* ${currencies}\n` +
        `🕐 *Timezone:* ${timezone}\n` +
        `🔗 *TLD:* ${tld}\n` +
        `📞 *Calling Code:* ${calling}\n` +
        `🤝 *UN Member:* ${unMember}\n` +
        `🗺️ *Borders:* ${borders}\n\n` +
        `> 🌍 *AA MD Bot*`;

      if (flagUrl) {
        await sock.sendMessage(jid, { image: { url: flagUrl }, caption: info }, { quoted: msg });
      } else {
        reply(info);
      }
      await react('✅');
    } catch (e) {
      await react('❌');
      if (e.response?.status === 404) reply(`❌ Country "*${text}*" not found.\n\nTry the full name or ISO code (e.g. PK, SA, US).`);
      else reply(`❌ Country lookup failed: ${e.message}`);
    }
  },
};
