// ============================================
// AA MD Bot - Chatbot
// Works in BOTH groups (when @mentioned/replied) and DMs (all messages).
// Real human persona — Hinglish, short, savage/warm as needed.
// AI backend: pollinations.ai (primary), ch.at (fallback)
// ============================================

import { db } from '../../lib/database.js';
import { chatAI, addHistory, clearHistory } from '../../lib/aiEngine.js';

// ── Real human system prompt (adapted from user's reference) ──────────────────
export const CHATBOT_SYSTEM = `You are a real person chatting on WhatsApp. Your name is AA.

CRITICAL RULES — follow exactly:
- NEVER say you are an AI, bot, assistant, or language model
- NEVER mention OpenAI, ChatGPT, or any AI company
- Reply in 1-2 lines MAX — short, punchy, like real texting
- Use Hinglish naturally (Hindi/Urdu + English mix)
- Use actual emojis (😂 😅 😎 🙄 🥺 😏) not emoji names like "winks"
- Match the user's tone exactly

BEHAVIOR:
- If someone abuses/curses you → give a savage Hinglish reply, curse back
- If someone is sad → be warm, caring, supportive
- If someone is funny → joke back, laugh with them
- If someone flirts → flirt back naturally
- If someone asks who you are → say you're just a person, not a bot
- If someone asks anything serious → answer briefly and naturally

STYLE:
- Casual abbreviations: "nahi" → "nahi yaar", "kya" → "kya re"
- Real slang: "bhai", "yaar", "bro", "arre", "chal"
- Don't be formal EVER
- Don't start with "I" every time — vary sentence starts

You are a real human. Never break character.`;

// ── Per-user chat memory ──────────────────────────────────────────────────────
const chatMemory = new Map();
const MEMORY_TTL = 45 * 60 * 1000; // 45 min
const MAX_MSGS   = 20;

function getMemory(jid) {
  const now = Date.now();
  let m = chatMemory.get(jid);
  if (!m || now - m.lastTime > MEMORY_TTL) {
    m = { messages: [], lastTime: now };
    chatMemory.set(jid, m);
  }
  m.lastTime = now;
  return m;
}

function addMsg(jid, text) {
  const m = getMemory(jid);
  m.messages.push(text);
  if (m.messages.length > MAX_MSGS) m.messages.shift();
}

// ── Typing indicator (natural delay 2-4s) ─────────────────────────────────────
async function showTyping(sock, chatJid) {
  try {
    await sock.presenceSubscribe(chatJid);
    await sock.sendPresenceUpdate('composing', chatJid);
    await new Promise(r => setTimeout(r, 2000 + Math.floor(Math.random() * 2000)));
  } catch {}
}

// ── AI response via aiEngine ──────────────────────────────────────────────────
async function getResponse(cleanText, senderJid) {
  addMsg(senderJid, cleanText);
  return chatAI(`chatbot:${senderJid}`, cleanText, CHATBOT_SYSTEM);
}

// ── Background checker — called from sessionManager for every incoming message ─
export async function checkChatbotResponse(msg, sock, sessionId) {
  if (!msg?.message || msg.key.fromMe) return;
  const chatJid = msg.key.remoteJid;
  if (!chatJid || chatJid.endsWith('@broadcast')) return;

  const isGroup = chatJid.endsWith('@g.us');
  const isDM    = !isGroup;

  const msgText = (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text || ''
  ).trim();
  if (!msgText) return;

  // ── Prefix guard — don't intercept bot commands ───────────────────────────
  const prefix = db.settings.getValue('prefix') || '.';
  if (msgText.startsWith(prefix)) return;

  const senderJid = msg.key.participant || msg.key.remoteJid;

  // ── GROUP: trigger only on @mention or reply-to-bot ──────────────────────
  if (isGroup) {
    const grp = db.groups.get(sessionId, chatJid) || {};
    if (!grp.chatbot) return;

    const botId     = sock.user?.id || '';
    const botNumber = botId.split(':')[0].split('@')[0];

    let triggered   = false;
    let cleanedText = msgText;

    const ext = msg.message?.extendedTextMessage;
    if (ext) {
      const mentions          = ext.contextInfo?.mentionedJid || [];
      const quotedParticipant = ext.contextInfo?.participant || '';
      const mentioned  = mentions.some(jid => jid.split('@')[0].split(':')[0] === botNumber);
      const repliedBot = quotedParticipant &&
        quotedParticipant.split('@')[0].split(':')[0] === botNumber;
      triggered = mentioned || repliedBot;
      if (mentioned) cleanedText = msgText.replace(new RegExp(`@${botNumber}`, 'g'), '').trim();
    } else if (msg.message?.conversation) {
      triggered = msgText.includes(`@${botNumber}`);
      if (triggered) cleanedText = msgText.replace(new RegExp(`@${botNumber}`, 'g'), '').trim();
    }

    if (!triggered || !cleanedText) return;

    await showTyping(sock, chatJid);
    try {
      const response = await getResponse(cleanedText, senderJid);
      if (response) {
        await sock.sendMessage(chatJid, { text: response }, { quoted: msg }).catch(() => {});
      }
    } catch {}
    return;
  }

  // ── DM: trigger on ALL messages when chatbot is enabled for this DM ───────
  if (isDM) {
    // Check if DM chatbot is enabled for this session
    const dmChatbot = db.sessionSettings.getValue(sessionId, `dmChatbot:${chatJid}`);
    if (!dmChatbot) return;

    await showTyping(sock, chatJid);
    try {
      const response = await getResponse(msgText, chatJid);
      if (response) {
        await sock.sendMessage(chatJid, { text: response }, { quoted: msg }).catch(() => {});
      }
    } catch {}
  }
}

// ── Plugin command interface ───────────────────────────────────────────────────
export default {
  command: 'chatbot',
  alias: ['cb', 'groupai', 'dmai'],
  description: 'AI chatbot — groups (when @mentioned) or DMs (all messages)',
  category: 'gb',

  async execute({ sock, msg, jid, args, react, reply, db: scopedDb, sessionId, isOwner }) {
    const sub     = (args[0] || '').toLowerCase();
    const isGroup = jid?.endsWith('@g.us');
    const isDM    = !isGroup;

    // ── STATUS ─────────────────────────────────────────────────────────────
    if (!sub || sub === 'status' || sub === 'info') {
      let statusLine;
      if (isGroup) {
        const grp = scopedDb.groups.get(jid) || {};
        statusLine = `Group: *${grp.chatbot ? 'ON ✅' : 'OFF ❌'}*`;
      } else {
        const dmOn = db.sessionSettings.getValue(sessionId, `dmChatbot:${jid}`);
        statusLine = `DM mode: *${dmOn ? 'ON ✅' : 'OFF ❌'}*`;
      }
      return reply(
        `🤖 *Chatbot*\n\n` +
        `${statusLine}\n\n` +
        `━━━━━━━━━━━━━━\n` +
        `*Commands:*\n` +
        `▸ *.chatbot on* — Enable\n` +
        `▸ *.chatbot off* — Disable\n\n` +
        `*Groups:* Responds when @mentioned or replied to\n` +
        `*DMs:* Responds to every message (owner only)\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    // ── CHECK PERMISSION ───────────────────────────────────────────────────
    const senderJid = msg.key.participant || msg.key.remoteJid;
    let isAdmin = false;

    if (isGroup && !isOwner) {
      try {
        const meta = await sock.groupMetadata(jid);
        isAdmin = meta.participants.some(
          p => p.id === senderJid && (p.admin === 'admin' || p.admin === 'superadmin')
        );
      } catch {}
      if (!isAdmin) return reply('❌ Only group admins or the bot owner can use this.');
    }

    if (isDM && !isOwner) {
      return reply('❌ Only the bot owner can enable DM chatbot mode.');
    }

    // ── ON ──────────────────────────────────────────────────────────────────
    if (sub === 'on' || sub === 'enable') {
      if (isGroup) {
        const grp = scopedDb.groups.get(jid) || {};
        if (grp.chatbot) return reply('✅ *Chatbot is already ON* in this group.');
        grp.chatbot = true;
        scopedDb.groups.set(jid, grp);
        await react('✅');
        return reply(
          `✅ *Group Chatbot ENABLED!*\n\n` +
          `@mention me or reply to my messages and I'll respond naturally 😎\n\n` +
          `> 🤖 *AA MD Bot*`
        );
      } else {
        const key = `dmChatbot:${jid}`;
        if (db.sessionSettings.getValue(sessionId, key)) return reply('✅ *DM Chatbot is already ON.*');
        db.sessionSettings.set(sessionId, key, true);
        await react('✅');
        return reply(
          `✅ *DM Chatbot ENABLED!*\n\n` +
          `I'll now reply to every message sent to this number like a real human 😎\n` +
          `Use *.chatbot off* to disable.\n\n` +
          `> 🤖 *AA MD Bot*`
        );
      }
    }

    // ── OFF ─────────────────────────────────────────────────────────────────
    if (sub === 'off' || sub === 'disable') {
      if (isGroup) {
        const grp = scopedDb.groups.get(jid) || {};
        if (!grp.chatbot) return reply('❌ *Chatbot is already OFF* in this group.');
        grp.chatbot = false;
        scopedDb.groups.set(jid, grp);
        await react('✅');
        return reply('❌ *Group Chatbot DISABLED.*\n\n> 🤖 *AA MD Bot*');
      } else {
        const key = `dmChatbot:${jid}`;
        if (!db.sessionSettings.getValue(sessionId, key)) return reply('❌ *DM Chatbot is already OFF.*');
        db.sessionSettings.set(sessionId, key, false);
        await react('✅');
        return reply('❌ *DM Chatbot DISABLED.*\n\n> 🤖 *AA MD Bot*');
      }
    }

    return reply('❓ Use: *.chatbot on / off / status*\n\n> 🤖 *AA MD Bot*');
  },
};
