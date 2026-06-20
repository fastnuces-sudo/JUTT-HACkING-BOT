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
botEvents.setMaxListeners(50);

// Store latest QR per session for dashboard
export const sessionQRs = new Map();
export const sessionStatus = new Map();

let messageHandler = null;
let connectionHandler = null;

export function setMessageHandler(fn) { messageHandler = fn; }
export function setConnectionHandler(fn) { connectionHandler = fn; }

export async function createSession(sessionId = 'default', usePairingCode = false, phoneNumber = null) {
  if (sessions.has(sessionId)) {
    logger.warn({ sessionId }, 'Session already exists');
    return sessions.get(sessionId);
  }

  const sessionPath = path.join(sessionDir, sessionId);
  fs.ensureDirSync(sessionPath);

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();
  const silentLogger = pino({ level: 'silent' });

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

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      sessionQRs.set(sessionId, qr);
      sessionStatus.set(sessionId, 'qr');
      botEvents.emit('qr', { sessionId, qr });
      logger.info({ sessionId }, '📱 QR Code generated');
    }

    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = reason !== DisconnectReason.loggedOut;
      sessionQRs.delete(sessionId);
      sessionStatus.set(sessionId, 'disconnected');
      botEvents.emit('status', { sessionId, status: 'disconnected', reason });
      logger.warn({ sessionId, reason }, 'Connection closed');

      if (shouldReconnect) {
        sessions.delete(sessionId);
        sessionStatus.set(sessionId, 'reconnecting');
        botEvents.emit('status', { sessionId, status: 'reconnecting' });
        setTimeout(() => createSession(sessionId), 5000);
      } else {
        logger.error({ sessionId }, 'Logged out');
        sessions.delete(sessionId);
        db.sessions.delete(sessionId);
        await fs.remove(sessionPath).catch(() => {});
        botEvents.emit('status', { sessionId, status: 'logged_out' });
      }
    }

    if (connection === 'open') {
      sessionQRs.delete(sessionId);
      sessionStatus.set(sessionId, 'connected');
      botEvents.emit('status', { sessionId, status: 'connected', user: sock.user });
      logger.info({ sessionId, jid: sock.user?.id }, '✅ Connected');
      db.sessions.set(sessionId, {
        id: sessionId,
        jid: sock.user?.id,
        name: sock.user?.name,
        connected: true,
        connectedAt: Date.now(),
      });
      if (connectionHandler) connectionHandler(sessionId, sock, 'open');
    }

    if (connection === 'connecting') {
      sessionStatus.set(sessionId, 'connecting');
      botEvents.emit('status', { sessionId, status: 'connecting' });
    }
  });

  sock.ev.on('messages.upsert', async (upsert) => {
    if (upsert.type !== 'notify') return;
    for (const msg of upsert.messages) {
      if (!msg.message) continue;
      if (isJidBroadcast(msg.key.remoteJid)) continue;
      if (messageHandler) {
        try { await messageHandler(sock, msg, sessionId); }
        catch (err) { logger.error({ err, sessionId }, 'Message handler error'); }
      }
    }
  });

  sock.ev.on('group-participants.update', async (update) => {
    const { id, participants, action } = update;
    const groupData = db.groups.get(id);
    if (action === 'add' && groupData.welcome) {
      for (const jid of participants) {
        const welcomeMsg = (groupData.welcomeMsg || 'Welcome @user!').replace('@user', `@${jid.split('@')[0]}`);
        await sock.sendMessage(id, { text: welcomeMsg, mentions: [jid] }).catch(() => {});
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
        logger.error({ err }, 'Failed to get pairing code');
        botEvents.emit('pairingCodeError', { sessionId, error: err.message });
      }
    }, 3000);
  }

  return sock;
}

export async function deleteSession(sessionId) {
  const sock = sessions.get(sessionId);
  if (sock) {
    try { await sock.logout(); } catch {}
    sessions.delete(sessionId);
  }
  sessionQRs.delete(sessionId);
  sessionStatus.delete(sessionId);
  db.sessions.delete(sessionId);
  const sessionPath = path.join(sessionDir, sessionId);
  await fs.remove(sessionPath).catch(() => {});
  botEvents.emit('status', { sessionId, status: 'deleted' });
  logger.info({ sessionId }, 'Session deleted');
}

export function getSession(sessionId = 'default') {
  return sessions.get(sessionId);
}

export function getAllSessions() {
  return Array.from(sessions.entries()).map(([id, sock]) => ({
    id,
    jid: sock.user?.id,
    name: sock.user?.name,
    phone: sock.user?.id?.split('@')[0]?.split(':')[0],
    connected: sock.ws?.readyState === 1,
    status: sessionStatus.get(id) || 'unknown',
    hasQR: sessionQRs.has(id),
  }));
}

export async function initAllSessions() {
  const dirs = await fs.readdir(sessionDir).catch(() => []);
  const sessionIds = dirs.filter(d => {
    const fullPath = path.join(sessionDir, d);
    try { return fs.statSync(fullPath).isDirectory(); } catch { return false; }
  });

  if (sessionIds.length === 0) {
    logger.info('No sessions found — creating default session');
    await createSession('default');
  } else {
    logger.info({ count: sessionIds.length }, 'Loading existing sessions');
    for (const id of sessionIds) {
      await createSession(id);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

export default {
  createSession, deleteSession, getSession, getAllSessions,
  initAllSessions, sessions, botEvents, sessionQRs, sessionStatus,
  setMessageHandler, setConnectionHandler,
};
