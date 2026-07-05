// ============================================
// AA MD Bot - Anti Bad Words (Group)
// Developer: Ahsan Ali | AA Mods
// ============================================

import { db } from '../../lib/database.js';

const DEFAULT_BAD_WORDS = [
  'fuck','shit','bitch','asshole','bastard','cunt','dick','pussy',
  'faggot','retard','whore','slut','motherfucker','bullshit','cock','rape',
];

// Per-group custom word lists (in-memory; persist via db.groups)
function getGroupWords(groupJid) {
  const grp = db.groups.get(groupJid) || {};
  const custom = grp.badWords || [];
  return new Set([...DEFAULT_BAD_WORDS, ...custom]);
}

function containsBadWord(text, badWords) {
  const lower = text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
  for (const word of badWords) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(lower)) return word;
  }
  return null;
}

// Called passively from sessionManager for every group message
export async function checkBadWords(msg, sock, sessionId) {
  if (!msg?.message || !msg?.key?.remoteJid?.endsWith('@g.us')) return;
  if (msg.key.fromMe) return;

  const chatJid = msg.key.remoteJid;
  const grp = db.groups.get(chatJid) || {};
  if (!grp.antibadwords) return;

  const text = (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption || ''
  ).trim();

  if (!text) return;

  const badWords = getGroupWords(chatJid);
  const found = containsBadWord(text, badWords);
  if (!found) return;

  const senderJid = msg.key.participant || msg.key.remoteJid;

  try {
    // Delete the message
    await sock.sendMessage(chatJid, { delete: msg.key });
    // Warn the user
    await sock.sendMessage(chatJid, {
      text: `⚠️ @${senderJid.split('@')[0]} Bad language is not allowed here. Please be respectful!\n\n> 🤖 *AA MD Bot*`,
      mentions: [senderJid],
    });
  } catch {}
}

export default {
  command: 'antibadwords',
  alias: ['abw', 'antiswear', 'badwords'],
  description: 'Toggle bad word filter in groups. Add/remove custom words.',
  category: 'admin',
  groupOnly: true,
  adminOnly: true,

  async execute({ jid, args, reply, react, db }) {
    const sub = (args[0] || '').toLowerCase().trim();
    const grp = db.groups.get(jid) || {};

    if (!sub || sub === 'status') {
      const status = grp.antibadwords ? '✅ ON' : '❌ OFF';
      const custom = (grp.badWords || []);
      return reply(
        `🚫 *Anti Bad Words*\n\n` +
        `Status: *${status}*\n` +
        `Custom words: ${custom.length ? custom.join(', ') : 'none'}\n\n` +
        `📋 *Commands:*\n` +
        `• *.antibadwords on* — enable\n` +
        `• *.antibadwords off* — disable\n` +
        `• *.antibadwords add <word>* — add custom word\n` +
        `• *.antibadwords remove <word>* — remove custom word\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    if (sub === 'on') {
      grp.antibadwords = true; db.groups.set(jid, grp); await react('✅');
      return reply(`✅ *Anti Bad Words enabled!*\n\nBad language will be auto-deleted.\n\n> 🤖 *AA MD Bot*`);
    }
    if (sub === 'off') {
      grp.antibadwords = false; db.groups.set(jid, grp); await react('❌');
      return reply(`❌ *Anti Bad Words disabled.*\n\n> 🤖 *AA MD Bot*`);
    }

    if (sub === 'add') {
      const word = (args[1] || '').toLowerCase().trim();
      if (!word) return reply(`⚠️ Usage: *.antibadwords add <word>*\n\n> 🤖 *AA MD Bot*`);
      grp.badWords = [...new Set([...(grp.badWords || []), word])];
      db.groups.set(jid, grp); await react('✅');
      return reply(`✅ *Word "${word}" added to filter.*\n\n> 🤖 *AA MD Bot*`);
    }

    if (sub === 'remove' || sub === 'rm') {
      const word = (args[1] || '').toLowerCase().trim();
      grp.badWords = (grp.badWords || []).filter(w => w !== word);
      db.groups.set(jid, grp); await react('✅');
      return reply(`✅ *Word "${word}" removed from filter.*\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
