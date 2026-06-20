import { parseCommand, isGroup } from './helper.js';
import { getPlugin } from './pluginLoader.js';
import { db } from './database.js';
import { logger } from './logger.js';
import config from '../config.js';

const cooldowns = new Map();
const spamTracker = new Map();

export function isOwner(jid) {
  const owners = db.settings.getValue('owners') || config.owners || [];
  const num = jid?.split('@')[0];
  return owners.includes(num) || owners.includes(jid);
}

function isBanned(jid) { return db.users.get(jid)?.banned === true; }

function checkSpam(jid) {
  const now = Date.now();
  const win = config.spamInterval * 1000;
  const e = spamTracker.get(jid) || { count: 0, first: now };
  if (now - e.first > win) { spamTracker.set(jid, { count: 1, first: now }); return false; }
  e.count++;
  spamTracker.set(jid, e);
  return e.count > config.spamMax;
}

function checkCooldown(jid, command) {
  const key = `${jid}:${command}`;
  const now = Date.now();
  const last = cooldowns.get(key);
  if (last && now - last < config.cooldown * 1000) return config.cooldown - Math.floor((now - last) / 1000);
  cooldowns.set(key, now);
  return 0;
}

async function getMessageText(msg) {
  const m = msg.message;
  if (!m) return '';
  return m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption ||
    m.videoMessage?.caption || m.documentMessage?.caption || '';
}

async function react(sock, msg, emoji) {
  await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } }).catch(() => {});
}

async function reply(sock, msg, text, options = {}) {
  return sock.sendMessage(msg.key.remoteJid, { text, ...options }, { quoted: msg });
}

async function sendMsg(sock, jid, text, options = {}) {
  return sock.sendMessage(jid, { text, ...options });
}

export async function handleMessage(sock, msg, sessionId) {
  try {
    const jid = msg.key.remoteJid;
    const senderJid = msg.key.participant || msg.key.remoteJid;
    const fromMe = msg.key.fromMe;
    const isGroupMsg = isGroup(jid);
    const settings = db.settings.get();
    const owner = isOwner(senderJid);

    if (settings.maintenanceMode && !owner && !fromMe) {
      await reply(sock, msg, config.maintenanceMsg).catch(() => {});
      return;
    }

    if (settings.autoRead && !fromMe) {
      await sock.readMessages([msg.key]).catch(() => {});
    }

    const text = await getMessageText(msg);
    if (!text) return;

    const parsed = parseCommand(text);
    if (!parsed) {
      if (!fromMe) {
        db.users.addXP(senderJid, config.xpPerMessage);
        db.users.set(senderJid, { lastSeen: Date.now(), deviceSource: sessionId, name: msg.pushName || '' });
      }
      return;
    }

    const { command, args, text: argText } = parsed;

    if (isBanned(senderJid) && !owner) {
      await reply(sock, msg, '❌ You are banned from using this bot.').catch(() => {});
      return;
    }

    if (!owner && settings.antiSpam && checkSpam(senderJid)) {
      await reply(sock, msg, '⚠️ Too fast! Wait a moment.').catch(() => {});
      return;
    }

    const plugin = getPlugin(command);
    if (!plugin) return;

    const cooldownLeft = checkCooldown(senderJid, command);
    if (cooldownLeft > 0 && !owner) {
      await reply(sock, msg, `⏳ Wait *${cooldownLeft}s* before using this again.`).catch(() => {});
      return;
    }

    if (plugin.ownerOnly && !owner) {
      await reply(sock, msg, '🔒 This command is for bot owners only.').catch(() => {});
      return;
    }

    if (plugin.groupOnly && !isGroupMsg) {
      await reply(sock, msg, '👥 Groups only.').catch(() => {});
      return;
    }

    if (plugin.privateOnly && isGroupMsg) {
      await reply(sock, msg, '💬 Private chat only.').catch(() => {});
      return;
    }

    if (plugin.adminOnly && isGroupMsg) {
      try {
        const meta = await sock.groupMetadata(jid);
        const admins = meta.participants.filter(p => p.admin).map(p => p.id);
        if (!admins.includes(senderJid) && !owner) {
          await reply(sock, msg, '👮 Group admins only.').catch(() => {});
          return;
        }
      } catch {}
    }

    if (settings.autoTyping && !fromMe) {
      await sock.sendPresenceUpdate('composing', jid).catch(() => {});
    }

    await plugin.execute({
      sock, msg, jid, senderJid, fromMe, isGroupMsg,
      command, args, text: argText, sessionId,
      isOwner: owner, isSudo: owner,
      reply: (t, opts) => reply(sock, msg, t, opts),
      react: (e) => react(sock, msg, e),
      send: (t, opts) => sendMsg(sock, jid, t, opts),
      db, config,
      getQuoted: () => msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || null,
      logger,
    });

    db.users.addXP(senderJid, config.xpPerCommand);
    db.users.set(senderJid, {
      commandsUsed: (db.users.get(senderJid).commandsUsed || 0) + 1,
      lastSeen: Date.now(), name: msg.pushName || '',
    });

    if (settings.autoTyping) {
      await sock.sendPresenceUpdate('paused', jid).catch(() => {});
    }
  } catch (err) {
    logger.error({ err: err.message }, 'handleMessage error');
  }
}

export default { handleMessage, isOwner };
