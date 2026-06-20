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

let messageHandler = null;
let connectionHandler = null;

export function setMessageHandler(fn) { messageHandler = fn; }
export function setConnectionHandler(fn) { connectionHandler = fn; }

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
      sessionQRs.delete(sessionId);
      sessionStatus.set(sessionId, 'connected');
      botEvents.emit('status', { sessionId, status: 'connected', user: sock.user });
      logger.info({ sessionId, name: sock.user?.name }, '✅ WhatsApp Connected!');
      db.sessions.set(sessionId, {
        id: sessionId, jid: sock.user?.id, name: sock.user?.name,
        connected: true, connectedAt: Date.now(),
      });
      if (connectionHandler) connectionHandler(sessionId, sock, 'open');
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
        sessionStatus.set(sessionId, 'logged_out');
        botEvents.emit('status', { sessionId, status: 'logged_out' });
        db.sessions.delete(sessionId);
        await fs.remove(sessionPath).catch(() => {});
        logger.info({ sessionId }, '🔴 Session logged out & removed');

      } else if (wasRegistered) {
        // Was connected before — reconnect automatically
        sessionStatus.set(sessionId, 'reconnecting');
        botEvents.emit('status', { sessionId, status: 'reconnecting' });
        logger.info({ sessionId }, '🔄 Reconnecting in 5s...');
        setTimeout(() => createSession(sessionId, false, null), 5000);

      } else {
        // Never connected (waiting for QR) — don't spam reconnect
        sessionStatus.set(sessionId, 'disconnected');
        botEvents.emit('status', { sessionId, status: 'disconnected' });
        logger.info({ sessionId }, '⚪ Session closed (never connected)');
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message) continue;
      if (isJidBroadcast(msg.key.remoteJid)) continue;
      if (messageHandler) {
        try { await messageHandler(sock, msg, sessionId); }
        catch (err) { logger.error({ err: err.message }, 'Message handler error'); }
      }
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

export function getAllSessions() {
  return Array.from(sessions.entries()).map(([id, sock]) => ({
    id,
    jid: sock.user?.id,
    name: sock.user?.name || id,
    phone: sock.user?.id?.split('@')[0]?.split(':')[0],
    connected: sock.ws?.readyState === 1,
    status: sessionStatus.get(id) || 'unknown',
    hasQR: sessionQRs.has(id),
  }));
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
