// ============================================
// AA MD Bot - AI Chat
// Uses pollinations.ai — completely free, no API key
// Models: openai (GPT-4o), mistral, gemini, llama
// Image gen: image.pollinations.ai
// ============================================

import axios from 'axios';

const CHAT_URL  = 'https://text.pollinations.ai/openai';
const IMAGE_URL = 'https://image.pollinations.ai/prompt';

const SYSTEM_PROMPT =
  'You are AA MD Bot, a helpful WhatsApp assistant made by AA Mods (Ahsan Ali Wadani). ' +
  'Keep responses concise and clear. Use WhatsApp formatting (*bold*, _italic_, ~strikethrough~) where helpful.';

// Per-chat conversation memory — bounded to 200 JIDs max (LRU-style eviction)
const _memory   = new Map();
const _lastUsed = new Map();
const MAX_JIDS  = 200;
const MAX_MSG   = 12; // per JID

function evictOldest() {
  if (_memory.size <= MAX_JIDS) return;
  // evict the JID not used for the longest time
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

async function chat(jid, userMsg, model = 'openai') {
  addHistory(jid, 'user', userMsg);
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...getHistory(jid),
  ];

  const { data } = await axios.post(CHAT_URL, {
    model,
    messages,
    temperature: 0.7,
    max_tokens: 1024,
  }, {
    params: { model },
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
  });

  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error('No response from AI');
  addHistory(jid, 'assistant', reply);
  return reply;
}

const MODELS = {
  gpt: 'openai', openai: 'openai', gpt4: 'openai',
  mistral: 'mistral', mist: 'mistral',
  gemini: 'gemini', google: 'gemini',
  llama: 'llama', meta: 'llama',
};

export default {
  command: 'ai',
  alias: ['gpt', 'gemini', 'aichat', 'chat', 'llama', 'mistral'],
  description: 'Chat with AI (GPT-4o, Gemini, Mistral, Llama) — free, no key needed',
  category: 'search',

  async execute({ command, text, reply, react, jid, prefix }) {
    // Model selection from command alias
    const model = MODELS[command.toLowerCase()] || 'openai';
    const modelName = model === 'openai' ? 'GPT-4o' : model.charAt(0).toUpperCase() + model.slice(1);

    if (!text) return reply(
      `🤖 *AA MD Bot AI*\n\n` +
      `*Usage:* ${prefix}ai <your question>\n\n` +
      `*Available models:*\n` +
      `• ${prefix}ai / ${prefix}gpt — GPT-4o\n` +
      `• ${prefix}gemini — Google Gemini\n` +
      `• ${prefix}mistral — Mistral\n` +
      `• ${prefix}llama — Meta Llama\n\n` +
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
      const response = await chat(jid, text, model);
      await react('✅');
      reply(`🤖 *${modelName}*\n\n${response}\n\n> 🤖 *AA MD Bot*`);
    } catch (e) {
      await react('❌');
      reply(`❌ AI error: ${e.message}\n\nTry again in a few seconds.`);
    }
  },
};
