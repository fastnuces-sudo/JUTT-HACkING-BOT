// ============================================
// AA MD Bot - Good / Nice / Any4SameEmojis
// Developer: Ahsan Ali | AA Mods
//
// .good / .nice  — natural-looking replies that secretly reveal a view-once
//                  to the owner's "You" chat. Sender only sees "Good 👍" or "Nice! 👌".
// .any4sameemojis — toggle the 4-same-emoji viewonce trigger on/off
// ============================================

import {
  viewOnceStore, getIndexEntry, handleRevealByReply,
} from '../../lib/antiViewOnce.js';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import moment from 'moment-timezone';
import config from '../../config.js';
import { db } from '../../lib/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEDIA_DIR  = path.join(__dirname, '../../media/viewonce');
const INDEX_PATH = path.join(MEDIA_DIR, 'index.json');

// ── Load disk index ───────────────────────────────────────────────────────────
function loadDiskIndex() {
  try {
    if (fs.existsSync(INDEX_PATH)) return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  } catch {}
  return {};
}

// ── Download buffer from a Baileys media message ──────────────────────────────
async function dlBuf(mediaMsg, type) {
  const stream = await downloadContentFromMessage(mediaMsg, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// ── Extract media from quoted message (all wrapper types) ─────────────────────
function extractQuotedMedia(quotedMsg) {
  if (!quotedMsg) return null;
  const inner =
    quotedMsg?.viewOnceMessageV2?.message ||
    quotedMsg?.viewOnceMessageV2Extension?.message ||
    quotedMsg?.viewOnceMessage?.message ||
    quotedMsg?.ephemeralMessage?.message ||
    quotedMsg;

  if (inner?.imageMessage) return { mediaMsg: inner.imageMessage, isVid: false, mime: inner.imageMessage.mimetype || 'image/jpeg' };
  if (inner?.videoMessage) return { mediaMsg: inner.videoMessage, isVid: true,  mime: inner.videoMessage.mimetype || 'video/mp4' };
  if (quotedMsg?.imageMessage) return { mediaMsg: quotedMsg.imageMessage, isVid: false, mime: quotedMsg.imageMessage.mimetype || 'image/jpeg' };
  if (quotedMsg?.videoMessage) return { mediaMsg: quotedMsg.videoMessage, isVid: true,  mime: quotedMsg.videoMessage.mimetype || 'video/mp4' };
  return null;
}

// ── Shared reveal logic ───────────────────────────────────────────────────────
async function doReveal(sock, msg, selfJid, label) {
  const tz      = config.timezone || 'Asia/Karachi';
  const date    = moment().tz(tz).format('DD/MM/YYYY');
  const timeStr = moment().tz(tz).format('HH:mm:ss');

  const cap =
    `🔓 *View-Once Revealed*\n\n` +
    `📅 *Date:* ${date}\n` +
    `⏰ *Time:* ${timeStr}\n` +
    `🔑 *Trigger:* ${label}\n\n` +
    `> 👁️ *AA MD Bot*`;

  const send = (stored) => sock.sendMessage(selfJid,
    stored.isVid
      ? { video: stored.buf, caption: cap, mimetype: stored.mime }
      : { image: stored.buf, caption: cap, mimetype: stored.mime }
  ).catch(() => {});

  // Step 1: direct download from quotedMessage media keys
  const ctxInfo   = msg.message?.extendedTextMessage?.contextInfo ||
                    msg.message?.imageMessage?.contextInfo ||
                    msg.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo || null;
  const quotedMsg = ctxInfo?.quotedMessage;

  if (quotedMsg) {
    const extracted = extractQuotedMedia(quotedMsg);
    if (extracted) {
      try {
        const type = extracted.isVid ? 'video' : 'image';
        const buf  = await dlBuf(extracted.mediaMsg, type);
        if (buf?.length > 0) {
          await send({ isVid: extracted.isVid, buf, mime: extracted.mime });
          return true;
        }
      } catch {}
    }
  }

  // Step 2: handleRevealByReply (contextInfo walker → in-memory store → disk)
  let found = await handleRevealByReply(msg, sock);
  if (!found) {
    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 500));
      found = await handleRevealByReply(msg, sock);
      if (found) break;
    }
  }
  if (found) return true;

  // Step 3: global scan — find most recent viewonce in any chat
  const TTL = 30 * 60 * 1000;
  const chatJid = msg.key.remoteJid;
  let stored = null;

  if (viewOnceStore.size > 0) {
    // Prefer same-chat first, then global
    for (const [, entry] of viewOnceStore) {
      if (entry.chatJid === chatJid && Date.now() - entry.timestamp < TTL) {
        if (!stored || entry.timestamp > stored.timestamp) stored = entry;
      }
    }
    if (!stored) {
      for (const [, entry] of viewOnceStore) {
        if (Date.now() - entry.timestamp < TTL) {
          if (!stored || entry.timestamp > stored.timestamp) stored = entry;
        }
      }
    }
  }

  // Step 4: disk index scan
  if (!stored) {
    try {
      const idx = loadDiskIndex();
      let newest = null, newestTime = 0;
      // pass 1: same chat
      for (const [, meta] of Object.entries(idx)) {
        if (meta.chatJid === chatJid && meta.savedPath) {
          const t = meta.timestamp || 0;
          if (t > newestTime) { newest = meta; newestTime = t; }
        }
      }
      // pass 2: global
      if (!newest) {
        for (const [, meta] of Object.entries(idx)) {
          if (meta.savedPath) {
            const t = meta.timestamp || 0;
            if (t > newestTime) { newest = meta; newestTime = t; }
          }
        }
      }
      if (newest?.savedPath && fs.existsSync(newest.savedPath)) {
        const diskBuf = fs.readFileSync(newest.savedPath);
        if (diskBuf?.length > 0) stored = { ...newest, buf: diskBuf };
      }
    } catch {}
  }

  if (stored) {
    await send(stored);
    return true;
  }

  return false;
}

export default {
  command: 'good',
  alias: ['nice', 'any4sameemojis'],
  description: 'Natural-looking view-once reveal / toggle 4-emoji trigger',
  category: 'owner',
  ownerOnly: true,

  async execute({ command, args, sock, msg, jid, reply }) {
    // ── .any4sameemojis — toggle the 4-same-emoji viewonce trigger ──────────
    if (command === 'any4sameemojis') {
      const sub     = (args[0] || '').toLowerCase();
      const current = db.settings.getValue('emojiRevealEnabled') !== false; // default ON

      if (!sub || (sub !== 'on' && sub !== 'off')) {
        return reply(
          `🔥 *4-Same-Emoji ViewOnce Trigger*\n\n` +
          `Status: *${current ? '✅ ON' : '❌ OFF'}*\n\n` +
          `📌 *How it works:*\n` +
          `Reply to any view-once with 4 identical emojis\n` +
          `(e.g. 🔥🔥🔥🔥 or 👀👀👀👀 or ❤️❤️❤️❤️)\n` +
          `→ Bot silently sends it to your "You" chat.\n\n` +
          `📋 *Toggle:*\n` +
          `• *.any4sameemojis on*  — enable\n` +
          `• *.any4sameemojis off* — disable\n\n` +
          `> 👁️ *AA MD Bot*`
        );
      }

      const enable = sub === 'on';
      db.settings.setValue('emojiRevealEnabled', enable);
      return reply(
        `${enable ? '✅' : '❌'} *4-Same-Emoji Trigger ${enable ? 'Enabled' : 'Disabled'}*\n\n` +
        `${enable ? 'Replying with 4 same emojis now reveals view-once.' : 'Emoji trigger disabled. Use .avv or .good/.nice to reveal.'}\n\n` +
        `> 👁️ *AA MD Bot*`
      );
    }

    // ── .good / .nice — natural-looking reveal ──────────────────────────────
    const selfNum = sock.user?.id?.split('@')[0]?.split(':')[0];
    const selfJid = selfNum ? `${selfNum}@s.whatsapp.net` : null;
    if (!selfJid) return;

    const response = command === 'good' ? 'Good 👍' : 'Nice! 👌';

    // First: send the natural-looking reply (sender only sees this)
    await sock.sendMessage(jid, { text: response }, { quoted: msg }).catch(() => {});

    // Then: silently reveal viewonce to owner's self-chat
    const label = command === 'good' ? '.good' : '.nice';
    await doReveal(sock, msg, selfJid, label);
    // No error shown — completely silent from sender's perspective
  },
};
