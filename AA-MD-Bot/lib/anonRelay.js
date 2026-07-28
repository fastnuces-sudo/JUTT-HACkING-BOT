// ── AA MD Bot - Anonymous Relay Manager ──────────────────────────────────────
// Tracks active two-way anon sessions.
//
// Session key  = normalized targetJid
// When target replies (plain DM to bot), message is relayed to senderJid
// with no identifying info on either side.
//
// Sessions expire after 24 hours or when the sender calls .anon end.

const RELAY_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Map: targetJid → { senderJid, sock, sessionId, expires, count }
export const anonSessions = new Map();

function norm(jid) {
  if (!jid) return '';
  return jid.includes(':') ? jid.split(':')[0] + '@s.whatsapp.net' : jid;
}

// ── Start / replace a relay session ──────────────────────────────────────────
export function startAnonSession(senderJid, targetJid, sock, sessionId) {
  const key = norm(targetJid);
  anonSessions.set(key, {
    senderJid: norm(senderJid),
    sock,
    sessionId,
    expires: Date.now() + RELAY_TTL,
    count: 0,
  });
  // Auto-cleanup after TTL
  setTimeout(() => {
    const s = anonSessions.get(key);
    if (s && Date.now() >= s.expires) anonSessions.delete(key);
  }, RELAY_TTL);
}

// ── End session by sender (on .anon end) ─────────────────────────────────────
export function endAnonSessionBySender(senderJid) {
  const normSender = norm(senderJid);
  for (const [key, session] of anonSessions) {
    if (norm(session.senderJid) === normSender) {
      anonSessions.delete(key);
      return true;
    }
  }
  return false;
}

// ── Check if incoming DM is a relay reply ─────────────────────────────────────
// Returns true if this message was handled as a relay reply (caller should return early).
// jid = the person who is sending (i.e. the target who got the anon msg)
export async function checkAnonRelay(sock, jid, text) {
  if (!text || !jid || jid.endsWith('@g.us')) return false;

  const key = norm(jid);
  const session = anonSessions.get(key);
  if (!session) return false;
  if (Date.now() >= session.expires) {
    anonSessions.delete(key);
    return false;
  }

  session.count++;

  try {
    // Forward to original sender — no info about who replied
    await session.sock.sendMessage(norm(session.senderJid), {
      text: `📨 *Anonymous Reply:*\n\n${text}`,
    });
    // Brief ack to the replier (no identity info)
    await sock.sendMessage(jid, {
      text: `✅ _Your reply was delivered._`,
    });
  } catch (_) {
    // Silently ignore delivery errors
  }

  return true;
}
