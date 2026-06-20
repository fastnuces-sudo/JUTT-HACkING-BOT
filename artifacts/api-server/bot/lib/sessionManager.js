import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  proto,
  generateWAMessageFromContent,
  prepareWAMessageMedia,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import pino from 'pino';
import { logger } from './logger.js';
import { db } from './database.js';
import config from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sessionDir = path.join(__dirname, '../session');
fs.ensureDirSync(sessionDir);

export const sessions = new Map();
export const sessionEvents = new Map();

let messageHandler = null;
let connectionHandler = null;

export function setMessageHandler(fn) { messageHandler = fn; }
export function setConnectionHandler(fn) { connectionHandler = fn; }

export async function createSession(sessionId = 'default') {
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
    printQRInTerminal: true,
    logger: silentLogger,
    generateHighQualityLinkPreview: true,
    getMessage: async (key) => {
      return { conversation: '' };
    },
    syncFullHistory: false,
    markOnlineOnConnect: true,
  });

  sock.sessionId = sessionId;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info({ sessionId }, '📱 QR Code generated — scan with WhatsApp');
    }

    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const shouldReconnect = reason !== DisconnectReason.loggedOut;

      logger.warn({ sessionId, reason }, `Connection closed`);

      if (shouldReconnect) {
        logger.info({ sessionId }, 'Reconnecting in 5s...');
        sessions.delete(sessionId);
        setTimeout(() => createSession(sessionId), 5000);
      } else {
        logger.error({ sessionId }, 'Logged out — deleting session');
        sessions.delete(sessionId);
        db.sessions.delete(sessionId);
        await fs.remove(sessionPath).catch(() => {});
      }
    }

    if (connection === 'open') {
      logger.info({ sessionId, jid: sock.user?.id }, '✅ Connected to WhatsApp');
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
      logger.info({ sessionId }, '🔄 Connecting...');
    }
  });

  sock.ev.on('messages.upsert', async (upsert) => {
    if (upsert.type !== 'notify') return;
    for (const msg of upsert.messages) {
      if (!msg.message) continue;
      if (isJidBroadcast(msg.key.remoteJid)) continue;
      if (messageHandler) {
        try {
          await messageHandler(sock, msg, sessionId);
        } catch (err) {
          logger.error({ err, sessionId }, 'Error in message handler');
        }
      }
    }
  });

  sock.ev.on('group-participants.update', async (update) => {
    const { id, participants, action } = update;
    const groupData = db.groups.get(id);

    if (action === 'add' && groupData.welcome) {
      for (const jid of participants) {
        const welcomeMsg = groupData.welcomeMsg
          .replace('@user', `@${jid.split('@')[0]}`)
          .replace('@group', '');
        await sock.sendMessage(id, {
          text: welcomeMsg,
          mentions: [jid],
        }).catch(() => {});
      }
    }

    if (action === 'remove' && groupData.goodbye) {
      for (const jid of participants) {
        const goodbyeMsg = groupData.goodbyeMsg
          .replace('@user', `@${jid.split('@')[0]}`)
          .replace('@group', '');
        await sock.sendMessage(id, {
          text: goodbyeMsg,
          mentions: [jid],
        }).catch(() => {});
      }
    }
  });

  sock.ev.on('groups.update', async (updates) => {
    for (const update of updates) {
      if (update.id) {
        const groupData = db.groups.get(update.id);
        if (update.subject) db.groups.set(update.id, { name: update.subject });
      }
    }
  });

  sessions.set(sessionId, sock);
  logger.info({ sessionId }, '🔌 Session initialized');
  return sock;
}

export async function deleteSession(sessionId) {
  const sock = sessions.get(sessionId);
  if (sock) {
    try { await sock.logout(); } catch {}
    sessions.delete(sessionId);
  }
  db.sessions.delete(sessionId);
  const sessionPath = path.join(sessionDir, sessionId);
  await fs.remove(sessionPath).catch(() => {});
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
    connected: sock.ws?.readyState === 1,
  }));
}

export async function broadcastToAll(message, excludeSessions = []) {
  const results = [];
  for (const [id, sock] of sessions) {
    if (excludeSessions.includes(id)) continue;
    try {
      results.push({ sessionId: id, status: 'sent' });
    } catch (err) {
      results.push({ sessionId: id, status: 'failed', error: err.message });
    }
  }
  return results;
}

export async function initAllSessions() {
  const dirs = await fs.readdir(sessionDir).catch(() => []);
  const sessionIds = dirs.filter(d => {
    const fullPath = path.join(sessionDir, d);
    return fs.statSync(fullPath).isDirectory();
  });

  if (sessionIds.length === 0) {
    logger.info('No existing sessions — creating default session');
    await createSession('default');
  } else {
    logger.info({ count: sessionIds.length }, 'Loading existing sessions');
    for (const id of sessionIds) {
      await createSession(id);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

export async function getPairingCode(sessionId, phoneNumber) {
  const sock = sessions.get(sessionId) || await createSession(sessionId);
  const code = await sock.requestPairingCode(phoneNumber);
  return code;
}

export default {
  createSession, deleteSession, getSession, getAllSessions,
  broadcastToAll, initAllSessions, getPairingCode,
  sessions, setMessageHandler, setConnectionHandler,
};
