// Shared view-once media cache
// Stores downloaded buffers keyed by message ID so .reveal can serve from cache
// even when quoted copies have expired/invalid media keys

const _cache = new Map();
const MAX = 80;

export function voCacheSet(msgId, data) {
  if (!msgId) return;
  _cache.set(msgId, data);
  if (_cache.size > MAX) {
    _cache.delete(_cache.keys().next().value);
  }
}

export function voCacheGet(msgId) {
  return _cache.get(msgId) || null;
}

export function voCacheHas(msgId) {
  return _cache.has(msgId);
}
