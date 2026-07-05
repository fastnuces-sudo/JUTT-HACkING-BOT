// ============================================
// AA MD Bot - AFK Mode
// Developer: Ahsan Ali | AA Mods
// ============================================

// Per-session AFK state — keyed by sessionId
const afkState = new Map();
// { active: bool, reason: string, since: number }

function getState(sessionId) {
  return afkState.get(sessionId) || { active: false, reason: 'No reason given', since: 0 };
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export function isAfk(sessionId) { return getState(sessionId).active; }

export default {
  command: 'afk',
  alias: ['back', 'away'],
  description: 'Set AFK mode — bot auto-replies to DMs while you are away',
  category: 'gb',
  ownerOnly: true,

  async execute({ args, reply, react, msg, sessionId }) {
    const sub = (args[0] || (msg?.command === 'back' ? 'back' : '')).toLowerCase();
    const state = getState(sessionId);

    // .back / .afk back → return from AFK
    if (sub === 'back') {
      if (!state.active) return reply(`✅ *You are not AFK.*\n\n> 👁️ *AA MD Bot*`);
      const dur = formatDuration(Date.now() - state.since);
      afkState.set(sessionId, { active: false, reason: '', since: 0 });
      await react('👋');
      return reply(
        `👋 *Welcome back!*\n\n` +
        `⏱️ *You were away for:* ${dur}\n` +
        `📝 *AFK reason was:* _${state.reason}_\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    // .afk [reason] → go AFK
    const reason = args.join(' ').trim() || 'No reason given';
    afkState.set(sessionId, { active: true, reason, since: Date.now() });
    await react('😴');
    return reply(
      `😴 *AFK Mode Activated*\n\n` +
      `📝 *Reason:* ${reason}\n\n` +
      `💬 Anyone who DMs you will get an auto-reply.\n` +
      `Type *.back* to return.\n\n` +
      `> 🤖 *AA MD Bot*`
    );
  },
};

// Called from sessionManager for every incoming message.
// Replies to DMs that land on the owner while they are AFK.
// Cancels AFK automatically when the owner themselves sends a message.
export async function handleAfkMention(msg, sock, sessionId) {
  const state = getState(sessionId);

  // Owner sent a message → auto-cancel AFK
  if (msg.key.fromMe && state.active) {
    const dur = formatDuration(Date.now() - state.since);
    afkState.set(sessionId, { active: false, reason: '', since: 0 });
    await sock.sendMessage(msg.key.remoteJid, {
      text: `👋 *AFK cancelled — welcome back!*\n⏱️ Away for: ${dur}\n\n> 🤖 *AA MD Bot*`,
    }, { quoted: msg }).catch(() => {});
    return;
  }

  if (!state.active || msg.key.fromMe) return;

  // Only reply in DMs (not groups, not broadcast)
  const jid = msg.key.remoteJid;
  const isDm = jid && !jid.endsWith('@g.us') && !jid.endsWith('@broadcast') && jid !== 'status@broadcast';
  if (!isDm) return;

  const dur = formatDuration(Date.now() - state.since);
  await sock.sendMessage(jid, {
    text:
      `😴 *Owner is currently AFK*\n\n` +
      `📝 *Reason:* ${state.reason}\n` +
      `⏱️ *Away for:* ${dur}\n\n` +
      `> 🤖 *AA MD Bot*`,
  }, { quoted: msg }).catch(() => {});
}
