// AA MD Bot - Anti Scam (group message scanner)
// Passive handler called from sessionManager on every group message
import { db } from '../../lib/database.js';

// ── Scam pattern detection ────────────────────────────────────────────────────
const SCAM_PATTERNS = [
  { label: 'Crypto scam',    rx: /(?:double|multiply)\s+(?:your\s+)?(?:bitcoin|crypto|btc|eth|usdt)/i },
  { label: 'Investment scam',rx: /(?:guaranteed|100%)\s+(?:profit|returns?|income)/i },
  { label: 'Lottery scam',   rx: /(?:you(?:'ve)?\s+won|congratulations)\s+.{0,40}(?:lottery|prize|jackpot)/i },
  { label: 'Job scam',       rx: /earn\s+(?:\$|usd|pkr|inr)\s*[\d,]+\s+(?:per\s+)?(?:day|week|month)\s+(?:from\s+home|online|daily)/i },
  { label: 'Phishing link',  rx: /(?:click\s+(?:here|below|this\s+link)|visit\s+now)\s+(?:to\s+)?(?:claim|verify|activate|unlock|win)/i },
  { label: 'Fake giveaway',  rx: /(?:free\s+)?(?:iphone|laptop|car|cash)\s+giveaway\s+.{0,40}(?:limited|hurry|claim|now)/i },
  { label: 'Ponzi scheme',   rx: /refer\s+\d+\s+(?:friends?|people|members?)\s+(?:and\s+)?earn/i },
  { label: 'Fake job',       rx: /(?:part[- ]?time|work[- ]?from[- ]?home)\s+.{0,30}(?:no\s+experience|\$\d+\/(?:hr|hour|day))/i },
];

function detectScam(text) {
  for (const { label, rx } of SCAM_PATTERNS) {
    if (rx.test(text)) return label;
  }
  return null;
}

// ── Passive handler ───────────────────────────────────────────────────────────
export async function checkAntiScam(msg, sock, sessionId) {
  if (!msg?.message || !msg.key?.remoteJid?.endsWith('@g.us')) return;
  if (msg.key.fromMe) return;

  const groupJid = msg.key.remoteJid;
  const grp = db.groups.get(sessionId, groupJid) || {};
  if (!grp.antiscam) return;

  const sender = msg.key.participant || msg.key.remoteJid;

  const text = (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption || ''
  );

  if (!text || text.length < 15) return;

  const hit = detectScam(text);
  if (!hit) return;

  const senderNum = sender.split('@')[0];
  const action = grp.antiscamAction || 'delete+warn';

  // Delete
  if (action.includes('delete')) {
    try { await sock.sendMessage(groupJid, { delete: msg.key }); } catch {}
  }

  // Warn
  if (action.includes('warn')) {
    try {
      await sock.sendMessage(groupJid, {
        text:
          `🚨 *Scam Alert!*\n\n` +
          `@${senderNum} — your message was flagged as a potential *${hit}*.\n\n` +
          `⚠️ Sharing fraudulent content may result in removal.\n` +
          `_If this was a mistake, admins can dismiss._`,
        mentions: [sender],
      });
    } catch {}
  }

  // Kick
  if (action === 'kick') {
    try {
      await sock.groupParticipantsUpdate(groupJid, [sender], 'remove');
      await sock.sendMessage(groupJid, {
        text: `🚫 @${senderNum} was removed for posting suspected *${hit}* content.\n\n> 🤖 *AA MD Bot*`,
        mentions: [sender],
      });
    } catch {}
  }
}

// ── Command ───────────────────────────────────────────────────────────────────
export default {
  command: 'antiscam',
  alias: ['scamprotect', 'scamfilter', 'noscam'],
  description: 'Auto-detect and remove scam messages in groups. Actions: delete+warn | delete | warn | kick',
  category: 'admin',
  groupOnly: true,
  adminOnly: true,

  async execute({ jid, args, reply, react, db }) {
    const sub = (args[0] || '').toLowerCase();
    const grp = db.groups.get(jid) || {};
    const ACTIONS = ['delete+warn', 'delete', 'warn', 'kick'];

    if (!sub || sub === 'status') {
      return reply(
        `🚨 *Anti Scam*\n\n` +
        `Status: *${grp.antiscam ? '✅ ON' : '❌ OFF'}*\n` +
        `Action: *${grp.antiscamAction || 'delete+warn'}*\n\n` +
        `📋 *Commands:*\n` +
        `• *.antiscam on* — enable\n` +
        `• *.antiscam off* — disable\n` +
        `• *.antiscam delete+warn* — delete and warn (default)\n` +
        `• *.antiscam kick* — delete and kick scammer\n\n` +
        `🛡️ *Detects:*\n` +
        `Crypto doubling, lottery scams, fake jobs, phishing links, Ponzi schemes, fake giveaways\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    if (sub === 'on') {
      db.groups.set(jid, { antiscam: true, antiscamAction: 'delete+warn' });
      await react('✅');
      return reply('🚨 *Anti Scam is ON*\nAction: delete + warn\n\n> 🤖 *AA MD Bot*');
    }

    if (sub === 'off') {
      db.groups.set(jid, { antiscam: false });
      await react('✅');
      return reply('🚨 *Anti Scam is OFF*\n\n> 🤖 *AA MD Bot*');
    }

    if (ACTIONS.includes(sub)) {
      db.groups.set(jid, { antiscam: true, antiscamAction: sub });
      await react('✅');
      return reply(`🚨 *Anti Scam is ON*\nAction: *${sub}*\n\n> 🤖 *AA MD Bot*`);
    }

    return reply(`❌ Unknown action. Use: on | off | delete | warn | delete+warn | kick`);
  },
};
