// ============================================
// AA MD Bot - Periodic Table Element Lookup
// Uses api.popcat.xyz (free, no key needed)
// ============================================

import axios from 'axios';

export default {
  command: 'element',
  alias: ['periodic', 'chem', 'chemistry'],
  description: 'Look up a periodic table element',
  category: 'search',

  async execute({ text, reply, react, sock, jid, msg, prefix }) {
    if (!text) return reply(
      `🧪 *Periodic Table Lookup*\n\n` +
      `*Usage:* ${prefix}element <name/symbol/number>\n\n` +
      `*Examples:*\n` +
      `• ${prefix}element Gold\n` +
      `• ${prefix}element Au\n` +
      `• ${prefix}element 79\n\n` +
      `> 🧪 *AA MD Bot*`
    );

    await react('🧪');

    try {
      const { data } = await axios.get(
        `https://api.popcat.xyz/periodic-table?element=${encodeURIComponent(text.trim())}`,
        { timeout: 15000 }
      );

      if (data.error || !data.name) {
        await react('❌');
        return reply(`❌ Element *"${text}"* not found.\n\nTry the full name, symbol (e.g. Au), or atomic number (e.g. 79).\n\n> 🧪 *AA MD Bot*`);
      }

      const caption =
        `🧪 *${data.name}* (${data.symbol})\n` +
        `${'─'.repeat(28)}\n` +
        `⚛️  *Atomic Number:* ${data.atomic_number}\n` +
        `⚖️  *Atomic Mass:* ${data.atomic_mass}\n` +
        `📅 *Period:* ${data.period}\n` +
        `🔬 *Phase:* ${data.phase}\n` +
        `🌡️ *Melting Point:* ${data.melting_point ?? 'N/A'} K\n` +
        `🌡️ *Boiling Point:* ${data.boiling_point ?? 'N/A'} K\n` +
        `🔭 *Discovered by:* ${data.discovered_by ?? 'Unknown'}\n` +
        `📖 *Named by:* ${data.named_by ?? 'Unknown'}\n\n` +
        (data.summary ? `📝 *Summary:*\n${data.summary.slice(0, 250)}...\n\n` : '') +
        `> 🧪 *AA MD Bot*`;

      if (data.image) {
        await sock.sendMessage(jid, { image: { url: data.image }, caption }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: caption }, { quoted: msg });
      }
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ Element lookup failed: ${e.message}\n\n> 🧪 *AA MD Bot*`);
    }
  },
};
