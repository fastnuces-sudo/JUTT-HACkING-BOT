import { parseCommand, isGroup } from './helper.js';
import { getPlugin } from './pluginLoader.js';
import { db } from './database.js';
import { logger } from './logger.js';
import config from '../config.js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { isConnectedSessionOwner } from './sessionManager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const cooldowns = new Map();
const spamTracker = new Map();

const CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb8Yk2LL2AU78HliE617';
const CHANNEL_NAME = 'AA MD Bot';
const WATERMARK = `\n\n🌐 https://aa-mods.vercel.app/\n🤖 *Powered by AA MD Bot*\n👨‍💻 *Developed by Ahsan Ali Wadani*`;

// Load banner thumbnail once for channel button
let _bannerThumb = null;
function getBannerThumb() {
  if (_bannerThumb) return _bannerThumb;
  const paths = [
    join(__dirname, '../banner.jpeg'),
    join(__dirname, '../banner.jpg'),
    join(__dirname, '../assets/banner.jpg'),
    join(__dirname, '../../artifacts/aa-md-bot/public/banner.jpeg'),
  ];
  for (const p of paths) {
    try {
      if (existsSync(p)) { _bannerThumb = readFileSync(p); break; }
    } catch (_) {}
  }
  return _bannerThumb;
}

// Build contextInfo — only when a newsletter JID is set via .setnewsletter.
// No fallback external ad reply so messages don't show a channel follow button.
function buildChannelCtx() {
  const newsletterJid = global._AA_NEWSLETTER_JID;
  if (newsletterJid) {
    return {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid,
        newsletterName: global._AA_NEWSLETTER_NAME || CHANNEL_NAME,
        serverMessageId: Math.floor(Math.random() * 99999) + 1,
      },
    };
  }
  return null;
}

export function isOwner(jid) {
  const num = jid?.split('@')[0]?.split(':')[0];
  if (num === config.superOwner) return true;
  if (isConnectedSessionOwner(jid)) return true;
  const owners = db.settings.getValue('owners') || config.owners || [];
  return owners.includes(num) || owners.includes(jid);
}

export function isSuperOwner(jid) {
  const num = jid?.split('@')[0]?.split(':')[0];
  return num === config.superOwner;
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

// All text replies automatically get the watermark. Newsletter "lid" button only
// appears when owner has run .setnewsletter — no fallback channel ad.
async function reply(sock, msg, text, options = {}) {
  const fullText = typeof text === 'string' ? text + WATERMARK : text;
  const ctx = buildChannelCtx();
  const payload = ctx ? { text: fullText, contextInfo: ctx, ...options } : { text: fullText, ...options };
  return sock.sendMessage(msg.key.remoteJid, payload, { quoted: msg });
}

async function sendMsg(sock, jid, content, options = {}) {
  const ctx = buildChannelCtx();
  if (typeof content === 'string') {
    const fullText = content + WATERMARK;
    const payload = ctx ? { text: fullText, contextInfo: ctx, ...options } : { text: fullText, ...options };
    return sock.sendMessage(jid, payload);
  }
  // Non-text messages (image/audio/video/sticker): append watermark to caption if present
  if (content.caption && !content.caption.includes('AA MD Bot')) content.caption += WATERMARK;
  const payload = ctx ? { contextInfo: ctx, ...content, ...options } : { ...content, ...options };
  return sock.sendMessage(jid, payload);
}

// sendMedia — for plugins that send audio/image/video directly
async function sendMedia(sock, jid, content) {
  const ctx = buildChannelCtx();
  const payload = ctx ? { contextInfo: ctx, ...content } : { ...content };
  return sock.sendMessage(jid, payload);
}

export async function handleMessage(sock, msg, sessionId) {
  try {
    const jid = msg.key.remoteJid;
    const senderJid = msg.key.participant || msg.key.remoteJid;
    const fromMe = msg.key.fromMe;
    const isGroupMsg = isGroup(jid);
    const settings = db.settings.get();

    // fromMe = self-chat ("You" tab) — always treated as owner
    const owner = isOwner(senderJid) || fromMe;

    const botMode = settings.botMode || 'public';
    if (botMode === 'private' && !owner && !fromMe) return;

    if (settings.maintenanceMode && !owner) {
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

    // superOwnerOnly: allow if senderJid matches superOwner OR if fromMe on superOwner's own session
    const sessionPhone = sock.user?.id?.split('@')[0]?.split(':')[0];
    const isSuperOwnerSelf = fromMe && sessionPhone === config.superOwner;
    if (plugin.superOwnerOnly && !isSuperOwner(senderJid) && !isSuperOwnerSelf) {
      await reply(sock, msg, '👑 This command is reserved for the main developer only.').catch(() => {});
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
      sendMedia: (content) => sendMedia(sock, jid, content),
      db, config,
      getQuoted: () => msg.message?.extendedTextMessage?.contextInfo?.quotedMessage || null,
      logger,
    });

    if (!fromMe) {
      db.users.addXP(senderJid, config.xpPerCommand);
      db.users.set(senderJid, {
        commandsUsed: (db.users.get(senderJid).commandsUsed || 0) + 1,
        lastSeen: Date.now(), name: msg.pushName || '',
      });
    }

    if (settings.autoTyping) {
      await sock.sendPresenceUpdate('paused', jid).catch(() => {});
    }
  } catch (err) {
    logger.error({ err: err.message }, 'handleMessage error');
  }
}

export default { handleMessage, isOwner };
