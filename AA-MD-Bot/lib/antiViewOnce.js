// ============================================
// AA MD Bot - Anti View Once
// Developer: Ahsan Ali | AA Mods
// Captures view-once media, stores for manual reveal
// via !reveal <msgId>, and auto-reveals to owner's
// private "You" chat when antiviewonce is ON or the
// view-once caption contains the configured keyword.
// ============================================

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import moment from 'moment-timezone';
import { logger } from './logger.js';
import { db } from './database.js';
import config from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Storage ───────────────────────────────────────────────────────────────────
// Map keyed by message ID — stores buffer + metadata for manual !reveal
export const viewOnceStore = new Map();
const _MAX_STORE = 200;

// Dedup guard — WhatsApp often delivers view-once twice
// (empty placeholder via messages.upsert, real content via messages.update)
const _processed = new Set();
const _PROCESSED_MAX = 200;

// Media directory for saved files
const MEDIA_DIR = path.join(__dirname, '../media/viewonce');
fs.ensureDirSync(MEDIA_DIR);

// ── Periodic cleanup (5-minute TTL) ──────────────────────────────────────────
export function cleanViewOnceStore() {
  const now = Date.now();
  const TTL = 5 * 60 * 1000;
  for (const [key, val] of viewOnceStore.entries()) {
    if (now - val.timestamp > TTL) viewOnceStore.delete(key);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getPhoneNum(jid) {
  if (!jid) return null;
  return jid.split('@')[0].split(':')[0];
}

function formatPhone(num) {
  if (!num) return 'Unknown';
  return num.startsWith('+') ? num : `+${num}`;
}

function normalizeMsg(message) {
  let m = message;
  for (let i = 0; i < 5; i++) {
    if (m?.ephemeralMessage)             { m = m.ephemeralMessage.message;             continue; }
    if (m?.documentWithCaptionMessage)   { m = m.documentWithCaptionMessage.message;   continue; }
    break;
  }
  return m;
}

function extractViewOnceMedia(normalized) {
  const voMsg = normalized?.viewOnceMessage
             || normalized?.viewOnceMessageV2
             || normalized?.viewOnceMessageV2Extension;

  if (voMsg?.message?.imageMessage) return { mediaMsg: voMsg.message.imageMessage, isVid: false };
  if (voMsg?.message?.videoMessage) return { mediaMsg: voMsg.message.videoMessage, isVid: true  };
  if (normalized?.imageMessage?.viewOnce) return { mediaMsg: normalized.imageMessage, isVid: false };
  if (normalized?.videoMessage?.viewOnce) return { mediaMsg: normalized.videoMessage, isVid: true  };
  return null;
}

async function downloadBuffer(mediaMsg, isVid) {
  const { downloadContentFromMessage } = await import('@whiskeysockets/baileys');
  const stream = await downloadContentFromMessage(mediaMsg, isVid ? 'video' : 'image');
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// ── Main handler ──────────────────────────────────────────────────────────────
// Call this from both messages.upsert and messages.update in sessionManager.
export async function handleViewOnceMessage(msg, sock, sessionId) {
  if (!msg?.message || !msg?.key?.id) return;

  try {
    const msgId = msg.key.id;

    // Dedup: skip if already successfully downloaded
    // NOTE: we do NOT mark _processed here yet — we only mark it after the
    // buffer download succeeds, so that a messages.update retry (which fires
    // when WhatsApp delivers the real content after an empty placeholder) can
    // still succeed if the first messages.upsert attempt had no media yet.
    if (_processed.has(msgId)) return;

    const normalized = normalizeMsg(msg.message);
    const extracted  = extractViewOnceMedia(normalized);
    if (!extracted) return;

    const { mediaMsg, isVid } = extracted;
    const mime     = mediaMsg.mimetype || (isVid ? 'video/mp4' : 'image/jpeg');
    const caption  = mediaMsg.caption || '';
    const chatJid  = msg.key.remoteJid;
    const inGroup  = chatJid?.endsWith('@g.us');
    const senderJid = msg.key.participant || chatJid || '';
    const num      = getPhoneNum(senderJid);
    const tz       = config.timezone || 'Asia/Karachi';
    const time     = new Date().toLocaleString('en-PK', { timeZone: tz, hour12: true });

    logger.info({ sessionId, msgId, chat: chatJid, isVid }, '👁️ ViewOnce detected — downloading');

    // Download
    let buf = null;
    try {
      buf = await downloadBuffer(mediaMsg, isVid);
    } catch (e) {
      logger.warn({ err: e.message }, 'ViewOnce download failed');
    }
    if (!buf?.length) return; // leave _processed clear so messages.update can retry

    // Mark as successfully handled — prevents double-processing on retry events
    _processed.add(msgId);
    if (_processed.size > _PROCESSED_MAX) _processed.delete(_processed.values().next().value);

    // Save to disk
    const ext      = isVid ? 'mp4' : 'jpg';
    const fileName = `viewonce_${isVid ? 'video' : 'image'}_${Date.now()}.${ext}`;
    const savedPath = path.join(MEDIA_DIR, fileName);
    try { fs.writeFileSync(savedPath, buf); } catch {}

    // Store for !reveal <msgId>
    const entry = {
      buf, mime, isVid, num, time, inGroup,
      caption, chatJid, senderJid,
      senderName: sock.contacts?.[senderJid]?.name
               || sock.contacts?.[senderJid]?.notify
               || formatPhone(num),
      savedPath,
      timestamp: Date.now(),
    };
    viewOnceStore.set(msgId, entry);
    if (viewOnceStore.size > _MAX_STORE) viewOnceStore.delete(viewOnceStore.keys().next().value);

    logger.info({ sessionId, msgId, savedPath, bytes: buf.length }, '✅ ViewOnce cached');

    // ── Auto-reply to sender ──────────────────────────────────────────────────
    const autoReply = db.settings.getValue('voAutoReply');
    if (autoReply && !msg.key.fromMe) {
      await sock.sendMessage(chatJid, { text: autoReply }).catch(() => {});
    }

    // ── Check if caption contains the trigger keyword ─────────────────────────
    const voKeyword = db.settings.getValue('voKeyword');
    const hasKeyword = voKeyword && caption &&
                       caption.toLowerCase().includes(voKeyword.toLowerCase());

    // ── Decide whether to auto-forward to "You" chat ─────────────────────────
    const settings = db.settings.get();
    const grpSet   = inGroup ? db.groups.get(chatJid) : null;
    const avo      = inGroup
      ? (grpSet?.antiviewonce ?? settings.antiViewOnce ?? false)
      : (settings.antiViewOnce ?? false);

    if (!avo && !hasKeyword) return; // nothing more to do

    const selfNum = sock.user?.id?.split('@')[0]?.split(':')[0];
    const selfJid = selfNum ? `${selfNum}@s.whatsapp.net` : null;
    if (!selfJid) return;

    const date    = moment().tz(tz).format('DD/MM/YYYY');
    const timeStr = moment().tz(tz).format('HH:mm:ss');

    // If keyword triggered, send info header first
    if (hasKeyword) {
      const infoText =
        `*📸 VIEW-ONCE REVEALED*\n\n` +
        `*👤 Sender:* ${formatPhone(num)}\n` +
        `*📅 Date:* ${date}\n` +
        `*⏰ Time:* ${timeStr}\n` +
        `*📁 Type:* ${isVid ? 'VIDEO' : 'IMAGE'}\n` +
        `*📎 File:* ${fileName}\n` +
        `*💬 Caption:* "${caption || 'No caption'}"\n\n` +
        `> 👁️ *AA MD Bot*`;
      await sock.sendMessage(selfJid, { text: infoText }).catch(() => {});
    }

    const cap =
      `🔓 *View-Once Revealed*\n\n` +
      `👤 *From:* ${formatPhone(num)}\n` +
      `🕐 *Time:* ${time}\n` +
      `📍 *Chat:* ${inGroup ? 'Group' : 'DM'}\n` +
      (hasKeyword ? `🔑 *Trigger:* Keyword match\n` : '') +
      `\n> 👁️ *AA MD Bot*`;

    await sock.sendMessage(
      selfJid,
      isVid ? { video: buf, caption: cap, mimetype: mime }
            : { image: buf, caption: cap, mimetype: mime }
    ).catch(() => {});

  } catch (e) {
    logger.warn({ err: e.message, stack: e.stack }, 'ViewOnce handler threw');
  }
}

// ── Helpers for reply reveal ──────────────────────────────────────────────────
// Extract plain text from any message type
function extractText(m) {
  if (!m) return '';
  const norm = normalizeMsg(m);
  return (
    norm?.conversation ||
    norm?.extendedTextMessage?.text ||
    norm?.imageMessage?.caption ||
    norm?.videoMessage?.caption ||
    norm?.documentMessage?.caption ||
    norm?.audioMessage?.caption ||
    norm?.buttonsResponseMessage?.selectedDisplayText ||
    norm?.listResponseMessage?.title || ''
  );
}

// Extract contextInfo from any message wrapper (handles ephemeral, documentWithCaption, etc.)
function extractContextInfo(m) {
  if (!m) return null;
  const norm = normalizeMsg(m);
  return (
    norm?.extendedTextMessage?.contextInfo ||
    norm?.imageMessage?.contextInfo ||
    norm?.videoMessage?.contextInfo ||
    norm?.documentMessage?.contextInfo ||
    norm?.audioMessage?.contextInfo ||
    norm?.buttonsResponseMessage?.contextInfo ||
    norm?.listResponseMessage?.contextInfo ||
    norm?.stickerMessage?.contextInfo ||
    null
  );
}

// ── Reply-based reveal: owner replies to ANY msg with voKeyword ───────────────
// Owner just replies to a view-once with the secret keyword — no msgId needed.
// Works because WhatsApp gives us contextInfo.stanzaId = the quoted msg's ID.
export async function handleReplyReveal(msg, sock, sessionId) {
  try {
    // Only act on owner's own messages
    if (!msg?.key?.fromMe) return;

    const voKeyword = db.settings.getValue('voKeyword');
    if (!voKeyword) return;

    // Get the text this message contains (unwrap all wrapper types)
    const msgText = extractText(msg.message).trim();
    if (!msgText || !msgText.toLowerCase().includes(voKeyword.toLowerCase())) return;

    // Get the quoted (replied-to) message ID from contextInfo
    const ctxInfo = extractContextInfo(msg.message);
    const stanzaId = ctxInfo?.stanzaId;
    if (!stanzaId) return;

    // Look up in store — with one short retry for delayed messages.update delivery
    let stored = viewOnceStore.get(stanzaId);
    if (!stored) {
      // Wait up to 3 s in case the view-once buffer is still being downloaded
      // via messages.update (WhatsApp's delayed-delivery path)
      for (let i = 0; i < 6; i++) {
        await new Promise(r => setTimeout(r, 500));
        stored = viewOnceStore.get(stanzaId);
        if (stored) break;
      }
    }
    if (!stored) return; // not a view-once or expired

    const selfNum = sock.user?.id?.split('@')[0]?.split(':')[0];
    const selfJid = selfNum ? `${selfNum}@s.whatsapp.net` : null;
    if (!selfJid) return;

    const tz      = config.timezone || 'Asia/Karachi';
    const date    = moment().tz(tz).format('DD/MM/YYYY');
    const timeStr = moment().tz(tz).format('HH:mm:ss');

    const cap =
      `🔓 *View-Once Revealed*\n\n` +
      `👤 *From:* ${formatPhone(stored.num)}\n` +
      `📅 *Date:* ${date}\n` +
      `⏰ *Time:* ${timeStr}\n` +
      `📍 *Chat:* ${stored.inGroup ? 'Group' : 'DM'}\n` +
      `🔑 *Trigger:* Keyword reply\n` +
      `💬 *Caption:* "${stored.caption || 'None'}"\n\n` +
      `> 👁️ *AA MD Bot*`;

    await sock.sendMessage(
      selfJid,
      stored.isVid
        ? { video: stored.buf, caption: cap, mimetype: stored.mime }
        : { image: stored.buf, caption: cap, mimetype: stored.mime }
    ).catch(() => {});

    logger.info({ sessionId, stanzaId }, '🔑 ViewOnce revealed via keyword reply');
  } catch (e) {
    logger.warn({ err: e.message }, 'handleReplyReveal threw');
  }
}

// ── Manual reveal: owner sends !reveal <msgId> in private chat ────────────────
export async function handleManualReveal(msgId, sock, replyJid) {
  const selfNum = sock.user?.id?.split('@')[0]?.split(':')[0];
  const selfJid = selfNum ? `${selfNum}@s.whatsapp.net` : null;
  if (!selfJid) return;

  const stored = viewOnceStore.get(msgId?.trim());
  if (!stored) {
    await sock.sendMessage(replyJid, {
      text:
        `❌ *View-Once not found*\n\n` +
        `Message ID not in cache (5 min TTL).\n` +
        `Make sure the bot was running when the view-once arrived.\n\n` +
        `> 👁️ *AA MD Bot*`,
    }).catch(() => {});
    return;
  }

  const cap =
    `🔓 *View-Once Revealed (Manual)*\n\n` +
    `👤 *From:* ${formatPhone(stored.num)}\n` +
    `🕐 *Time:* ${stored.time}\n` +
    `📍 *Chat:* ${stored.inGroup ? 'Group' : 'DM'}\n` +
    `💬 *Caption:* "${stored.caption || 'None'}"\n\n` +
    `> 👁️ *AA MD Bot*`;

  await sock.sendMessage(
    selfJid,
    stored.isVid
      ? { video: stored.buf, caption: cap, mimetype: stored.mime }
      : { image: stored.buf, caption: cap, mimetype: stored.mime }
  ).catch(() => {});
}

// ── Init: call once at startup ────────────────────────────────────────────────
export function initViewOnce() {
  setInterval(cleanViewOnceStore, 60_000);
  logger.info('👁️ ViewOnce feature initialized');
  logger.info(`👁️ Auto-reply key: "voAutoReply" in db.settings`);
  logger.info(`👁️ Trigger keyword key: "voKeyword" in db.settings`);
  logger.info(`👁️ Manual reveal: send "!reveal <msgId>" in your own private chat`);
}
