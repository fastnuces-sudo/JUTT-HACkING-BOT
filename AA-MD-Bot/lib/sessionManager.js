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
import { voCacheSet } from './voCache.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Railway volume: if DATA_DIR=/bot/session is set, sessions go under volume/sessions/
const sessionDir = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'sessions')
  : path.join(__dirname, '../session');
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
    markOnlineOnConnect: false,
    shouldIgnoreJid: jid => isJidBroadcast(jid),
  });

  sock.sessionId = sessionId;
  sessionStatus.set(sessionId, 'connecting');

  // ── Newsletter "View Channel" button — patch sock.sendMessage ─────────────
  // Injects forwardedNewsletterMessageInfo into EVERY outgoing message so
  // the button appears regardless of which plugin/helper sends the message.
  const _origSend = sock.sendMessage.bind(sock);
  sock.sendMessage = async (jid, content, opts) => {
    try {
      const nlJid  = global._AA_NEWSLETTER_JID  || config.newsletterJid;
      const nlName = global._AA_NEWSLETTER_NAME || config.newsletterName || 'AA MD Bot';
      // Skip: no JID set, reactions, read-receipts, status broadcasts, forwards
      const isReact   = !!content?.react;
      const isForward = !!content?.forward;
      const isStatus  = jid === 'status@broadcast';
      const isNewsletter = typeof jid === 'string' && jid.endsWith('@newsletter');
      if (nlJid && !isReact && !isForward && !isStatus && !isNewsletter) {
        const nlCtx = {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: nlJid,
            newsletterName: nlName,
            serverMessageId: Math.floor(Math.random() * 99999) + 1,
          },
        };
        // Merge with any existing contextInfo the plugin already set
        content = {
          ...content,
          contextInfo: content.contextInfo
            ? { ...nlCtx, ...content.contextInfo,
                forwardedNewsletterMessageInfo: nlCtx.forwardedNewsletterMessageInfo }
            : nlCtx,
        };
      }
    } catch (_) {}
    return _origSend(jid, content, opts);
  };

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
      reconnectAttempts.delete(sessionId);
      sessionQRs.delete(sessionId);
      sessionStatus.set(sessionId, 'connected');
      const phone = sock.user?.id?.split('@')[0]?.split(':')[0] || '';
      const ownJid = (sock.user?.id || '').replace(/:.*@/, '@');
      sessionInfo.set(sessionId, { id: sessionId, jid: sock.user?.id, name: sock.user?.name, phone });
      botEvents.emit('status', { sessionId, status: 'connected', user: sock.user });
      logger.info({ sessionId, name: sock.user?.name }, '✅ WhatsApp Connected!');

      // Check if this is a FIRST-EVER connect (not a restart)
      const existingSession = db.sessions.all()[sessionId];
      const isFirstConnect = !existingSession?.firstConnectDone;

      db.sessions.set(sessionId, {
        id: sessionId, jid: sock.user?.id, name: sock.user?.name,
        connected: true, connectedAt: Date.now(),
        firstConnectDone: true,
      });

      // Persist bot's own JID in settings so plugins can reliably read it
      // without depending on sock.user?.id being available at command time
      if (ownJid) db.settings.setValue('botJid', ownJid);

      if (connectionHandler) connectionHandler(sessionId, sock, 'open');

      // Go unavailable immediately so phone still gets push notifications
      sock.sendPresenceUpdate('unavailable').catch(() => {});

      // ── First-connect welcome — ONLY sent once, never on restart ────────────
      if (isFirstConnect && ownJid) {
        const time = new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi', hour12: true });
        setTimeout(async () => {
          try {
            await sock.sendMessage(ownJid, {
              text:
                `🤖 *AA MD Bot Connected!*\n\n` +
                `✅ Bot successfully linked to your WhatsApp\n` +
                `📱 *Number:* +${phone}\n` +
                `🕐 *Time:* ${time}\n` +
                `📋 *Session:* ${sessionId}\n\n` +
                `━━━━━━━━━━━━━━━━\n` +
                `📌 *Quick Start:*\n` +
                `▸ Type *.menu* to see all commands\n` +
                `▸ *.antiviewonce on* — auto-reveal view-once\n` +
                `▸ *.help* — guide & tips\n\n` +
                `> 🤖 *Powered by AA MD Bot | AA Mods*`,
            });
          } catch (_) {}
        }, 3000); // 3s delay so connection fully stabilises first
      }
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
        // Permanently logged out — clean session files + all user data for this session
        reconnectAttempts.delete(sessionId);
        sessionStatus.set(sessionId, 'logged_out');
        botEvents.emit('status', { sessionId, status: 'logged_out' });

        // Remove session record + auth files
        const loggedOutJid = sessions.get(sessionId)?.user?.id || '';
        db.sessions.delete(sessionId);
        await fs.remove(sessionPath).catch(() => {});

        // Clean up user data tied to the bot's own number for this session
        if (loggedOutJid) {
          const ownNum = loggedOutJid.replace(/:.*@/, '@');
          db.users.delete(ownNum);
          logger.info({ sessionId, ownNum }, '🗑️ User data removed on logout');
        }

        // Reset firstConnectDone so next scan triggers welcome again
        // (already deleted from db.sessions above — no extra step needed)

        logger.info({ sessionId }, '🔴 Session logged out & data removed');

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
          // msg.key.remoteJid = the chat where the deletion was received (group or DM)
          const chatJid   = msg.key.remoteJid;
          const deletedId = deletedKey?.id;
          const isGroup   = chatJid?.endsWith('@g.us');
          const settings  = db.settings.get();
          const adEnabled = isGroup
            ? (db.groups.get(chatJid)?.antidelete ?? settings.antidelete ?? false)
            : (settings.antidelete ?? false);

          if (adEnabled) {
            // Locate original message in cache
            let cache    = _msgCache.get(chatJid);
            let original = cache?.get(deletedId);
            if (!original && deletedKey?.remoteJid && deletedKey.remoteJid !== chatJid) {
              cache    = _msgCache.get(deletedKey.remoteJid);
              original = cache?.get(deletedKey.remoteJid === chatJid ? deletedId : deletedId);
            }

            if (original) {
              const now        = new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });
              const deleter    = msg.key.participant || msg.key.remoteJid;
              const deleterNum = deleter?.split('@')[0]?.split(':')[0] || '?';

              if (isGroup) {
                // ── GROUP: resend in the same group chat ──────────────
                await sock.sendMessage(chatJid, {
                  text: `🗑️ *Anti-Delete*\n👤 Deleted by: @${deleterNum}\n🕐 Time: ${now}`,
                  mentions: [deleter],
                }).catch(() => {});
                await sock.sendMessage(chatJid, { forward: original, force: true }).catch(() => {});

              } else {
                // ── DM: send silently to bot's own "You" (self) chat ──
                // Get sender name: saved contact name > WhatsApp push name > number
                const senderJid  = chatJid; // in DM, chatJid IS the sender
                const savedName  = sock.contacts?.[senderJid]?.name
                                || sock.contacts?.[senderJid]?.notify
                                || original.pushName
                                || msg.pushName
                                || '';
                const nameDisplay = savedName ? `*${savedName}*` : '';
                const numDisplay  = `+${deleterNum}`;

                // Bot's own self-chat JID
                const selfNum = sock.user?.id?.split('@')[0]?.split(':')[0];
                const selfJid = selfNum ? `${selfNum}@s.whatsapp.net` : null;
                if (selfJid) {
                  await sock.sendMessage(selfJid, {
                    text:
                      `🗑️ *Deleted Message Recovered*\n\n` +
                      `👤 From: ${nameDisplay ? `${nameDisplay} ` : ''}${numDisplay}\n` +
                      `🕐 Time: ${now}`,
                  }).catch(() => {});
                  await sock.sendMessage(selfJid, { forward: original, force: true }).catch(() => {});
                }
              }
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

      // ── Anti View-Once: cache + auto-reveal view-once media ─────
      try {
        const voMsg = msg.message?.viewOnceMessage
                   || msg.message?.viewOnceMessageV2
                   || msg.message?.viewOnceMessageV2Extension;
        if (voMsg) {
          // ── Always download & cache — needed for .reveal even if auto-reveal is OFF
          const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
          const silentLog = pino({ level: 'silent' });

          // CRITICAL: pass inner message directly, not the viewOnce wrapper
          // downloadMediaMessage needs { imageMessage } or { videoMessage } at top level
          const innerContent = voMsg.message; // { imageMessage:{} } or { videoMessage:{} }
          const fakeMsg = { key: msg.key, message: innerContent };

          const buf = await downloadMediaMessage(
            fakeMsg, 'buffer', {},
            { reuploadRequest: sock.updateMediaMessage, logger: silentLog }
          ).catch(() => null);

          if (buf?.length) {
            const inner  = innerContent?.imageMessage || innerContent?.videoMessage;
            const mime   = inner?.mimetype || 'image/jpeg';
            const isVid  = !!innerContent?.videoMessage;
            const sender = msg.key.participant || msg.key.remoteJid || '';
            const num    = sender.split('@')[0].split(':')[0];
            const chatJid = msg.key.remoteJid;
            const inGroup = chatJid?.endsWith('@g.us');
            const time   = new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi', hour12: true });

            // Cache the buffer so .reveal can serve it by message ID
            voCacheSet(msg.key.id, { buffer: buf, mime, isVid, num, time, inGroup });

            // ── Auto-forward only if antiviewonce is ON ───────────
            const settings = db.settings.get();
            const grpSet   = inGroup ? db.groups.get(chatJid) : null;
            const avo      = inGroup
              ? (grpSet?.antiviewonce ?? settings.antiViewOnce ?? false)
              : (settings.antiViewOnce ?? false);

            if (avo) {
              // Private dest: config.superOwner (hardcoded) → sock.user (live) → db botJid → skip
              const norm = (j) => j ? String(j).replace(/:\d+@/, '@') : null;
              const privateJid =
                (config.superOwner ? `${config.superOwner}@s.whatsapp.net` : null) ||
                norm(sock.user?.id) ||
                norm(db.settings.getValue('botJid'));
              if (!privateJid) return; // no valid private dest — skip silently
              const ownJid = privateJid;

              const privateCap =
                `🔓 *View-Once Revealed*\n\n` +
                `👤 *From:* +${num}\n` +
                `🕐 *Time:* ${time}\n` +
                `📍 *Chat:* ${inGroup ? 'Group' : 'DM'}\n\n` +
                `> 👁️ AA MD Bot`;

              // Group: also reveal inside group (no sender mention)
              if (inGroup) {
                const groupCap = `🔓 *View-Once Revealed*\n\n> 👁️ AA MD Bot`;
                await sock.sendMessage(
                  chatJid,
                  isVid ? { video: buf, caption: groupCap, mimetype: mime }
                        : { image: buf, caption: groupCap, mimetype: mime }
                ).catch(() => {});
              }

              // Always forward to own "You" private chat
              await sock.sendMessage(
                ownJid,
                isVid ? { video: buf, caption: privateCap, mimetype: mime }
                      : { image: buf, caption: privateCap, mimetype: mime }
              ).catch(() => {});
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
        // Stay invisible after processing so phone keeps getting push notifications
        sock.sendPresenceUpdate('unavailable').catch(() => {});
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
        // Use owner-defined custom message if set, else default
        const customMsg = settings.antiCallMsg?.trim();
        const replyText = customMsg
          ? customMsg
          : `📵 *Auto Reject*\n\nSorry, this bot cannot receive calls.\n\n> 🤖 *AA MD Bot*\n> 👨‍💻 *Ahsan Ali Wadani*`;
        await sock.sendMessage(call.from, { text: replyText }).catch(() => {});
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
