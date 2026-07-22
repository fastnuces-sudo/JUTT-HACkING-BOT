// AA MD Bot - Anti Group Mention (@everyone / mass mention spam)
// Passive handler called from sessionManager on every group message
import { db } from '../../lib/database.js';

const MASS_MENTION_THRESHOLD = 5; // flag if ≥5 mentions in one message

// ── Passive handler ───────────────────────────────────────────────────────────
export async function checkAntiGm(msg, sock, sessionId) {
  if (!msg?.message || !msg.key?.remoteJid?.endsWith('@g.us')) return;
  if (msg.key.fromMe) return;

  const groupJid = msg.key.remoteJid;
  const grp = db.groups.get(sessionId, groupJid) || {};
  if (!grp.antigm) return;

  const sender = msg.key.participant || msg.key.remoteJid;

  // Check for @everyone/@all text or mass mentions
  const text = (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption || ''
  ).toLowerCase();

  const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  const hasEveryoneTrigger = /@everyone|@all\b|@here/.test(text);
  const isMassMention = mentions.length >= MASS_MENTION_THRESHOLD;

  if (!hasEveryoneTrigger && !isMassMention) return;

  const senderNum = sender.split('@')[0];
  const action = grp.antigmAction || 'delete+warn';

  // Delete message
  if (action.includes('delete')) {
    try { await sock.sendMessage(groupJid, { delete: msg.key }); } catch {}
  }

  // Warn
  if (action.includes('warn')) {
    try {
      await sock.sendMessage(groupJid, {
        text:
          `🔔 *Anti Mass-Mention*\n\n` +
          `@${senderNum} — mass-tagging / @everyone is *not allowed* here.\n\n` +
          `_Repeated violations may result in removal._`,
        mentions: [sender],
      });
    } catch {}
  }

  // Kick
  if (action === 'kick') {
    try {
      await sock.groupParticipantsUpdate(groupJid, [sender], 'remove');
      await sock.sendMessage(groupJid, {
        text: `🚫 @${senderNum} was removed for mass-tagging.\n\n> 🤖 *AA MD Bot*`,
        mentions: [sender],
      });
    } catch {}
  }
}

// ── Command ───────────────────────────────────────────────────────────────────
export default {
  command: 'antigm',
  alias: ['antimention', 'antieveryone', 'noeveryone'],
  description: 'Prevent @everyone / mass-mention spam in groups. Actions: delete+warn | delete | warn | kick | off',
  category: 'admin',
  groupOnly: true,
  adminOnly: true,

  async execute({ jid, args, reply, react, db }) {
    const sub = (args[0] || '').toLowerCase();
    const grp = db.groups.get(jid) || {};
    const ACTIONS = ['delete+warn', 'delete', 'warn', 'kick'];

    if (!sub || sub === 'status') {
      return reply(
        `🔔 *Anti Group Mention*\n\n` +
        `Status: *${grp.antigm ? '✅ ON' : '❌ OFF'}*\n` +
        `Action: *${grp.antigmAction || 'delete+warn'}*\n\n` +
        `📋 *Commands:*\n` +
        `• *.antigm on* — enable (default: delete+warn)\n` +
        `• *.antigm off* — disable\n` +
        `• *.antigm delete* — only delete\n` +
        `• *.antigm warn* — only warn\n` +
        `• *.antigm delete+warn* — delete and warn\n` +
        `• *.antigm kick* — delete and kick\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    if (sub === 'on') {
      db.groups.set(jid, { antigm: true, antigmAction: 'delete+warn' });
      await react('✅');
      return reply('🔔 *Anti Mass-Mention is ON*\nAction: delete + warn\n\n> 🤖 *AA MD Bot*');
    }

    if (sub === 'off') {
      db.groups.set(jid, { antigm: false });
      await react('✅');
      return reply('🔔 *Anti Mass-Mention is OFF*\n\n> 🤖 *AA MD Bot*');
    }

    if (ACTIONS.includes(sub)) {
      db.groups.set(jid, { antigm: true, antigmAction: sub });
      await react('✅');
      return reply(`🔔 *Anti Mass-Mention is ON*\nAction: *${sub}*\n\n> 🤖 *AA MD Bot*`);
    }

    return reply(`❌ Unknown action. Use: on | off | delete | warn | delete+warn | kick`);
  },
};
