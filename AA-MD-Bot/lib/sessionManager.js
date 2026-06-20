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

      // Send connection confirmation to own self-chat (You tab)
      setTimeout(async () => {
        try {
          if (!phone) return;
          // selfJid must be bare number @s.whatsapp.net (no device suffix :0)
          const selfJid = `${phone}@s.whatsapp.net`;
          const now = new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });
          const dashboard = process.env.REPLIT_DEV_DOMAIN
            ? `https://${process.env.REPLIT_DEV_DOMAIN}`
            : 'http://localhost:5000';
          const infoText =
            `╔══════════════════════════════╗\n` +
            `║  ✅ *AA MD Bot Connected!*   ║\n` +
            `╚══════════════════════════════╝\n\n` +
            `📱 *Number:* +${phone}\n` +
            `🆔 *Session:* ${sessionId}\n` +
            `🕐 *Time:* ${now}\n` +
            `🌐 *Dashboard:* ${dashboard}\n\n` +
            `📦 *Commands:* Type *.menu* to see all commands\n` +
            `👑 *Owner Panel:* Type *.smenu* for dev tools\n` +
            `⚙️ *Settings:* Type *.bs* for bot settings\n\n` +
            `🌐 https://aa-mods.vercel.app/\n` +
            `🤖 *Powered by AA MD Bot v3.0*\n` +
            `👨‍💻 *Developed by Ahsan Ali Wadani*`;

          const bannerPaths = [
            path.join(__dirname, '../banner.jpeg'),
            path.join(__dirname, '../banner.jpg'),
          ];
          let bannerBuf = null;
          for (const p of bannerPaths) {
            try { if (fs.existsSync(p)) { bannerBuf = fs.readFileSync(p); break; } } catch {}
          }

          if (bannerBuf) {
            await sock.sendMessage(selfJid, {
              image: bannerBuf,
              caption: infoText,
              mimetype: 'image/jpeg',
            }).catch(() => {});
          } else {
            await sock.sendMessage(selfJid, { text: infoText }).catch(() => {});
          }
        } catch {}
      }, 3500);
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

      // ── Auto-Status handling (status@broadcast) ──────────────
      if (msg.key.remoteJid === 'status@broadcast') {
        await handleStatusMessage(sock, msg, sessionId).catch(() => {});
        continue;
      }

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
