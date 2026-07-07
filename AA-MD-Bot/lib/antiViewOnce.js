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
// Map keyed by message ID — stores buffer + metadata for manual reveal
export const viewOnceStore = new Map();
const _MAX_STORE = 200;

// Dedup guard — WhatsApp often delivers view-once twice
// (empty placeholder via messages.upsert, real content via messages.update)
const _processed = new Set();
const _PROCESSED_MAX = 200;

// Media directory for saved files
const MEDIA_DIR = path.join(__dirname, '../media/viewonce');
fs.ensureDirSync(MEDIA_DIR);

// ── Persistent disk index — survives the 30-min in-memory TTL ────────────────
// Maps msgId → { savedPath, mime, isVid, num, time, inGroup, caption, senderName }
const INDEX_PATH = path.join(MEDIA_DIR, 'index.json');

function loadIndex() {
  try {
    if (fs.existsSync(INDEX_PATH)) return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  } catch {}
  return {};
}

function saveIndexEntry(msgId, meta) {
  try {
    const idx = loadIndex();
    // Prune to last 500 entries (each is ~300 bytes)
    const keys = Object.keys(idx);
    if (keys.length >= 500) delete idx[keys[0]];
    idx[msgId] = meta;
    fs.writeFileSync(INDEX_PATH, JSON.stringify(idx));
  } catch {}
}

// Load entry from disk when no longer in memory (TTL expired)
export function getIndexEntry(msgId) {
  const idx = loadIndex();
  return idx[msgId] || null;
}

// ── Periodic cleanup (30-minute TTL) ─────────────────────────────────────────
export function cleanViewOnceStore() {
  const now = Date.now();
  const TTL = 30 * 60 * 1000; // 30 minutes (was 5 min — extended so reveals work longer)
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

    // Store for reveal (in-memory + persistent disk index)
    const senderName = sock.contacts?.[senderJid]?.name
               || sock.contacts?.[senderJid]?.notify
               || formatPhone(num);
    const entry = {
      buf, mime, isVid, num, time, inGroup,
      caption, chatJid, senderJid, senderName,
      savedPath,
      timestamp: Date.now(),
    };
    viewOnceStore.set(msgId, entry);
    if (viewOnceStore.size > _MAX_STORE) viewOnceStore.delete(viewOnceStore.keys().next().value);

    // Persist to disk index so reveal works even after the 30-min in-memory TTL
    // chatJid and timestamp (numeric ms) are required by the disk-fallback scan in handleReplyReveal
    saveIndexEntry(msgId, { savedPath, mime, isVid, num, time, inGroup, caption, senderName, chatJid, timestamp: Date.now() });

    logger.info({ sessionId, msgId, savedPath, bytes: buf.length }, '✅ ViewOnce cached');

    // ── Auto-reply to sender ──────────────────────────────────────────────────
    const autoReply = db.settings.getValue('voAutoReply');
    if (autoReply && !msg.key.fromMe) {
      await sock.sendMessage(chatJid, { text: autoReply }).catch(() => {});
    }

    // ── Decide whether to auto-forward to "You" chat ─────────────────────────
    const settings = db.settings.get();
    const grpSet   = inGroup ? db.groups.get(chatJid) : null;
    const avo      = inGroup
      ? (grpSet?.antiviewonce ?? settings.antiViewOnce ?? false)
      : (settings.antiViewOnce ?? false);

    if (!avo) return; // nothing more to do

    const selfNum = sock.user?.id?.split('@')[0]?.split(':')[0];
    const selfJid = selfNum ? `${selfNum}@s.whatsapp.net` : null;
    if (!selfJid) return;

    const date    = moment().tz(tz).format('DD/MM/YYYY');
    const timeStr = moment().tz(tz).format('HH:mm:ss');

    const cap =
      `🔓 *View-Once Revealed*\n\n` +
      `👤 *From:* ${formatPhone(num)}\n` +
      `🕐 *Time:* ${time}\n` +
      `📍 *Chat:* ${inGroup ? 'Group' : 'DM'}\n` +
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

// Extract contextInfo from any message wrapper.
// Handles ephemeral, documentWithCaption, viewOnce, and all standard message types.
// Walks the full wrapper chain to find a contextInfo that contains a stanzaId.
function extractContextInfo(m) {
  if (!m) return null;

  // Walk the message tree: unwrap each known envelope type and collect contextInfo candidates
  // We do a more thorough walk than normalizeMsg (which only handles 2 types).
  function* walk(obj, depth = 0) {
    if (!obj || depth > 8) return;
    // Yield contextInfo from any known message type at this level
    for (const key of [
      'extendedTextMessage', 'imageMessage', 'videoMessage', 'documentMessage',
      'audioMessage', 'buttonsResponseMessage', 'listResponseMessage',
      'stickerMessage', 'contactMessage', 'locationMessage', 'templateButtonReplyMessage',
    ]) {
      if (obj[key]?.contextInfo) yield obj[key].contextInfo;
    }
    // Walk into known envelope/wrapper types
    for (const wrapper of [
      'ephemeralMessage', 'documentWithCaptionMessage',
      'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension',
    ]) {
      if (obj[wrapper]?.message) yield* walk(obj[wrapper].message, depth + 1);
      if (obj[wrapper]) yield* walk(obj[wrapper], depth + 1); // some wrap without .message
    }
  }

  // Return first contextInfo that has a stanzaId (the one that identifies the quoted message)
  for (const ctx of walk(m)) {
    if (ctx?.stanzaId) return ctx;
  }
  // Fall back to first contextInfo found (even without stanzaId — caller checks)
  for (const ctx of walk(m)) {
    return ctx;
  }
  return null;
}

// ── Emoji trigger detection ───────────────────────────────────────────────────
// Returns true if the text contains 4+ of the same emoji grapheme cluster.
// Uses Intl.Segmenter for correct handling of ZWJ sequences, skin-tone
// variants, flags, keycaps, and all multi-codepoint emoji combinations.
function hasFourSameEmoji(text) {
  if (!text) return false;
  try {
    // Segment the text into grapheme clusters (the correct "visual character" unit)
    const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
    const segments = [...segmenter.segment(text)];

    // Keep only segments that look like emoji:
    //  - Contains a codepoint with Emoji_Presentation or Extended_Pictographic property
    //  - OR is a keycap sequence (digit + \uFE0F + \u20E3)
    const emojiSegments = segments
      .map(s => s.segment)
      .filter(s => {
        if (!s) return false;
        const cp = s.codePointAt(0);
        // Keycap sequences: #*0-9 + VS16 + combining enclosing keycap
        if (s.length >= 2 && s.includes('\u20E3')) return true;
        // Regional indicators (flags): U+1F1E0-U+1F1FF (appear in pairs)
        if (cp >= 0x1F1E0 && cp <= 0x1F1FF) return true;
        // Standard emoji ranges
        if (cp >= 0x1F300) return true;  // Misc Symbols and Pictographs+
        if (cp >= 0x2600 && cp <= 0x27BF) return true; // Misc Symbols, Dingbats
        if (cp >= 0x2300 && cp <= 0x23FF) return true; // Misc Technical
        if (cp >= 0xFE00) return true; // Variation selectors + specials
        return false;
      });

    const counts = {};
    for (const e of emojiSegments) {
      counts[e] = (counts[e] || 0) + 1;
      if (counts[e] >= 4) return true;
    }
    return false;
  } catch {
    // Intl.Segmenter fallback for old Node: simple codepoint count
    const counts = {};
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      if (cp >= 0x1F300 || (cp >= 0x2600 && cp <= 0x27BF)) {
        counts[ch] = (counts[ch] || 0) + 1;
        if (counts[ch] >= 4) return true;
      }
    }
    return false;
  }
}

// ── Reply-based reveal: emoji trigger OR configured voword keyword ────────────
// Owner replies to a view-once message with EITHER:
//   (a) 4 identical emojis (e.g. 🔥🔥🔥🔥 or ❤️❤️❤️❤️)
//   (b) the configured voword keyword (e.g. "asdf" → set via .voword asdf)
// Both reveal the media to the "You" private chat.
export async function handleReplyReveal(msg, sock, sessionId) {
  try {
    // Only act on owner's own messages
    if (!msg?.key?.fromMe) return;

    // Get the text this message contains (unwrap all wrapper types)
    const msgText = extractText(msg.message).trim();
    if (!msgText) return;

    // Check trigger: 4 same emojis OR hardcoded secret word "asdf"
    const FIXED_KEYWORD = 'asdf';
    const isEmoji   = hasFourSameEmoji(msgText);
    const isKeyword = msgText.toLowerCase().trim() === FIXED_KEYWORD;
    if (!isEmoji && !isKeyword) return;

    // Get the quoted (replied-to) message ID from contextInfo.
    // stanzaId may be absent when owner types keyword WITHOUT using WhatsApp reply feature.
    // In that case we skip the exact lookup and go straight to the chatJid fallback scan.
    const ctxInfo  = extractContextInfo(msg.message);
    const stanzaId = ctxInfo?.stanzaId || ctxInfo?.quotedStanzaId || null;

    // ── Exact stanzaId lookup (works when owner used WhatsApp Reply) ──────────
    let stored = stanzaId ? viewOnceStore.get(stanzaId) : null;

    if (!stored && stanzaId) {
      // Wait up to 3 s in case buffer is still downloading via messages.update
      for (let i = 0; i < 6; i++) {
        await new Promise(r => setTimeout(r, 500));
        stored = viewOnceStore.get(stanzaId);
        if (stored) break;
      }
    }

    // ── chatJid fallback scan ─────────────────────────────────────────────────
    // Runs when:
    //  (a) stanzaId not found in store (ID format mismatch between devices), OR
    //  (b) no stanzaId at all (owner typed keyword without using WhatsApp Reply)
    // Finds the most-recently cached view-once in this chat (30-min TTL).
    if (!stored) {
      const chatJid = msg.key.remoteJid;

      // In-memory scan
      if (viewOnceStore.size > 0) {
        let newest = null;
        for (const [, entry] of viewOnceStore) {
          if (entry.chatJid === chatJid || !chatJid) {
            if (!newest || entry.timestamp > newest.timestamp) newest = entry;
          }
        }
        if (newest && Date.now() - newest.timestamp < 30 * 60 * 1000) stored = newest;
      }

      // Disk index scan (survives bot restarts)
      if (!stored) {
        try {
          const idx = loadIndex();
          let newestMeta = null, newestTime = 0;
          for (const [, meta] of Object.entries(idx)) {
            if ((meta.chatJid === chatJid || !chatJid) && meta.savedPath) {
              const mtime = meta.time ? new Date(meta.time).getTime() : 0;
              if (mtime > newestTime) { newestMeta = meta; newestTime = mtime; }
            }
          }
          if (newestMeta?.savedPath && fs.existsSync(newestMeta.savedPath)) {
            const diskBuf = fs.readFileSync(newestMeta.savedPath);
            if (diskBuf?.length > 0) stored = { ...newestMeta, buf: diskBuf, timestamp: Date.now() };
          }
        } catch {}
      }
    }

    if (!stored) return; // no cached view-once for this chat

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
      `🔑 *Trigger:* Emoji reply\n` +
      `💬 *Caption:* "${stored.caption || 'None'}"\n\n` +
      `> 👁️ *AA MD Bot*`;

    await sock.sendMessage(
      selfJid,
      stored.isVid
        ? { video: stored.buf, caption: cap, mimetype: stored.mime }
        : { image: stored.buf, caption: cap, mimetype: stored.mime }
    ).catch(() => {});

    const trigger = isEmoji ? 'emoji-reply' : 'keyword(asdf)';
    logger.info({ sessionId, stanzaId, trigger }, '🔑 ViewOnce revealed via reply trigger');
  } catch (e) {
    logger.warn({ err: e.message }, 'handleReplyReveal threw');
  }
}

// ── Manual reveal: by msgId (from !reveal, .reveal, or the reveal plugin) ─────
export async function handleManualReveal(msgId, sock, replyJid) {
  const selfNum = sock.user?.id?.split('@')[0]?.split(':')[0];
  const selfJid = selfNum ? `${selfNum}@s.whatsapp.net` : null;
  if (!selfJid) return;

  const id = msgId?.trim();

  // Check in-memory store first (fast path)
  let stored = viewOnceStore.get(id);

  // If not in memory, try recovering from disk index (survives 30-min TTL)
  if (!stored) {
    const meta = getIndexEntry(id);
    if (meta?.savedPath) {
      try {
        const diskBuf = await fs.readFile(meta.savedPath);
        if (diskBuf?.length > 0) {
          stored = { ...meta, buf: diskBuf, timestamp: Date.now() };
        }
      } catch {}
    }
  }

  if (!stored) {
    await sock.sendMessage(replyJid, {
      text:
        `❌ *View-Once not found*\n\n` +
        `Message ID not in cache.\n` +
        `Make sure the bot was running when the view-once arrived,\n` +
        `and that you're replying to the original message.\n\n` +
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

// ── Reveal by quoted/replied message — used by .reveal plugin ─────────────────
// Pass the full `msg` of the owner's command message. Extracts the quoted msgId
// and reveals that view-once. Returns true if found, false if not in cache.
export async function handleRevealByReply(msg, sock) {
  const selfNum = sock.user?.id?.split('@')[0]?.split(':')[0];
  const selfJid = selfNum ? `${selfNum}@s.whatsapp.net` : null;
  if (!selfJid) return false;

  // Extract the quoted message ID from contextInfo
  const ctxInfo = extractContextInfo(msg.message);
  const stanzaId = ctxInfo?.stanzaId;
  if (!stanzaId) return false;

  // Check in-memory store
  let stored = viewOnceStore.get(stanzaId);

  // Fall back to disk if not in memory
  if (!stored) {
    const meta = getIndexEntry(stanzaId);
    if (meta?.savedPath) {
      try {
        const diskBuf = await fs.readFile(meta.savedPath);
        if (diskBuf?.length > 0) stored = { ...meta, buf: diskBuf, timestamp: Date.now() };
      } catch {}
    }
  }

  if (!stored) return false;

  const tz      = config.timezone || 'Asia/Karachi';
  const date    = moment().tz(tz).format('DD/MM/YYYY');
  const timeStr = moment().tz(tz).format('HH:mm:ss');

  const cap =
    `🔓 *View-Once Revealed*\n\n` +
    `👤 *From:* ${formatPhone(stored.num)}\n` +
    `📅 *Date:* ${date}\n` +
    `⏰ *Time:* ${timeStr}\n` +
    `📍 *Chat:* ${stored.inGroup ? 'Group' : 'DM'}\n` +
    `💬 *Caption:* "${stored.caption || 'None'}"\n\n` +
    `> 👁️ *AA MD Bot*`;

  await sock.sendMessage(
    selfJid,
    stored.isVid
      ? { video: stored.buf, caption: cap, mimetype: stored.mime }
      : { image: stored.buf, caption: cap, mimetype: stored.mime }
  ).catch(() => {});

  return true;
}

// ── Init: call once at startup ────────────────────────────────────────────────
export function initViewOnce() {
  setInterval(cleanViewOnceStore, 60_000);
  logger.info('👁️ ViewOnce feature initialized');
  logger.info('👁️ Auto-reveal: .antiviewonce on/off');
  logger.info('👁️ Emoji reveal: reply to a view-once with 4 same emojis (e.g. 🔥🔥🔥🔥) to reveal');
  logger.info('👁️ Manual reveal: .avv in reply to a view-once message');
}
