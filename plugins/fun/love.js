// ============================================
// AA MD Bot - Love Calculator
// Fun love percentage between two names
// ============================================

function lovePct(a, b) {
  // Deterministic seeded score so same names always give same result
  const str = (a + b).toLowerCase().replace(/\s/g, '');
  let hash = 0;
  for (const c of str) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return (hash % 101); // 0–100
}

function loveBar(pct) {
  const filled = Math.round(pct / 10);
  return '❤️'.repeat(filled) + '🖤'.repeat(10 - filled);
}

function loveMsg(pct) {
  if (pct >= 90) return '💘 Soulmates! A match made in heaven!';
  if (pct >= 70) return '💕 Great chemistry — keep it going!';
  if (pct >= 50) return '💛 There\'s potential, nurture it!';
  if (pct >= 30) return '💙 Friends with possibilities!';
  return '🤍 Just friends... for now.';
}

export default {
  command: 'love',
  alias: ['lovecalc', 'lovestatus'],
  description: 'Calculate love percentage between two names',
  category: 'fun',

  async execute({ text, reply, react, sock, jid, msg, prefix }) {
    if (!text || !text.includes('&')) return reply(
      `💘 *Love Calculator*\n\n` +
      `*Usage:* ${prefix}love <name1> & <name2>\n` +
      `*Example:* ${prefix}love Ali & Sara\n\n` +
      `> 💘 *AA MD Bot*`
    );

    const [name1, name2] = text.split('&').map(s => s.trim());
    if (!name1 || !name2) return reply(`❌ Please provide two names separated by &\n\n> 💘 *AA MD Bot*`);

    await react('💘');
    const pct = lovePct(name1, name2);

    await sock.sendMessage(jid, {
      text:
        `💘 *Love Calculator*\n\n` +
        `👤 *${name1}* ❤️ *${name2}*\n\n` +
        `${loveBar(pct)}\n\n` +
        `💯 *Love Score: ${pct}%*\n\n` +
        `${loveMsg(pct)}\n\n` +
        `> 💘 *AA MD Bot*`,
    }, { quoted: msg });

    await react('✅');
  },
};
