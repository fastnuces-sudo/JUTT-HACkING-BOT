// ============================================
// AA MD Bot - Disappearing Messages
// Toggle ephemeral messages in groups
// ============================================

const DURATIONS = {
  off:  0,
  '24h': 86400,
  '7d':  7 * 86400,
  '90d': 90 * 86400,
};

async function setEphemeral(sock, jid, seconds, reply) {
  await sock.groupToggleEphemeral(jid, seconds);
  const label = seconds === 0 ? 'OFF' : seconds === 86400 ? '24 hours' : seconds === 7 * 86400 ? '7 days' : '90 days';
  await reply(
    `⏱️ *Disappearing Messages*\n\n` +
    `${seconds > 0 ? '✅ Enabled' : '🔴 Disabled'}: *${label}*\n\n` +
    `> ⏱️ *AA MD Bot*`
  );
}

export default [
  {
    command: 'disap',
    alias: ['disappear', 'ephemeral'],
    description: 'Set disappearing messages (off/24h/7d/90d)',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    botAdminOnly: true,

    async execute({ text, reply, sock, jid, msg, prefix }) {
      const arg = (text || '').trim().toLowerCase();
      if (!DURATIONS.hasOwnProperty(arg)) return reply(
        `⏱️ *Disappearing Messages*\n\n` +
        `*Usage:* ${prefix}disap <option>\n\n` +
        `*Options:*\n` +
        `▸ *${prefix}disap off* — Disable\n` +
        `▸ *${prefix}disap 24h* — 24 hours\n` +
        `▸ *${prefix}disap 7d* — 7 days\n` +
        `▸ *${prefix}disap 90d* — 90 days\n\n` +
        `> ⏱️ *AA MD Bot*`
      );

      try {
        await setEphemeral(sock, jid, DURATIONS[arg], reply);
      } catch (e) {
        reply(`❌ Failed: ${e.message}\n\nMake sure the bot is a group admin.\n\n> ⏱️ *AA MD Bot*`);
      }
    },
  },
  {
    command: 'disap1',
    alias: [],
    description: 'Set disappearing messages to 24h',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    botAdminOnly: true,
    async execute({ reply, sock, jid }) {
      try { await setEphemeral(sock, jid, 86400, reply); }
      catch (e) { reply(`❌ ${e.message}`); }
    },
  },
  {
    command: 'disap7',
    alias: [],
    description: 'Set disappearing messages to 7 days',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    botAdminOnly: true,
    async execute({ reply, sock, jid }) {
      try { await setEphemeral(sock, jid, 7 * 86400, reply); }
      catch (e) { reply(`❌ ${e.message}`); }
    },
  },
  {
    command: 'disap90',
    alias: [],
    description: 'Set disappearing messages to 90 days',
    category: 'group',
    groupOnly: true,
    adminOnly: true,
    botAdminOnly: true,
    async execute({ reply, sock, jid }) {
      try { await setEphemeral(sock, jid, 90 * 86400, reply); }
      catch (e) { reply(`❌ ${e.message}`); }
    },
  },
];
