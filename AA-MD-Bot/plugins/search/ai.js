// ============================================
// AA MD Bot - AI Chat
// Uses pollinations.ai — completely free, no API key
// Model: openai (GPT-4o / GPT-OSS-20B)
// ============================================

import axios from 'axios';

const CHAT_URL = 'https://text.pollinations.ai/openai';

const SYSTEM_PROMPT =
  'You are AA MD Bot, a helpful WhatsApp assistant made by AA Mods (Ahsan Ali Wadani). ' +
  'Keep responses concise, clear, and professional. ' +
  'IMPORTANT: Write in plain text only. Do NOT use markdown symbols like **, ##, __, or backticks. ' +
  'Do not use bullet dashes. Use plain numbering (1. 2. 3.) if listing. Be friendly and direct.';

// Per-chat conversation memory — bounded to 200 JIDs max (LRU-style eviction)
const _memory   = new Map();
const _lastUsed = new Map();
const MAX_JIDS  = 200;
const MAX_MSG   = 12; // per JID

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

async function chat(jid, userMsg) {
  addHistory(jid, 'user', userMsg);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...getHistory(jid),
  ];

  const { data } = await axios.post(CHAT_URL, {
    model: 'openai',
    messages,
    temperature: 0.7,
    max_tokens: 1024,
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
  });

  let reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error('No response from AI');

  // Strip leftover markdown the AI may include despite instructions
  reply = reply
    .replace(/\*\*(.*?)\*\*/g, '$1')       // **bold** → plain
    .replace(/#{1,6}\s+/gm, '')             // ## headings → plain
    .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')  // `code` → plain
    .replace(/_{2}(.*?)_{2}/g, '$1')        // __text__ → plain
    .trim();

  addHistory(jid, 'assistant', reply);
  return reply;
}

export default {
  command: 'ai',
  alias: ['gpt', 'gemini', 'aichat', 'chat', 'llama', 'mistral'],
  description: 'Chat with AI — free, no key needed',
  category: 'search',

  async execute({ command, text, reply, react, jid, prefix }) {
    if (!text) return reply(
      `🤖 *AA MD Bot AI*\n\n` +
      `*Usage:* ${prefix}ai <your question>\n\n` +
      `*Available commands:*\n` +
      `• ${prefix}ai — Chat with AI\n` +
      `• ${prefix}gpt — Chat with AI\n` +
      `• ${prefix}gemini — Chat with AI\n` +
      `• ${prefix}mistral — Chat with AI\n` +
      `• ${prefix}llama — Chat with AI\n\n` +
      `*Image generation:*\n` +
      `• ${prefix}imagine <description>\n\n` +
      `*Clear chat history:*\n` +
      `• ${prefix}ai clear\n\n` +
      `> 🤖 *AA MD Bot*`
    );

    if (text.toLowerCase() === 'clear') {
      clearHistory(jid);
      return reply(`🧹 *Chat history cleared.*\n\n> 🤖 *AA MD Bot*`);
    }

    await react('🤖');
    try {
      const response = await chat(jid, text);
      await react('✅');
      reply(`🤖 *AI*\n\n${response}\n\n> 🤖 *AA MD Bot*`);
    } catch (e) {
      await react('❌');
      reply(`❌ AI error: ${e.message}\n\nTry again in a few seconds.`);
    }
  },
};
