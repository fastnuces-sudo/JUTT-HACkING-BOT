// ============================================
// AA MD Bot - Country Info
// Uses countriesnow.space (free, no key needed)
// ============================================

import axios from 'axios';

const api = axios.create({ timeout: 12000 });
const BASE = 'https://countriesnow.space/api/v0.1/countries';

// countriesnow.space GET endpoints — all follow redirects automatically
async function cnGet(path, country) {
  try {
    const { data } = await api.get(`${BASE}/${path}/q?country=${encodeURIComponent(country)}`);
    if (!data?.error && data?.data) return data.data;
  } catch {}
  return null;
}

// Fallback for region: api.first.org
async function fetchRegion(name) {
  try {
    const { data } = await api.get(
      `https://api.first.org/data/v1/countries?q=${encodeURIComponent(name)}&limit=1`
    );
    if (data?.data) {
      const code = Object.keys(data.data)[0];
      return data.data[code]?.region || null;
    }
  } catch {}
  return null;
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

      // Fetch all data in parallel
      const [capData, curData, flagData, region] = await Promise.all([
        cnGet('capital', query),
        cnGet('currency', query),
        cnGet('flag/images', query),
        fetchRegion(query),
      ]);

      // If we got nothing from countriesnow, country not found
      if (!capData && !curData && !flagData) {
        await react('❌');
        return reply(
          `❌ Country "*${query}*" not found.\n\n` +
          `Try the full name (e.g. Pakistan, Saudi Arabia) or ISO code (e.g. PK, SA, US).`
        );
      }

      const name     = capData?.name || curData?.name || flagData?.name || query;
      const capital  = capData?.capital || 'N/A';
      const iso2     = (capData?.iso2 || curData?.iso2 || flagData?.iso2 || '').toLowerCase();
      const iso3     = capData?.iso3 || curData?.iso3 || flagData?.iso3 || '';
      const currency = curData?.currency || 'N/A';
      const flagUrl  = flagData?.flag || (iso2 ? `https://flagcdn.com/h80/${iso2}.png` : null);

      // Unicode flag emoji from iso2
      const unicodeFlag = iso2.length === 2
        ? String.fromCodePoint(...[...iso2.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)))
        : '';

      const info =
        `${unicodeFlag} *${name}*\n\n` +
        `${'─'.repeat(28)}\n` +
        `🏙️ *Capital:*      ${capital}\n` +
        `🌍 *Region:*       ${region || 'N/A'}\n` +
        `💰 *Currency:*     ${currency}\n` +
        (iso2 ? `🌐 *ISO Code:*     ${iso2.toUpperCase()}${iso3 ? ` / ${iso3}` : ''}\n` : '') +
        `\n> 🌍 *AA MD Bot*`;

      if (flagUrl) {
        await sock.sendMessage(jid, { image: { url: flagUrl }, caption: info }, { quoted: msg })
          .catch(() => reply(info));
      } else {
        reply(info);
      }
      await react('✅');

    } catch (e) {
      await react('❌');
      reply(`❌ Country lookup failed: ${e.message}`);
    }
  },
};
