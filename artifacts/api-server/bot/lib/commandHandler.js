import { parseCommand, isGroup } from './helper.js';
import { getPlugin } from './pluginLoader.js';
import { db } from './database.js';
import { logger } from './logger.js';
import config from '../config.js';

const cooldowns = new Map();
const spamTracker = new Map();

export function isOwner(jid) {
  const settings = db.settings.get();
  const owners = settings.owners || config.owners || [];
  const num = jid.split('@')[0];
  return owners.includes(num) || owners.includes(jid);
}

function isBanned(jid) {
  const user = db.users.get(jid);
  return user.banned === true;
}

function checkSpam(jid) {
  const now = Date.now();
  const window = config.spamInterval * 1000;
  const entry = spamTracker.get(jid) || { count: 0, first: now };
  if (now - entry.first > window) {
    spamTracker.set(jid, { count: 1, first: now });
    return false;
  }
  entry.count++;
  spamTracker.set(jid, entry);
  return entry.count > config.spamMax;
}

function checkCooldown(jid, command) {
  const key = `${jid}:${command}`;
  const now = Date.now();
  const lastUsed = cooldowns.get(key);
  if (lastUsed && now - lastUsed < config.cooldown * 1000) {
    return config.cooldown - Math.floor((now - lastUsed) / 1000);
  }
  cooldowns.set(key, now);
  return 0;
}

export async function getMessageText(msg) {
  const m = msg.message;
  if (!m) return '';
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    m.buttonsResponseMessage?.selectedButtonId ||
    m.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.templateButtonReplyMessage?.selectedId ||
    ''
  );
}

export async function getQuotedMessage(msg) {
  const m = msg.message?.extendedTextMessage?.contextInfo;
  return m?.quotedMessage || null;
}

export async function react(sock, msg, emoji) {
  await sock.sendMessage(msg.key.remoteJid, {
    react: { text: emoji, key: msg.key },
  }).catch(() => {});
}

export async function reply(sock, msg, text, options = {}) {
  return sock.sendMessage(
    msg.key.remoteJid,
    { text, ...options },
    { quoted: msg }
  );
}

export async function sendMsg(sock, jid, text, options = {}) {
  return sock.sendMessage(jid, { text, ...options });
}

export async function handleMessage(sock, msg, sessionId) {
  const jid = msg.key.remoteJid;
  const senderJid = msg.key.participant || msg.key.remoteJid;
  const fromMe = msg.key.fromMe;
  const isGroupMsg = isGroup(jid);
  const settings = db.settings.get();
  const owner = isOwner(senderJid);

  if (settings.maintenanceMode && !owner) {
    if (fromMe) return;
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
      db.users.set(senderJid, { lastSeen: Date.now(), deviceSource: sessionId });
    }
    return;
  }

  const { command, args, text: argText } = parsed;

  if (isBanned(senderJid) && !owner) {
    await reply(sock, msg, '❌ You are banned from using this bot.').catch(() => {});
    return;
  }

  if (!owner && settings.antiSpam) {
    if (checkSpam(senderJid)) {
      await reply(sock, msg, '⚠️ Slow down! Too many commands at once.').catch(() => {});
      return;
    }
  }

  const plugin = getPlugin(command);
  if (!plugin) return;

  const cooldownLeft = checkCooldown(senderJid, command);
  if (cooldownLeft > 0 && !owner) {
    await reply(sock, msg, `⏳ Wait *${cooldownLeft}s* before using this command again.`).catch(() => {});
    return;
  }

  if (plugin.ownerOnly && !owner) {
    await reply(sock, msg, '🔒 This command is for bot owners only.').catch(() => {});
    return;
  }

  if (plugin.groupOnly && !isGroupMsg) {
    await reply(sock, msg, '👥 This command can only be used in groups.').catch(() => {});
    return;
  }

  if (plugin.privateOnly && isGroupMsg) {
    await reply(sock, msg, '💬 This command can only be used in private chat.').catch(() => {});
    return;
  }

  if (plugin.adminOnly && isGroupMsg) {
    try {
      const groupMeta = await sock.groupMetadata(jid);
      const admins = groupMeta.participants
        .filter(p => p.admin)
        .map(p => p.id);
      if (!admins.includes(senderJid) && !owner) {
        await reply(sock, msg, '👮 This command is for group admins only.').catch(() => {});
        return;
      }
    } catch {}
  }

  if (settings.autoTyping && !fromMe) {
    await sock.sendPresenceUpdate('composing', jid).catch(() => {});
  }

  const ctx = {
    sock,
    msg,
    jid,
    senderJid,
    fromMe,
    isGroupMsg,
    command,
    args,
    text: argText,
    sessionId,
    isOwner: owner,
    isSudo: owner,
    reply: (text, opts) => reply(sock, msg, text, opts),
    react: (emoji) => react(sock, msg, emoji),
    send: (text, opts) => sendMsg(sock, jid, text, opts),
    db,
    config,
    getQuoted: () => getQuotedMessage(msg),
    logger,
  };

  try {
    logger.info({ command, sessionId, sender: senderJid.split('@')[0] }, 'Command executed');
    await plugin.execute(ctx);
    db.users.addXP(senderJid, config.xpPerCommand);
    db.users.set(senderJid, {
      commandsUsed: (db.users.get(senderJid).commandsUsed || 0) + 1,
      lastSeen: Date.now(),
      deviceSource: sessionId,
      name: msg.pushName || '',
    });
  } catch (err) {
    logger.error({ err, command, sessionId }, 'Plugin execution error');
    await reply(sock, msg, `❌ Error: ${err.message}`).catch(() => {});
  } finally {
    if (settings.autoTyping) {
      await sock.sendPresenceUpdate('paused', jid).catch(() => {});
    }
  }
}

export default { handleMessage, reply, sendMsg, react, getMessageText, isOwner };
