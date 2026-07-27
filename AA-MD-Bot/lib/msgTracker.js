// ── Sent-message tracker ──────────────────────────────────────────────────────
// Keeps the last MAX_PER_CHAT message keys the bot sent per chat per session.
// Used by .aj to delete all own messages in a chat for everyone.

const _store = new Map(); // key: `sessionId|remoteJid` → MessageKey[]
const MAX_PER_CHAT = 500; // cap per chat to avoid unbounded memory

function _key(sessionId, remoteJid) {
  return `${sessionId}|${remoteJid}`;
}

/** Record a sent message key (call whenever msg.key.fromMe is true) */
export function trackSentMessage(sessionId, msgKey) {
  const jid = msgKey.remoteJid;
  if (!sessionId || !jid || jid === 'status@broadcast') return;

  const k = _key(sessionId, jid);
  if (!_store.has(k)) _store.set(k, []);
  const arr = _store.get(k);
  arr.push({ ...msgKey }); // shallow copy
  if (arr.length > MAX_PER_CHAT) arr.splice(0, arr.length - MAX_PER_CHAT);
}

/** Return all tracked keys for a chat, then clear them */
export function popSentMessages(sessionId, remoteJid) {
  const k = _key(sessionId, remoteJid);
  const msgs = _store.get(k) || [];
  _store.delete(k);
  return msgs;
}

/** Count tracked messages in a chat */
export function countSentMessages(sessionId, remoteJid) {
  return (_store.get(_key(sessionId, remoteJid)) || []).length;
}
