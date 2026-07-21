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

// ── groupMetadata cache (60-second TTL) ──────────────────────────────────────
// Avoids a live WhatsApp network call on every admin-only command.
const _groupMetaCache = new Map();
const _GROUP_META_TTL = 60_000; // 60 seconds
async function getCachedGroupMeta(sock, jid) {
  const cached = _groupMetaCache.get(jid);
  if (cached && Date.now() - cached.ts < _GROUP_META_TTL) return cached.data;
  const meta = await sock.groupMetadata(jid);
  _groupMetaCache.set(jid, { data: meta, ts: Date.now() });
  return meta;
}

const CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb8Yk2LL2AU78HliE617';
const CHANNEL_NAME = 'AA MD Bot';
const WATERMARK = `\n\n> 🤖 *Powered by AA MD Bot*  👨‍💻 *Ahsan Ali Wadani*`;

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

// Build contextInfo — always includes newsletter "View Channel" button.
// Uses global (set at startup / .setnewsletter) with config as hard fallback.
function buildChannelCtx() {
  const newsletterJid  = global._AA_NEWSLETTER_JID  || config.newsletterJid;
  const newsletterName = global._AA_NEWSLETTER_NAME || config.newsletterName || CHANNEL_NAME;
  if (!newsletterJid) return null;
  return {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid,
      newsletterName,
      serverMessageId: Math.floor(Math.random() * 99999) + 1,
    },
  };
}

export function isOwner(jid) {
  const num = jid?.split('@')[0]?.split(':')[0];
  if (num === config.superOwner) return true;
  if (isConnectedSessionOwner(jid)) return true;
  const owners = db.settings.getValue('owners') || config.owners || [];
  return owners.includes(num) || owners.includes(jid);
}

// SuperOwner is stored in Firebase db.settings so it applies across all servers.
// Falls back to config.js if DB not yet set.
function getSuperOwner() {
  return String(db.settings.getValue('superOwner') || config.superOwner || '');
}

export function isSuperOwner(jid) {
  const num = jid?.split('@')[0]?.split(':')[0];
  return num === getSuperOwner();
}

// Banned users stored in db.settings.bannedUsers (Firebase) — persists & syncs across servers
function isBanned(jid) {
  const banned = db.settings.getValue('bannedUsers') || [];
  return banned.includes(jid) || banned.includes(jid.split('@')[0]?.split(':')[0]);
}

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
// Newsletter button always wins — plugin contextInfo preserved alongside it
async function sendMedia(sock, jid, msg, content) {
  const ctx = buildChannelCtx();
  let finalCtx;
  if (ctx && content.contextInfo) {
    // Plugin contextInfo first, then newsletter button overwrites forwardedNewsletterMessageInfo
    finalCtx = {
      ...content.contextInfo,
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: ctx.forwardedNewsletterMessageInfo,
    };
  } else if (ctx) {
    finalCtx = ctx;
  } else {
    finalCtx = content.contextInfo;
  }
  const payload = { ...content };
  if (finalCtx) payload.contextInfo = finalCtx;
  else delete payload.contextInfo;
  return sock.sendMessage(jid, payload, { quoted: msg });
}

export async function handleMessage(sock, msg, sessionId) {
  try {
    const jid = msg.key.remoteJid;
    const senderJid = msg.key.participant || msg.key.remoteJid;
    const fromMe = msg.key.fromMe;
    const isGroupMsg = isGroup(jid);
    const settings = db.settings.get();

    // Per-session settings override global — session-specific features go here
    const sessSets = db.sessionSettings.get(sessionId);
    // Merge: session settings take priority over global for per-number features
    const eff = (key, fallback) => (sessSets[key] !== undefined ? sessSets[key] : (settings[key] !== undefined ? settings[key] : fallback));

    // fromMe = self-chat ("You" tab) — always treated as owner
    const owner = isOwner(senderJid) || fromMe;

    const botMode = eff('botMode', 'public');
    if (botMode === 'private' && !owner && !fromMe) return;

    if (settings.maintenanceMode && !owner) {
      await reply(sock, msg, config.maintenanceMsg).catch(() => {});
      return;
    }

    // NOTE: auto-read is handled in sessionManager before commandHandler is called — no duplicate here.

    // Auto-react to every incoming message (not own messages, not view-once)
    if (eff('autoReact', false) && !fromMe) {
      const msgContent = msg.message || {};
      const innerContent = msgContent?.ephemeralMessage?.message || msgContent;
      const isViewOnce = !!(
        innerContent?.viewOnceMessage ||
        innerContent?.viewOnceMessageV2 ||
        innerContent?.viewOnceMessageV2Extension ||
        innerContent?.imageMessage?.viewOnce ||
        innerContent?.videoMessage?.viewOnce
      );
      if (!isViewOnce) {
        const emoji = eff('autoReactEmoji', config.autoReactEmoji ?? '❤️');
        sock.sendMessage(jid, { react: { text: emoji, key: msg.key } }).catch(() => {});
      }
    }

    const text = await getMessageText(msg);
    if (!text) return;

    const parsed = parseCommand(text);
    if (!parsed) {
      if (!fromMe) {
        // Batch: addXP ensures user exists + updates xp/level in one scheduleSave;
        // then directly mutate the cache entry for the remaining fields so we
        // don't trigger a second debounced save timer.
        db.users.addXP(senderJid, config.xpPerMessage);
        const _u = db.users.get(senderJid);
        _u.lastSeen = Date.now();
        _u.deviceSource = sessionId;
        if (msg.pushName) _u.name = msg.pushName;
      }
      return;
    }

    const { command, args, text: argText, prefix } = parsed;

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
    const isSuperOwnerSelf = fromMe && sessionPhone === getSuperOwner();
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
        const meta = await getCachedGroupMeta(sock, jid);
        const normJid = id => id?.includes(':') ? id.split(':')[0] + '@s.whatsapp.net' : id;
        const admins = meta.participants.filter(p => p.admin).map(p => normJid(p.id));
        if (!admins.includes(normJid(senderJid)) && !owner) {
          await reply(sock, msg, '👮 Group admins only.').catch(() => {});
          return;
        }
      } catch {}
    }

    if (eff('autoTyping', false) && !fromMe) {
      await sock.sendPresenceUpdate('composing', jid).catch(() => {});
    }

    // Build quoted object with message + key so plugins can download media
    const _ctxInfo = msg.message?.extendedTextMessage?.contextInfo
                  || msg.message?.imageMessage?.contextInfo
                  || msg.message?.videoMessage?.contextInfo
                  || msg.message?.audioMessage?.contextInfo;
    const _quotedMsg = _ctxInfo?.quotedMessage;
    const quoted = _quotedMsg
      ? {
          message: _quotedMsg,
          key: {
            id: _ctxInfo?.stanzaId,
            remoteJid: _ctxInfo?.remoteJid || jid,
            participant: _ctxInfo?.participant || undefined,
            fromMe: false,
          },
        }
      : null;

    // Bot's own JID — read from settings (saved at connect time, most reliable)
    // Fallback to sock.user?.id in case settings not yet written
    const ownJid = db.settings.getValue('botJid')
      || (sock.user?.id || '').replace(/:.*@/, '@')
      || null;

    // Per-session settings accessor — bound to this session's sessionId
    // Plugins use sessionSettings.get/set instead of db.settings for per-number features
    const sessionSettings = {
      get: (key) => db.sessionSettings.getValue(sessionId, key),
      set: (key, val) => db.sessionSettings.setValue(sessionId, key, val),
      getAll: () => db.sessionSettings.get(sessionId),
      setAll: (data) => db.sessionSettings.set(sessionId, data),
      // Convenience: reads session first, falls back to global setting
      eff: (key, fallback) => {
        const sv = db.sessionSettings.getValue(sessionId, key);
        if (sv !== undefined) return sv;
        const gv = db.settings.getValue(key);
        if (gv !== undefined) return gv;
        return fallback;
      },
    };

    // Session-scoped db proxy — plugins use db.groups.get(jid) as before,
    // but internally the key is sessionId|groupJid so each bot number has
    // completely independent group settings (antilink, welcome, warn, etc.)
    const scopedDb = {
      ...db,
      groups: {
        get:    (groupId)       => db.groups.get(sessionId, groupId),
        set:    (groupId, data) => db.groups.set(sessionId, groupId, data),
        delete: (groupId)       => db.groups.delete(sessionId, groupId),
        all:    ()              => db.groups.all(sessionId),
      },
    };

    await plugin.execute({
      sock, msg, jid, senderJid, fromMe, isGroupMsg,
      command, args, text: argText, prefix, sessionId,
      isOwner: owner, isSudo: owner,
      reply: (t, opts) => reply(sock, msg, t, opts),
      react: (e) => react(sock, msg, e),
      send: (t, opts) => sendMsg(sock, jid, t, opts),
      sendMedia: (content) => sendMedia(sock, jid, msg, content),
      db: scopedDb, config,
      sessionSettings,
      quoted,
      ownJid,
      getQuoted: () => _quotedMsg || null,
      logger,
    });

    if (!fromMe) {
      // Batch: addXP triggers one debounced scheduleSave; mutate the cache
      // entry directly for the rest so we don't fire a second timer.
      db.users.addXP(senderJid, config.xpPerCommand);
      const _uc = db.users.get(senderJid);
      _uc.commandsUsed = (_uc.commandsUsed || 0) + 1;
      _uc.lastSeen = Date.now();
      if (msg.pushName) _uc.name = msg.pushName;
    }

    if (eff('autoTyping', false)) {
      await sock.sendPresenceUpdate('paused', jid).catch(() => {});
    }
  } catch (err) {
    logger.error({ err: err.message }, 'handleMessage error');
  }
}

export default { handleMessage, isOwner };
