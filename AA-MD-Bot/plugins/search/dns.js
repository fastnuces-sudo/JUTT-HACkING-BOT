// ============================================
// AA MD Bot - DNS Lookup
// Uses Node built-in dns module — no API needed
// Commands: .dns .dnslookup .nslookup
// ============================================
import dns from 'dns';
const dnsPromises = dns.promises;

export default {
  command: 'dns',
  alias: ['dnslookup', 'nslookup', 'dnscheck'],
  description: 'DNS lookup — A, MX, NS, TXT, AAAA records for any domain',
  category: 'search',

  async execute({ text, reply, react, prefix }) {
    if (!text) return reply(
      `🔍 *DNS Lookup*\n\n` +
      `*Usage:* ${prefix}dns <domain>\n\n` +
      `*Examples:*\n` +
      `• ${prefix}dns google.com\n` +
      `• ${prefix}dns facebook.com\n` +
      `• ${prefix}dns github.com\n\n` +
      `> 🔍 *AA MD Bot*`
    );

    const domain = text.replace(/https?:\/\//g, '').replace(/\//g, '').trim();
    if (!domain.includes('.')) return reply(`❌ Invalid domain. Example: \`google.com\``);

    await react('🔍');
    try {
      const [aRec, aaaaRec, mxRec, nsRec, txtRec, cname] = await Promise.allSettled([
        dnsPromises.resolve4(domain),
        dnsPromises.resolve6(domain),
        dnsPromises.resolveMx(domain),
        dnsPromises.resolveNs(domain),
        dnsPromises.resolveTxt(domain),
        dnsPromises.resolveCname(domain),
      ]);

      const get = (r) => r.status === 'fulfilled' ? r.value : null;

      const aVal    = get(aRec)?.join(', ')                    || '—';
      const aaaaVal = get(aaaaRec)?.slice(0,2).join(', ')       || '—';
      const mxVal   = get(mxRec)?.slice(0,3).map(r => `${r.exchange} (prio ${r.priority})`).join('\n      ') || '—';
      const nsVal   = get(nsRec)?.slice(0,4).join(', ')         || '—';
      const txtVal  = get(txtRec)?.slice(0,2).map(t => t.join('')).join('\n      ').slice(0, 200) || '—';
      const cnameVal= get(cname)?.join(', ')                    || '—';

      reply(
        `🔍 *DNS Lookup: ${domain}*\n\n` +
        `📌 *A (IPv4):*\n  ${aVal}\n\n` +
        `📌 *AAAA (IPv6):*\n  ${aaaaVal}\n\n` +
        `📧 *MX (Mail):*\n  ${mxVal}\n\n` +
        `🌐 *NS (Nameservers):*\n  ${nsVal}\n\n` +
        `🔗 *CNAME:*\n  ${cnameVal}\n\n` +
        `📋 *TXT:*\n  ${txtVal}\n\n` +
        `> 🔍 *AA MD Bot*`
      );
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *DNS Lookup Failed*\n\n${e.message}\n\n> 🔍 *AA MD Bot*`);
    }
  },
};
