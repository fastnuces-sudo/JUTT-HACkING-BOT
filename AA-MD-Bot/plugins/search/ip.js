// ============================================
// AA MD Bot - IP Lookup
// Uses ip-api.com — free, no key needed
// Commands: .ip .iplookup .ipinfo
// ============================================
import axios from 'axios';

export default {
  command: 'ip',
  alias: ['iplookup', 'ipinfo', 'ipcheck'],
  description: 'Look up info about any IP address — location, ISP, proxy detection',
  category: 'search',

  async execute({ text, reply, react, prefix }) {
    if (!text) return reply(
      `🌐 *IP Lookup*\n\n` +
      `*Usage:* ${prefix}ip <address>\n\n` +
      `*Examples:*\n` +
      `• ${prefix}ip 8.8.8.8\n` +
      `• ${prefix}ip 1.1.1.1\n` +
      `• ${prefix}ip 103.255.4.1\n\n` +
      `> 🌐 *AA MD Bot*`
    );

    await react('🌐');
    try {
      const { data } = await axios.get(
        `http://ip-api.com/json/${encodeURIComponent(text.trim())}`,
        { params: { fields: 'status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,query,mobile,proxy,hosting' }, timeout: 10000 }
      );

      if (data.status !== 'success') throw new Error(data.message || 'Lookup failed');

      const flag = data.countryCode
        ? String.fromCodePoint(...[...data.countryCode.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)))
        : '';

      const proxyWarning = data.proxy ? '\n⚠️ *This IP appears to be a proxy/VPN!*' : '';

      reply(
        `🌐 *IP Lookup: ${data.query}*\n\n` +
        `${flag} *Country:* ${data.country}\n` +
        `🏙️ *City:* ${data.city}, ${data.regionName}\n` +
        `📮 *ZIP:* ${data.zip || 'N/A'}\n` +
        `🕐 *Timezone:* ${data.timezone}\n` +
        `📍 *Coordinates:* ${data.lat}, ${data.lon}\n\n` +
        `🏢 *ISP:* ${data.isp}\n` +
        `🔗 *Org:* ${data.org || 'N/A'}\n` +
        `📡 *AS:* ${data.as || 'N/A'}\n\n` +
        `📱 *Mobile:* ${data.mobile ? '✅ Yes' : '❌ No'}\n` +
        `🕵️ *Proxy/VPN:* ${data.proxy ? '⚠️ Yes' : '✅ No'}\n` +
        `☁️ *Hosting/DC:* ${data.hosting ? '⚠️ Yes' : '✅ No'}` +
        proxyWarning +
        `\n\n> 🌐 *AA MD Bot*`
      );
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *IP Lookup Failed*\n\n${e.message}\n\nMake sure the IP address is valid.\n\n> 🌐 *AA MD Bot*`);
    }
  },
};
