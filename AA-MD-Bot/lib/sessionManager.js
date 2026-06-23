import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';
import { EventEmitter } from 'events';
import { logger } from './logger.js';
import { db } from './database.js';
import config from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessionDir = path.join(__dirname, '../session');
fs.ensureDirSync(sessionDir);

export const sessions = new Map();
export const botEvents = new EventEmitter();
botEvents.setMaxListeners(100);

export const sessionQRs = new Map();
export const sessionStatus = new Map();
// Persist last-known session info so dashboard stays stable during reconnects
export const sessionInfo = new Map();

// Track reconnect attempts per session for exponential backoff
const reconnectAttempts = new Map();

let messageHandler = null;
let connectionHandler = null;

export function setMessageHandler(fn) { messageHandler = fn; }
export function setConnectionHandler(fn) { connectionHandler = fn; }

// ── Auto Status Handler ─────────────────────────────────────────────────────
// Handles status@broadcast messages: auto-view, auto-react, auto-save
async function handleStatusMessage(sock, msg, sessionId) {
  try {
    const settings = db.settings.get();
    const senderJid = msg.key.participant || msg.key.remoteJid;

    // Skip own statuses
    if (msg.key.fromMe) return;

    // 1) Auto-View: mark the status as read
    const autoView = settings.autoStatusView ?? config.autoStatusView ?? true;
    if (autoView) {
      await sock.readMessages([msg.key]).catch(() => {});
    }

    // 2) Auto-React: react with a heart emoji
    const autoReact = settings.autoStatusReact ?? config.autoStatusReact ?? true;
    const statusEmoji = settings.statusEmoji ?? config.statusEmoji ?? '❤️';
    if (autoReact) {
      await sock.sendMessage('status@broadcast', {
        react: { text: statusEmoji, key: msg.key },
      }).catch(() => {});
    }

    // 3) Auto-Save/Forward: forward the status to owner DM
    const autoSave = settings.autoStatus ?? config.autoStatus ?? false;
    if (autoSave) {
      const ownerNum = (config.ownerNumber?.[0] || '').replace(/\D/g, '');
      if (!ownerNum) return;
      const ownerJid = `${ownerNum}@s.whatsapp.net`;

      const m = msg.message;
      const caption = `📸 *Status from:* @${senderJid.split('@')[0]}\n🕐 ${new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}`;

      if (m?.imageMessage) {
        await sock.sendMessage(ownerJid, {
          forward: msg,
          force: true,
        }).catch(() => {});
      } else if (m?.videoMessage) {
        await sock.sendMessage(ownerJid, {
          forward: msg,
          force: true,
        }).catch(() => {});
      } else if (m?.conversation || m?.extendedTextMessage?.text) {
        const text = m.conversation || m.extendedTextMessage?.text;
        await sock.sendMessage(ownerJid, {
          text: `📝 *Status Text:*\n${text}\n\n${caption}`,
        }).catch(() => {});
      }
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'handleStatusMessage error');
  }
}

export async function createSession(sessionId = 'default', usePairingCode = false, phoneNumber = null) {
  // Avoid duplicate sessions
  if (sessions.has(sessionId)) {
    logger.warn({ sessionId }, 'Session already exists, skipping');
    return sessions.get(sessionId);
  }

  const sessionPath = path.join(sessionDir, sessionId);
  fs.ensureDirSync(sessionPath);

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();
  const silentLogger = pino({ level: 'silent' });

  // Track if this session was ever successfully registered
  let wasRegistered = state.creds.registered || false;

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
    },
    printQRInTerminal: !usePairingCode,
    logger: silentLogger,
    generateHighQualityLinkPreview: true,
    getMessage: async () => ({ conversation: '' }),
    syncFullHistory: false,
    markOnlineOnConnect: true,
  });

  sock.sessionId = sessionId;
  sessionStatus.set(sessionId, 'connecting');

  sock.ev.on('creds.update', () => {
    wasRegistered = sock.authState?.creds?.registered || wasRegistered;
    saveCreds();
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      sessionQRs.set(sessionId, qr);
      sessionStatus.set(sessionId, 'qr');
      botEvents.emit('qr', { sessionId, qr });
      logger.info({ sessionId }, '📱 QR ready — scan now');
    }

    if (connection === 'open') {
      wasRegistered = true;
      reconnectAttempts.delete(sessionId); // reset conflict counter on successful connect
      sessionQRs.delete(sessionId);
      sessionStatus.set(sessionId, 'connected');
      const phone = sock.user?.id?.split('@')[0]?.split(':')[0] || '';
      sessionInfo.set(sessionId, { id: sessionId, jid: sock.user?.id, name: sock.user?.name, phone });
      botEvents.emit('status', { sessionId, status: 'connected', user: sock.user });
      logger.info({ sessionId, name: sock.user?.name }, '✅ WhatsApp Connected!');
      db.sessions.set(sessionId, {
        id: sessionId, jid: sock.user?.id, name: sock.user?.name,
        connected: true, connectedAt: Date.now(),
      });
      if (connectionHandler) connectionHandler(sessionId, sock, 'open');

      // Connection confirmation message removed — was spamming DM on every restart
    }

    if (connection === 'connecting') {
      sessionStatus.set(sessionId, 'connecting');
      botEvents.emit('status', { sessionId, status: 'connecting' });
    }

    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const isLoggedOut = reason === DisconnectReason.loggedOut || reason === 401;

      sessionQRs.delete(sessionId);
      sessions.delete(sessionId);

      logger.warn({ sessionId, reason, wasRegistered }, 'Connection closed');

      if (isLoggedOut) {
        // Permanently logged out — clean session files
        reconnectAttempts.delete(sessionId);
        sessionStatus.set(sessionId, 'logged_out');
        botEvents.emit('status', { sessionId, status: 'logged_out' });
        db.sessions.delete(sessionId);
        await fs.remove(sessionPath).catch(() => {});
        logger.info({ sessionId }, '🔴 Session logged out & removed');

      } else if (wasRegistered) {
        // 440 = connectionReplaced — another instance/device took over the session
        const isConflict = reason === 440;

        if (isConflict) {
          const attempts = (reconnectAttempts.get(sessionId) || 0) + 1;
          reconnectAttempts.set(sessionId, attempts);

          if (attempts > 5) {
            // Too many conflicts in a row — stop retrying to avoid fight loop
            reconnectAttempts.delete(sessionId);
            sessionStatus.set(sessionId, 'disconnected');
            botEvents.emit('status', { sessionId, status: 'disconnected' });
            logger.error({ sessionId }, '🛑 Too many session conflicts (440). Stop reconnecting — close other WhatsApp sessions/tabs then restart bot.');
          } else {
            // Exponential backoff: 15s → 30s → 60s → 120s → 120s
            const delay = Math.min(15000 * Math.pow(2, attempts - 1), 120000);
            sessionStatus.set(sessionId, 'reconnecting');
            botEvents.emit('status', { sessionId, status: 'reconnecting' });
            logger.info({ sessionId, attempt: attempts, delaySec: delay / 1000 }, `🔄 Session conflict — reconnecting in ${delay / 1000}s (attempt ${attempts}/5)...`);
            setTimeout(() => createSession(sessionId, false, null), delay);
          }

        } else {
          // Normal disconnect — reconnect in 5s, reset conflict counter
          reconnectAttempts.delete(sessionId);
          sessionStatus.set(sessionId, 'reconnecting');
          botEvents.emit('status', { sessionId, status: 'reconnecting' });
          logger.info({ sessionId }, '🔄 Reconnecting in 5s...');
          setTimeout(() => createSession(sessionId, false, null), 5000);
        }

      } else {
        // Never connected (waiting for QR) — don't spam reconnect
        reconnectAttempts.delete(sessionId);
        sessionStatus.set(sessionId, 'disconnected');
        botEvents.emit('status', { sessionId, status: 'disconnected' });
        logger.info({ sessionId }, '⚪ Session closed (never connected)');
      }
    }
  });

  // In-memory cache for anti-delete (last 60 messages per JID)
  const _msgCache = new Map();
  const _CACHE_MAX = 60;

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message) continue;

      // ── Anti-Delete: detect protocolMessage REVOKE ────────────
      const proto = msg.message?.protocolMessage;
      if (proto?.type === 0) { // type 0 = REVOKE (message deleted)
        try {
          const deletedKey = proto.key;
          const chatJid = deletedKey?.remoteJid || msg.key.remoteJid;
          const deletedId = deletedKey?.id;
          const groupMsg = chatJid?.endsWith('@g.us');
          const settings = db.settings.get();
          const adGroup = groupMsg ? (db.groups.get(chatJid)?.antidelete ?? settings.antidelete ?? false) : false;
          const adDm    = !groupMsg ? (settings.antidelete ?? false) : false;
          if (adGroup || adDm) {
            const cache = _msgCache.get(chatJid);
            const original = cache?.get(deletedId);
            if (original) {
              const deleter = msg.key.participant || msg.key.remoteJid;
              const deleterNum = deleter?.split('@')[0]?.split(':')[0] || '?';
              await sock.sendMessage(chatJid, {
                text: `🗑️ *Anti-Delete* — Message recovered\n👤 Deleted by: @${deleterNum}`,
                mentions: [deleter],
              }).catch(() => {});
              await sock.sendMessage(chatJid, { forward: original, force: true }).catch(() => {});
            }
          }
        } catch {}
        continue;
      }

      // Cache this message for potential anti-delete recovery
      const cJid = msg.key.remoteJid;
      const cId  = msg.key.id;
      if (cJid && cId) {
        if (!_msgCache.has(cJid)) _msgCache.set(cJid, new Map());
        const cache = _msgCache.get(cJid);
        cache.set(cId, msg);
        if (cache.size > _CACHE_MAX) cache.delete(cache.keys().next().value);
      }

      // ── Anti View-Once: auto-reveal view-once media ──────────
      try {
        const voMsg = msg.message?.viewOnceMessage
                   || msg.message?.viewOnceMessageV2
                   || msg.message?.viewOnceMessageV2Extension;
        if (voMsg) {
          const settings = db.settings.get();
          const chatJid  = msg.key.remoteJid;
          const inGroup  = chatJid?.endsWith('@g.us');
          const grpSet   = inGroup ? db.groups.get(chatJid) : null;
          const avo      = inGroup
            ? (grpSet?.antiviewonce ?? settings.antiViewOnce ?? false)
            : (settings.antiViewOnce ?? false);
          if (avo) {
            const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
            const buf = await downloadMediaMessage(msg, 'buffer', {}).catch(() => null);
            if (buf?.length) {
              const inner = voMsg.message?.imageMessage || voMsg.message?.videoMessage;
              const mime  = inner?.mimetype || 'image/jpeg';
              const isVid = !!voMsg.message?.videoMessage;
              const sender = msg.key.participant || msg.key.remoteJid;
              const num    = sender?.split('@')[0]?.split(':')[0] || '?';
              const cap    = `🔓 *View-Once Revealed*\n👤 From: @${num}`;
              if (isVid) {
                await sock.sendMessage(chatJid, { video: buf, caption: cap, mimetype: mime, mentions: [sender] }).catch(() => {});
              } else {
                await sock.sendMessage(chatJid, { image: buf, caption: cap, mimetype: mime, mentions: [sender] }).catch(() => {});
              }
            }
          }
        }
      } catch {}

      // ── Auto-Status handling (status@broadcast) ──────────────
      if (msg.key.remoteJid === 'status@broadcast') {
        await handleStatusMessage(sock, msg, sessionId).catch(() => {});
        continue;
      }

      if (isJidBroadcast(msg.key.remoteJid)) continue;

      // ── Auto Read: silently mark message as read ──────────────
      try {
        if (db.settings.getValue('autoRead')) {
          await sock.readMessages([msg.key]).catch(() => {});
        }
      } catch {}

      // ── Auto Reply: respond to DMs automatically ──────────────
      try {
        const isDm       = !msg.key.remoteJid?.endsWith('@g.us') && !msg.key.remoteJid?.endsWith('@broadcast');
        const isFromMe   = msg.key.fromMe;
        const autoReplyMsg = db.settings.getValue('autoReply');
        if (isDm && !isFromMe && autoReplyMsg) {
          const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
          const isCmd = text?.startsWith(db.settings.getValue('prefix') || '.');
          if (!isCmd) {
            await sock.sendMessage(msg.key.remoteJid, {
              text: `🤖 *Auto Reply*\n\n${autoReplyMsg}\n\n> Powered by AA MD Bot`,
            }).catch(() => {});
          }
        }
      } catch {}

      if (messageHandler) {
        try { await messageHandler(sock, msg, sessionId); }
        catch (err) { logger.error({ err: err.message }, 'Message handler error'); }
      }
    }
  });

  // ── Presence Update — Online Alert + Ghost Mode ────────────────────────────
  sock.ev.on('presence.update', async ({ id, presences }) => {
    try {
      // Online Alert: notify owner when watched contact comes online
      const { getAlertRegistry } = await import('../plugins/gb/onlinealert.js').catch(() => ({ getAlertRegistry: () => new Map() }));
      const registry = getAlertRegistry();
      const contactNum = id?.split('@')[0]?.split(':')[0];
      if (contactNum && registry.size) {
        for (const [ownerNum, watching] of registry.entries()) {
          if (watching.has(contactNum)) {
            const presence = presences?.[id] || presences?.[Object.keys(presences || {})[0]];
            const isOnline = presence?.lastKnownPresence === 'available';
            if (isOnline) {
              const ownerJid = `${ownerNum}@s.whatsapp.net`;
              const now = new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });
              await sock.sendMessage(ownerJid, {
                text:
                  `🟢 *Online Alert!*\n\n` +
                  `📱 *+${contactNum}* just came *online*\n` +
                  `🕐 *Time:* ${now}\n\n` +
                  `> 👁️ *AA MD Bot Online Tracker*`,
              }).catch(() => {});
            }
          }
        }
      }
    } catch {}
  });

  // ── Anti-Call Handler ──────────────────────────────────────────────────────
  sock.ev.on('call', async (calls) => {
    try {
      const settings = db.settings.get();
      if (!settings.antiCall) return;
      for (const call of calls) {
        if (call.status !== 'offer') continue;
        await sock.rejectCall(call.id, call.from).catch(() => {});
        await sock.sendMessage(call.from, {
          text: `📵 *Auto Reject*\n\nSorry, this bot cannot receive calls.\n\n> 🤖 *AA MD Bot*\n> 👨‍💻 *Ahsan Ali Wadani*`,
        }).catch(() => {});
        logger.info({ from: call.from, sessionId }, '📵 Auto-rejected call');
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'antiCall handler error');
    }
  });

  sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
    const g = db.groups.get(id);
    if (action === 'add' && g.welcome) {
      for (const jid of participants) {
        const msg = (g.welcomeMsg || 'Welcome @user!').replace('@user', `@${jid.split('@')[0]}`);
        await sock.sendMessage(id, { text: msg, mentions: [jid] }).catch(() => {});
      }
    }
  });

  sessions.set(sessionId, sock);
  logger.info({ sessionId }, '🔌 Session initialized');

  // Pairing code mode
  if (usePairingCode && phoneNumber && !state.creds.registered) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(phoneNumber);
        botEvents.emit('pairingCode', { sessionId, code, phoneNumber });
        logger.info({ sessionId, code }, '📲 Pairing code generated');
      } catch (err) {
        botEvents.emit('pairingCodeError', { sessionId, error: err.message });
        logger.error({ err: err.message }, 'Pairing code error');
      }
    }, 3000);
  }

  return sock;
}

export async function deleteSession(sessionId) {
  const sock = sessions.get(sessionId);
  if (sock) { try { await sock.logout(); } catch {} sessions.delete(sessionId); }
  sessionQRs.delete(sessionId);
  sessionStatus.delete(sessionId);
  db.sessions.delete(sessionId);
  await fs.remove(path.join(sessionDir, sessionId)).catch(() => {});
  botEvents.emit('status', { sessionId, status: 'deleted' });
  logger.info({ sessionId }, 'Session deleted');
}

export function getSession(id = 'default') { return sessions.get(id); }

export function isConnectedSessionOwner(jid) {
  const num = jid?.split('@')[0]?.split(':')[0];
  for (const [, sock] of sessions.entries()) {
    const sessNum = sock.user?.id?.split('@')[0]?.split(':')[0];
    if (sessNum && sessNum === num) return true;
  }
  return false;
}

export function getAllSessions() {
  // Merge live sessions + any known sessions currently reconnecting/connecting
  const all = new Map();

  // Start with persisted info for all known sessions (stable baseline)
  for (const [id, info] of sessionInfo.entries()) {
    const status = sessionStatus.get(id) || 'reconnecting';
    const sock = sessions.get(id);
    all.set(id, {
      id,
      jid: sock?.user?.id || info.jid,
      name: sock?.user?.name || info.name || id,
      phone: sock?.user?.id?.split('@')[0]?.split(':')[0] || info.phone,
      connected: sock?.ws?.readyState === 1,
      status,
      hasQR: sessionQRs.has(id),
    });
  }

  // Add any live sessions not yet in sessionInfo
  for (const [id, sock] of sessions.entries()) {
    if (!all.has(id)) {
      all.set(id, {
        id,
        jid: sock.user?.id,
        name: sock.user?.name || id,
        phone: sock.user?.id?.split('@')[0]?.split(':')[0],
        connected: sock.ws?.readyState === 1,
        status: sessionStatus.get(id) || 'unknown',
        hasQR: sessionQRs.has(id),
      });
    }
  }

  return Array.from(all.values());
}

export async function initAllSessions() {
  const dirs = await fs.readdir(sessionDir).catch(() => []);
  const ids = dirs.filter(d => {
    try { return fs.statSync(path.join(sessionDir, d)).isDirectory(); } catch { return false; }
  });

  if (ids.length === 0) {
    logger.info('No sessions — creating default...');
    await createSession('default');
  } else {
    logger.info({ count: ids.length }, 'Loading existing sessions');
    for (const id of ids) {
      await createSession(id);
      await new Promise(r => setTimeout(r, 1500));
    }
  }
}

export default { createSession, deleteSession, getSession, getAllSessions, initAllSessions,
  sessions, botEvents, sessionQRs, sessionStatus, setMessageHandler, setConnectionHandler };
