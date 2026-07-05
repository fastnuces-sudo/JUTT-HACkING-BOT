// ============================================
// AA MD Bot - Hack Effect (Animated)
// Simulates a cinematic hacking sequence
// ============================================

const HACK_LINES = [
  '> Initializing breach protocol...',
  '> Bypassing firewall layer 1... ✓',
  '> Spoofing MAC address... ✓',
  '> Injecting payload into kernel... ✓',
  '> Bypassing firewall layer 2... ✓',
  '> Escalating privileges to root... ✓',
  '> Dumping /etc/shadow... ✓',
  '> Cracking SHA-256 hashes... ✓',
  '> Connecting to C2 server... ✓',
  '> Exfiltrating data... ⠋',
  '> Exfiltrating data... ⠙',
  '> Exfiltrating data... ⠸',
  '> Exfiltrating data... ⠴',
  '> Exfiltrating data... ✓',
  '> Wiping logs... ✓',
  '> Covering tracks... ✓',
  '> ✅ ACCESS GRANTED',
];

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

export default {
  command: 'hack',
  alias: ['hackme', 'hax'],
  description: 'Simulated animated hacking sequence',
  category: 'fun',

  async execute({ text, reply, react, sock, jid, msg }) {
    const target = text?.trim() || 'Target System';

    await react('💻');

    // Send initial message
    const sent = await sock.sendMessage(jid, {
      text: `💻 *HACK INITIATED*\n\n🎯 Target: *${target}*\n\n> Establishing connection...`,
    }, { quoted: msg });

    let accumulated = `💻 *HACK INITIATED*\n\n🎯 Target: *${target}*\n\n`;

    let editSupported = true;
    for (let i = 0; i < HACK_LINES.length; i++) {
      await delay(i < 9 ? 800 : 500);
      accumulated += HACK_LINES[i] + '\n';

      const isLast = i === HACK_LINES.length - 1;
      const display = isLast
        ? accumulated + `\n*Target "${target}" has been pwned!* 🏴‍☠️\n\n> 💻 *AA MD Bot*`
        : accumulated;

      if (editSupported) {
        try {
          await sock.relayMessage(jid, {
            protocolMessage: {
              key: sent.key,
              type: 14,
              editedMessage: { conversation: display },
            },
          }, {});
        } catch {
          // Message edits not supported — fall back to final reply only
          editSupported = false;
        }
      }
    }

    // If edits failed entirely, send full result as a new message
    if (!editSupported) {
      const finalMsg = accumulated + `\n*Target "${target}" has been pwned!* 🏴‍☠️\n\n> 💻 *AA MD Bot*`;
      await sock.sendMessage(jid, { text: finalMsg }, { quoted: msg });
    }

    await react('✅');
  },
};
