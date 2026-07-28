// ── AA MD Bot - Shared AI Engine ─────────────────────────────────────────────
// Single source for all AI chat: .ai command, .chatbot group, .autoai DM relay
// Fallback chain: pollinations POST → pollinations GET → ch.at
//
// All three endpoints are tested working from Replit/Oracle IPs.
// pollinations POST is primary — fastest, multi-turn, most capable.

import axios from 'axios';

// ── Conversation memory ───────────────────────────────────────────────────────
const _mem     = new Map(); // jid → [{ role, content }, ...]
const _lru     = new Map(); // jid → last-used timestamp
const MAX_JIDS = 300;
const MAX_TURNS = 20; // 10 exchanges

function evict() {
  if (_mem.size <= MAX_JIDS) return;
  let old = null, oldT = Infinity;
  for (const [j, t] of _lru) if (t < oldT) { old = j; oldT = t; }
  if (old) { _mem.delete(old); _lru.delete(old); }
}

export function getHistory(jid)  { return _mem.get(jid) || []; }
export function clearHistory(jid) { _mem.delete(jid); _lru.delete(jid); }

export function addHistory(jid, role, content) {
  const h = getHistory(jid);
  h.push({ role, content });
  if (h.length > MAX_TURNS) h.splice(0, h.length - MAX_TURNS);
  _mem.set(jid, h);
  _lru.set(jid, Date.now());
  evict();
}

// ── Default system prompt ─────────────────────────────────────────────────────
export const DEFAULT_SYSTEM = `You are AA MD Bot, a WhatsApp AI assistant by AA Mods.

ANSWER LENGTH — match the question:
- Simple/factual → 1 to 3 lines, straight answer
- Needs explanation → explain fully, no padding
- Step-by-step → numbered steps only
- Code → working code, explain only if asked

FORMATTING — WhatsApp markdown strictly:
- *bold* for headings and key terms
- _italic_ for examples
- • bullets, 1. 2. 3. for steps
- NO #, ##, **, __, \`\`\`

BEHAVIOR:
- Never repeat the question, never say "Great question!"
- Match user language exactly (Urdu, Roman Urdu, English, Arabic)
- For Islam: answer from Quran/Sunnah accurately
- If unsure: say so briefly`;

export const HINGLISH_SYSTEM = `You are a casual WhatsApp chatbot. Reply like a real person texting.

Rules:
- 1-2 lines MAX — short and punchy
- Use Hinglish naturally (Hindi/Urdu + English mix)
- Use real emojis (😂 😅 😎 🙄 🥺)
- If abused → give savage reply
- If someone is sad → be warm
- If someone is funny → joke back
- NEVER say you are an AI or a bot`;

// ── Backend 1: pollinations.ai POST (PRIMARY — fastest, multi-turn) ───────────
async function tryPollinationsPost(messages, model = 'openai-fast') {
  const { data } = await axios.post(
    'https://text.pollinations.ai/openai',
    { model, messages, temperature: 0.4, max_tokens: 600 },
    { headers: { 'Content-Type': 'application/json' }, timeout: 22000 }
  );
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text || text.length < 2) throw new Error('empty');
  return text;
}

// ── Backend 2: pollinations.ai GET (FAST — single turn, no key) ──────────────
async function tryPollinationsGet(userMsg) {
  const encoded = encodeURIComponent(String(userMsg).slice(0, 600));
  const res = await axios.get(
    `https://text.pollinations.ai/${encoded}?model=openai&seed=${Date.now() % 9999}`,
    { timeout: 18000 }
  );
  const text = typeof res.data === 'string' ? res.data.trim() : null;
  if (!text || text.length < 2) throw new Error('empty');
  return text;
}

// ── Backend 3: ch.at (FALLBACK — free, no key) ────────────────────────────────
async function tryChAt(userMsg) {
  const res = await axios.post(
    'https://ch.at/api/chat',
    { message: String(userMsg).slice(0, 600) },
    { headers: { 'Content-Type': 'application/json', 'User-Agent': 'AA-MD-Bot/3.0' }, timeout: 14000 }
  );
  const raw = typeof res.data === 'string'
    ? res.data
    : (res.data?.answer || res.data?.reply || res.data?.message || '');
  // Response format: "Q: ...\nA: <actual answer>"
  const match = raw.match(/\bA:\s*([\s\S]+)$/);
  const text  = match ? match[1].trim() : (raw.trim().length > 2 ? raw.trim() : null);
  if (!text) throw new Error('empty');
  return text;
}

// ── Backend 4: pollinations alternate models ───────────────────────────────────
async function tryPollinationsModel(messages, model) {
  const { data } = await axios.post(
    'https://text.pollinations.ai/openai',
    { model, messages, temperature: 0.5, max_tokens: 600 },
    { headers: { 'Content-Type': 'application/json' }, timeout: 22000 }
  );
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text || text.length < 2) throw new Error('empty');
  return text;
}


// ── Markdown cleanup for WhatsApp ─────────────────────────────────────────────
function cleanMarkdown(text) {
  return text
    .replace(/^#{1,6}\s+/gm, '*')
    .replace(/\*\*(.*?)\*\*/g, '*$1*')
    .replace(/__(.*?)__/g, '_$1_')
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

// ── Main chat function ─────────────────────────────────────────────────────────
// jid         — unique conversation key (groupJid, userJid, etc.)
// userMsg     — what the user said
// systemPrompt — optional custom system prompt (defaults to DEFAULT_SYSTEM)
// Returns the AI reply string.
export async function chatAI(jid, userMsg, systemPrompt) {
  addHistory(jid, 'user', userMsg);

  const messages = [
    { role: 'system', content: systemPrompt || DEFAULT_SYSTEM },
    ...getHistory(jid),
  ];

  let reply = null;

  // 1. pollinations POST — primary (openai-fast model)
  reply = await tryPollinationsPost(messages).catch(() => null);

  // 2. pollinations GET — fast single-turn fallback
  if (!reply) {
    const flatCtx = messages
      .filter(m => m.role !== 'system')
      .slice(-4)
      .map(m => `${m.role === 'user' ? 'User' : 'Bot'}: ${m.content}`)
      .join('\n') + '\nUser: ' + userMsg;
    reply = await tryPollinationsGet(flatCtx).catch(() => null);
  }

  // 3. pollinations alternate models (mistral, openai-large, claude)
  if (!reply) {
    for (const model of ['mistral', 'openai-large', 'claude-sonnet-4-5']) {
      reply = await tryPollinationsModel(messages, model).catch(() => null);
      if (reply) break;
    }
  }

  // 4. ch.at — free no-key fallback
  if (!reply) {
    reply = await tryChAt(userMsg).catch(() => null);
  }

  if (!reply) throw new Error('AI unavailable — try again in a moment.');

  const cleaned = cleanMarkdown(reply);
  addHistory(jid, 'assistant', cleaned);
  return cleaned;
}
