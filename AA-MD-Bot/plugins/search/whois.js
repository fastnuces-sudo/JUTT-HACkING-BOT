// ============================================
// AA MD Bot - WHOIS / Domain Lookup
// Uses rdap.org — free, no key needed
// Commands: .whois .domain .domaininfo
// ============================================
import axios from 'axios';

export default {
  command: 'whois',
  alias: ['domain', 'domaininfo', 'domaincheck'],
  description: 'WHOIS lookup — registrar, status, expiry for any domain',
  category: 'search',

  async execute({ text, reply, react, prefix }) {
    if (!text) return reply(
      `🌐 *WHOIS Lookup*\n\n` +
      `*Usage:* ${prefix}whois <domain>\n\n` +
      `*Examples:*\n` +
      `• ${prefix}whois google.com\n` +
      `• ${prefix}whois facebook.com\n` +
      `• ${prefix}whois github.com\n\n` +
      `> 🌐 *AA MD Bot*`
    );

    const domain = text.replace(/https?:\/\//g,'').replace(/\//g,'').trim().toLowerCase();
    if (!domain.includes('.')) return reply(`❌ Invalid domain. Example: \`google.com\``);

    await react('🌐');
    try {
      const { data } = await axios.get(`https://rdap.org/domain/${domain}`, { timeout: 15000 });

      const name    = data.ldhName || domain;
      const status  = (data.status || []).slice(0,4).join(', ') || 'N/A';
      const events  = {};
      (data.events || []).forEach(e => { events[e.eventAction] = e.eventDate?.slice(0,10); });
      const ns      = (data.nameservers || []).map(n => n.ldhName || n.unicodeName).filter(Boolean).slice(0,4).join(', ') || 'N/A';
      const entities = (data.entities || []);
      const registrar = entities.find(e => (e.roles||[]).includes('registrar'))?.vcardArray?.[1]?.find(v => v[0]==='fn')?.[3] || 'N/A';

      reply(
        `🌐 *WHOIS: ${name}*\n\n` +
        `📋 *Status:* ${status}\n\n` +
        `📅 *Registered:* ${events.registration || 'N/A'}\n` +
        `🔄 *Last Updated:* ${events['last changed'] || events.lastupdated || 'N/A'}\n` +
        `⏰ *Expires:* ${events.expiration || 'N/A'}\n\n` +
        `🏢 *Registrar:* ${registrar}\n` +
        `🖥️ *Nameservers:* ${ns}\n\n` +
        `> 🌐 *AA MD Bot*`
      );
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *WHOIS Failed*\n\n${e.message}\n\nCheck the domain name and try again.\n\n> 🌐 *AA MD Bot*`);
    }
  },
};
