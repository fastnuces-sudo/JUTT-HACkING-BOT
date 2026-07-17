// ============================================
// AA MD Bot - AI Auto Reply
// Replies naturally as a person on behalf of the owner.
// Keeps conversation history per sender (30-min TTL).
// Stays strictly within the owner's instruction context.
// ============================================

import axios from 'axios';

const CHAT_URL = 'https://text.pollinations.ai/openai';

// ── Per-sender conversation history ───────────────────────────────────────────
// key: userJid  →  value: [{ role, content }, ...]
const chatHistories  = new Map();
const historyStamps  = new Map();
const HISTORY_TTL    = 30 * 60 * 1000; // 30 minutes
const MAX_TURNS      = 8;               // keep last 8 exchanges (16 messages)

function getHistory(userJid) {
  const lastTime = historyStamps.get(userJid) || 0;
  if (Date.now() - lastTime > HISTORY_TTL) {
    chatHistories.delete(userJid);
  }
  historyStamps.set(userJid, Date.now());
  if (!chatHistories.has(userJid)) chatHistories.set(userJid, []);
  return chatHistories.get(userJid);
}

function trimHistory(history) {
  // Keep last MAX_TURNS pairs (user + assistant = 2 messages per turn)
  const max = MAX_TURNS * 2;
  if (history.length > max) history.splice(0, history.length - max);
}

function stripMarkdown(text) {
  return (text || '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')
    .replace(/_{1,2}(.*?)_{1,2}/g, '$1')
    .trim();
}

// ── Main export — called from sessionManager ──────────────────────────────────
// userJid: remoteJid of the sender — used to keep per-person history
export async function aiAutoReply(userMsg, instructions, userJid = 'default') {
  const history = getHistory(userJid);

  // Build system prompt — acts as a person but can be honest about being AI
  const systemPrompt =
    `You are an AI bot that auto-replies to WhatsApp messages on behalf of the owner.\n\n` +
    `Owner's context (stay strictly within this):\n"""\n${instructions}\n"""\n\n` +
    `Rules:\n` +
    `- Reply naturally like a real person typing on WhatsApp — short, warm, conversational.\n` +
    `- You are AI replying for the owner. If someone directly asks "are you a bot?" or "is this AI?", be honest — say yes, this is an auto-reply bot.\n` +
    `- Keep ALL replies focused on and within the owner's context above. Do not invent things not mentioned there.\n` +
    `- If the question is completely outside the context, politely say you don't have that info and the owner will reply later.\n` +
    `- Match the sender's language exactly — Urdu, English, Roman Urdu, mix — whatever they use.\n` +
    `- Do NOT use markdown, asterisks, hashtags, or any formatting. Plain conversational text only.\n` +
    `- Be brief — max 2–3 short sentences. Like a real WhatsApp reply, not an essay.\n` +
    `- Remember the conversation history and stay consistent with earlier replies.`;

  // Add this message to history
  history.push({ role: 'user', content: userMsg });

  const { data } = await axios.post(CHAT_URL, {
    model:       'openai',
    messages:    [{ role: 'system', content: systemPrompt }, ...history],
    temperature: 0.5,
    max_tokens:  250,
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 25000,
  });

  const raw = data?.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error('No response from AI');

  const clean = stripMarkdown(raw);

  // Save AI reply to history, trim if too long
  history.push({ role: 'assistant', content: clean });
  trimHistory(history);

  return clean;
}

// ── Clear history for a specific user (optional utility) ─────────────────────
export function clearAutoAiHistory(userJid) {
  chatHistories.delete(userJid);
  historyStamps.delete(userJid);
}

// ── Plugin definition ─────────────────────────────────────────────────────────
export default {
  command: 'autoai',
  alias: ['aireply', 'aiautoreply'],
  description: 'Auto-reply to DMs using AI — replies naturally as a person',
  category: 'gb',
  ownerOnly: true,
  usage: '.autoai on | .autoai off | .autoai instructions <context> | .autoai status | .autoai clearchat <num>',

  async execute({ args, reply, react, sessionSettings }) {
    const sub = (args[0] || '').toLowerCase();

    // ── STATUS ─────────────────────────────────────────────────────────────────
    if (!sub || sub === 'status' || sub === 'info') {
      const on   = sessionSettings.get('aiAutoReply');
      const inst = sessionSettings.get('aiInstructions');
      return reply(
        `🤖 *AI Auto-Reply Status*\n\n` +
        `Status: *${on ? 'ON ✅' : 'OFF ❌'}*\n\n` +
        `Instructions:\n${inst ? `_"${inst.slice(0, 200)}${inst.length > 200 ? '…' : ''}"_` : '_Not set yet_'}\n\n` +
        `━━━━━━━━━━━━━━\n` +
        `*Commands:*\n` +
        `▸ .autoai on — Enable\n` +
        `▸ .autoai off — Disable\n` +
        `▸ .autoai instructions <context> — Set persona context\n` +
        `▸ .autoai status — Check status\n` +
        `▸ .autoai clearchat <number> — Reset chat history for a number\n\n` +
        `*How it works:*\n` +
        `Set a brief description of yourself / your situation. The AI replies naturally in the sender's language, stays within your context, and remembers the conversation for 30 minutes.\n\n` +
        `*Example:*\n` +
        `_.autoai instructions My name is Ahsan. Developer from Pakistan. Busy right now, will reply later. I speak Urdu and English._\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    // ── ON ─────────────────────────────────────────────────────────────────────
    if (sub === 'on' || sub === 'enable') {
      const inst = sessionSettings.get('aiInstructions');
      if (!inst) {
        return reply(
          `⚠️ *Set your context first!*\n\n` +
          `Give the AI a short description of yourself so it knows how to reply:\n\n` +
          `*.autoai instructions* My name is Ahsan. I am busy right now and will reply soon. I speak Urdu and English.\n\n` +
          `> 🤖 *AA MD Bot*`
        );
      }
      sessionSettings.set('aiAutoReply', true);
      await react('✅');
      return reply(
        `✅ *AI Auto-Reply ENABLED*\n\n` +
        `Anyone who DMs you gets a natural reply based on your context.\n` +
        `Conversation history is remembered per person for 30 minutes.\n` +
        `Use *.autoai off* to stop.\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    // ── OFF ────────────────────────────────────────────────────────────────────
    if (sub === 'off' || sub === 'disable') {
      sessionSettings.set('aiAutoReply', false);
      await react('✅');
      return reply(`❌ *AI Auto-Reply DISABLED.*\n\n> 🤖 *AA MD Bot*`);
    }

    // ── SET INSTRUCTIONS ───────────────────────────────────────────────────────
    if (sub === 'instructions' || sub === 'inst' || sub === 'set') {
      const text = args.slice(1).join(' ').trim();
      if (!text) {
        return reply(
          `❌ *Provide a short context about yourself.*\n\n` +
          `Example:\n` +
          `_.autoai instructions I am Ahsan, a developer from Pakistan. Currently busy, will reply later. I speak both Urdu and English._\n\n` +
          `> 🤖 *AA MD Bot*`
        );
      }
      sessionSettings.set('aiInstructions', text);
      await react('✅');
      return reply(
        `✅ *Context saved!*\n\n` +
        `"${text.slice(0, 200)}${text.length > 200 ? '…' : ''}"\n\n` +
        `The AI will now reply naturally within this context.\n` +
        `Run *.autoai on* to enable.\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    // ── CLEAR CHAT HISTORY ─────────────────────────────────────────────────────
    if (sub === 'clearchat' || sub === 'clear') {
      const num = args[1]?.replace(/[^0-9]/g, '');
      if (!num) {
        return reply(`❌ Provide a number.\nExample: *.autoai clearchat 923001234567*`);
      }
      const jid = `${num}@s.whatsapp.net`;
      clearAutoAiHistory(jid);
      await react('✅');
      return reply(`✅ Chat history cleared for *+${num}*.\nNext reply will start fresh.`);
    }

    return reply(`❓ Unknown option. Use: *.autoai on/off/instructions/status/clearchat*\n\n> 🤖 *AA MD Bot*`);
  },
};
