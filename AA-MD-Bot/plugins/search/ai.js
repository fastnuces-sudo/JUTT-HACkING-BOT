// ============================================
// AA MD Bot - AI Chat (Powerful Edition)
// Multi-model fallback: openai → mistral → claude
// Per-chat memory, intelligent system prompt,
// WhatsApp markdown formatting
// ============================================

import axios from 'axios';

const CHAT_URL = 'https://text.pollinations.ai/openai';

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are AA MD Bot, a WhatsApp AI assistant by AA Mods.

ANSWER LENGTH — match the question:
- Simple/factual question → 1 to 3 lines, straight answer
- Needs explanation → explain fully but without padding or repetition
- Step-by-step/how-to → numbered steps, no extra fluff
- Code → working code only, explain only if user asks

FORMATTING — WhatsApp markdown strictly:
- *bold* for headings and key terms
- _italic_ for examples or emphasis
- • for bullet lists, 1. 2. 3. for steps
- No markdown symbols like #, ##, **, __, \`\`\` — these break in WhatsApp

BEHAVIOR:
- Never repeat the question, never say "Great question!" or similar filler
- Never add unnecessary intro or outro
- Match user language exactly (Urdu, English, Roman Urdu, Arabic, etc.)
- For Islam: answer from Quran/Sunnah accurately
- If unsure: say so briefly, give best reasoning`;

// ── Model fallback chain ─────────────────────────────────────────────────────
const MODELS = ['openai', 'claude', 'unity'];

// ── Per-chat conversation memory (LRU, max 300 JIDs, 20 msgs each) ───────────
const _memory   = new Map();
const _lastUsed = new Map();
const MAX_JIDS  = 300;
const MAX_MSG   = 20;   // keep last 20 messages per chat (10 exchanges)

function evictOldest() {
  if (_memory.size <= MAX_JIDS) return;
  let oldest = null, oldestTime = Infinity;
  for (const [j, t] of _lastUsed.entries()) {
    if (t < oldestTime) { oldest = j; oldestTime = t; }
  }
  if (oldest) { _memory.delete(oldest); _lastUsed.delete(oldest); }
}

function getHistory(jid) { return _memory.get(jid) || []; }

function addHistory(jid, role, content) {
  const hist = getHistory(jid);
  hist.push({ role, content });
  if (hist.length > MAX_MSG) hist.splice(0, hist.length - MAX_MSG);
  _memory.set(jid, hist);
  _lastUsed.set(jid, Date.now());
  evictOldest();
}

function clearHistory(jid) { _memory.delete(jid); _lastUsed.delete(jid); }

// ── Attempt one model ────────────────────────────────────────────────────────
async function tryModel(model, messages) {
  const { data } = await axios.post(CHAT_URL, {
    model,
    messages,
    temperature: 0.3,
    max_tokens: 1200,
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 40000,
  });
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response');
  return text;
}

// ── Chat with fallback chain ─────────────────────────────────────────────────
async function chat(jid, userMsg) {
  addHistory(jid, 'user', userMsg);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...getHistory(jid),
  ];

  let reply = null;
  let lastError = null;

  for (const model of MODELS) {
    try {
      reply = await tryModel(model, messages);
      break;
    } catch (e) {
      lastError = e;
    }
  }

  if (!reply) throw lastError || new Error('All AI models failed');

  // Clean any leftover raw markdown that shouldn't appear in WhatsApp
  reply = reply
    .replace(/^#{1,6}\s+/gm, '*')          // ## headings → *bold
    .replace(/\*\*(.*?)\*\*/g, '*$1*')      // **bold** → *bold*
    .replace(/__(.*?)__/g, '_$1_')          // __italic__ → _italic_
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '$1')  // strip code fences
    .replace(/`([^`]+)`/g, '$1')            // strip inline code ticks
    .trim();

  addHistory(jid, 'assistant', reply);
  return reply;
}

export default {
  command: 'ai',
  alias: ['gpt', 'gemini', 'aichat', 'chat', 'llama', 'mistral', 'claude', 'ask'],
  description: 'Powerful AI chat — multi-model, memory, smart formatting',
  category: 'search',

  async execute({ text, reply, react, jid, prefix }) {
    if (!text) return reply(
      `🤖 *AA MD Bot AI — Powered*\n\n` +
      `*Usage:* ${prefix}ai <your question>\n\n` +
      `*Examples:*\n` +
      `• ${prefix}ai Explain quantum entanglement\n` +
      `• ${prefix}ai Write a Fibonacci sequence in Python\n` +
      `• ${prefix}ai How many rakats does each prayer have?\n` +
      `• ${prefix}ai Write a professional email for job application\n\n` +
      `*Commands:*\n` +
      `• ${prefix}ai clear — Clear chat history\n\n` +
      `*Features:*\n` +
      `• Multi-model AI (GPT-4o, Mistral, Claude)\n` +
      `• Remembers your last 10 exchanges\n` +
      `• Answers in your language (Urdu/English/Arabic)\n` +
      `• Expert-level detailed responses\n\n` +
      `> 🤖 *AA MD Bot*`
    );

    if (text.toLowerCase() === 'clear') {
      clearHistory(jid);
      return reply(`🧹 *Chat history cleared.*\n\nFresh start — ask me anything!\n\n> 🤖 *AA MD Bot*`);
    }

    await react('🤖');
    try {
      const response = await chat(jid, text);
      await react('✅');
      reply(`🤖 *AI*\n\n${response}\n\n> 🤖 *AA MD Bot*`);
    } catch (e) {
      await react('❌');
      reply(`❌ *AI Error*\n\n${e.message}\n\nTry again in a few seconds.\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
