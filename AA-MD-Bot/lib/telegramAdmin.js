// ╔══════════════════════════════════════════════╗
// ║   AA MD Bot — Telegram Admin / Pairing Bot  ║
// ║   Token: TELEGRAM_BOT_TOKEN                 ║
// ║   Parse mode: HTML (most reliable)          ║
// ╚══════════════════════════════════════════════╝

import TelegramBot from 'node-telegram-bot-api';
import { logger }  from './logger.js';
import { db }      from './database.js';
import config      from '../config.js';

const TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const HTML    = { parse_mode: 'HTML' };
const DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━';
const FOOTER  = `\n${DIVIDER}\n🤖 <b>AA MD Bot</b>  v${config.version || '3.0.0'}`;
const esc     = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const sendText = (bot, id, text, extra = {}) =>
  bot.sendMessage(id, text, { parse_mode: 'HTML', ...extra }).catch(() => {});

async function editOrSend(bot, chatId, msgId, text) {
  try {
    return await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML' });
  } catch {
    return bot.sendMessage(chatId, text, HTML).catch(() => {});
  }
}

// Injected context from index.js
let _createSession   = null;
let _getAllSessions   = null;
let _latestCodes     = null;  // Map<sessionId, code>
let _botEvents       = null;
const _pairingWaiters = new Map(); // sessionId → Set<chatId>

export function initTelegramAdmin({ createSession, getAllSessions, latestPairingCodes, botEvents }) {
  if (!TOKEN) {
    logger.warn('⚡ TELEGRAM_BOT_TOKEN not set — Telegram admin bot disabled');
    return;
  }

  _createSession = createSession;
  _getAllSessions = getAllSessions;
  _latestCodes   = latestPairingCodes;
  _botEvents     = botEvents;

  const bot = new TelegramBot(TOKEN, { polling: true });

  // Forward pairing codes to waiting Telegram chats
  botEvents.on('pairingCode', ({ sessionId, code }) => {
    const waiters = _pairingWaiters.get(sessionId);
    if (!waiters?.size) return;
    for (const chatId of waiters) {
      bot.sendMessage(chatId,
        `✅ <b>Pairing Code</b>\n${DIVIDER}\n\n` +
        `📱 Phone: <code>+${esc(sessionId.replace('tg_',''))}</code>\n\n` +
        `🔑 Code:\n<code>${esc(code)}</code>\n\n` +
        `<i>Open WhatsApp → Settings → Linked Devices → Link a device → Link with phone number, then enter this code.</i>\n\n` +
        `⏰ <i>Expires in ~60 seconds</i>` +
        FOOTER,
        HTML
      ).catch(() => {});
    }
    _pairingWaiters.delete(sessionId);
  });

  // ── /start ─────────────────────────────────────────────────────────────────
  bot.onText(/\/start/, (msg) => {
    sendText(bot, msg.chat.id,
      `🤖 <b>AA MD Bot — Admin Panel</b>\n${DIVIDER}\n\n` +
      `Welcome! Manage your WhatsApp connections from here.\n\n` +
      `📋 <b>Available Commands:</b>\n\n` +
      `/pair <code>923001234567</code>\n` +
      `╰ Get WhatsApp pairing code\n\n` +
      `/status — Connected numbers & bot info\n` +
      `/ping — Check bot response time\n` +
      `/help — Full command list\n\n` +
      `💡 <i>Phone number must include country code, no + sign</i>` +
      FOOTER
    );
  });

  // ── /help ──────────────────────────────────────────────────────────────────
  bot.onText(/\/help/, (msg) => {
    sendText(bot, msg.chat.id,
      `📋 <b>AA MD Bot — Admin Commands</b>\n${DIVIDER}\n\n` +
      `🔗 <b>Pairing</b>\n` +
      `/pair <code>&lt;phone&gt;</code> — Generate WhatsApp pairing code\n` +
      `  Example: <code>/pair 923001234567</code>\n\n` +
      `📊 <b>Status</b>\n` +
      `/status — Show connected numbers & uptime\n` +
      `/ping — Check bot speed\n\n` +
      `❓ <b>General</b>\n` +
      `/help — Show this message\n` +
      `/start — Welcome & quick start\n\n` +
      `💡 <b>Tips</b>\n` +
      `• Include country code in phone number\n` +
      `• No spaces or + in the number\n` +
      `• Pakistan: <code>923xxxxxxxxx</code>\n` +
      `• Saudi: <code>9665xxxxxxxx</code>` +
      FOOTER
    );
  });

  // ── /ping ──────────────────────────────────────────────────────────────────
  bot.onText(/\/ping/, async (msg) => {
    const start = Date.now();
    const sent  = await bot.sendMessage(msg.chat.id, '🏓 Pinging...', HTML).catch(() => null);
    if (!sent) return;
    const ms    = Date.now() - start;
    const upSec = Math.floor(process.uptime());
    const upStr = upSec > 3600
      ? `${Math.floor(upSec/3600)}h ${Math.floor((upSec%3600)/60)}m`
      : `${Math.floor(upSec/60)}m ${upSec%60}s`;
    editOrSend(bot, msg.chat.id, sent.message_id,
      `🏓 <b>Pong!</b>  <code>${ms}ms</code>\n${DIVIDER}\n\n` +
      `⏱ Uptime: <b>${esc(upStr)}</b>\n` +
      `💾 RAM: ${Math.round(process.memoryUsage().heapUsed/1024/1024)}MB used\n` +
      `📦 Node: ${esc(process.version)}` +
      FOOTER
    );
  });

  // ── /status ────────────────────────────────────────────────────────────────
  bot.onText(/\/status/, async (msg) => {
    const chatId  = msg.chat.id;
    const sent    = await bot.sendMessage(chatId, '📊 <b>Fetching status...</b>', HTML).catch(() => null);
    if (!sent) return;

    try {
      const sessions = _getAllSessions ? _getAllSessions() : [];
      const upSec    = Math.floor(process.uptime());
      const upStr    = upSec > 3600
        ? `${Math.floor(upSec/3600)}h ${Math.floor((upSec%3600)/60)}m`
        : `${Math.floor(upSec/60)}m ${upSec%60}s`;
      const mem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

      let text =
        `📊 <b>Bot Status</b>\n${DIVIDER}\n\n` +
        `🟢 Status: <b>Online</b>\n` +
        `⏱ Uptime: <b>${esc(upStr)}</b>\n` +
        `💾 RAM: ${mem}MB\n\n`;

      if (!sessions.length) {
        text += `📱 <b>Connected Numbers:</b> None\n\n<i>Use /pair to connect a WhatsApp number.</i>`;
      } else {
        text += `📱 <b>Connected Numbers (${sessions.length}):</b>\n`;
        for (const s of sessions) {
          const num  = s.jid?.split('@')[0]?.split(':')[0] || s.id || '?';
          const name = s.pushName || '';
          text += `  • <code>+${esc(num)}</code>${name ? ` — ${esc(name)}` : ''}\n`;
        }
      }

      text += FOOTER;
      editOrSend(bot, chatId, sent.message_id, text);
    } catch (e) {
      editOrSend(bot, chatId, sent.message_id, `❌ Could not fetch status: ${esc(e.message)}`);
    }
  });

  // ── /pair <phone> ──────────────────────────────────────────────────────────
  bot.onText(/\/pair(?:\s+(\S+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const phone  = (match[1] || '').replace(/[^0-9]/g, '');

    if (!phone || phone.length < 7 || phone.length > 15) {
      return sendText(bot, chatId,
        `❌ <b>Invalid phone number</b>\n\n` +
        `Usage: <code>/pair 923001234567</code>\n\n` +
        `• Include country code\n` +
        `• No spaces, no + sign\n` +
        `• Pakistan: 92, Saudi: 966, UAE: 971`
      );
    }

    const sent = await bot.sendMessage(chatId,
      `⏳ <b>Requesting pairing code...</b>\n\n` +
      `📱 Phone: <code>+${esc(phone)}</code>\n\n` +
      `<i>Please wait a moment...</i>`,
      HTML
    ).catch(() => null);
    if (!sent) return;

    try {
      if (!_createSession) throw new Error('Session manager not ready. Restart the bot.');

      const sessionId = `tg_${phone}`;

      // Check if we already have a fresh code
      const existing = _latestCodes?.get(sessionId);
      if (existing) {
        return editOrSend(bot, chatId, sent.message_id,
          `✅ <b>Pairing Code</b>\n${DIVIDER}\n\n` +
          `📱 Phone: <code>+${esc(phone)}</code>\n\n` +
          `🔑 Code:\n<code>${esc(existing)}</code>\n\n` +
          `<i>Enter this in WhatsApp → Settings → Linked Devices → Link a device → Link with phone number</i>\n\n` +
          `⏰ <i>If expired, send /pair again</i>` +
          FOOTER
        );
      }

      // Register as waiter
      if (!_pairingWaiters.has(sessionId)) _pairingWaiters.set(sessionId, new Set());
      _pairingWaiters.get(sessionId).add(chatId);

      // Create session — this triggers the pairingCode event
      await _createSession(sessionId, phone);

      // Wait briefly for the event
      await new Promise(r => setTimeout(r, 4000));

      // Check again in case event fired while we waited
      const code = _latestCodes?.get(sessionId);
      if (code && _pairingWaiters.has(sessionId)) {
        _pairingWaiters.get(sessionId).delete(chatId);
        if (!_pairingWaiters.get(sessionId).size) _pairingWaiters.delete(sessionId);

        editOrSend(bot, chatId, sent.message_id,
          `✅ <b>Pairing Code</b>\n${DIVIDER}\n\n` +
          `📱 Phone: <code>+${esc(phone)}</code>\n\n` +
          `🔑 Code:\n<code>${esc(code)}</code>\n\n` +
          `<i>Enter this in WhatsApp → Settings → Linked Devices → Link a device → Link with phone number</i>\n\n` +
          `⏰ <i>Expires in ~60 seconds</i>` +
          FOOTER
        );
      } else {
        // Code will come via pairingCode event — update the "waiting" message
        editOrSend(bot, chatId, sent.message_id,
          `⏳ <b>Waiting for pairing code...</b>\n\n` +
          `📱 Phone: <code>+${esc(phone)}</code>\n\n` +
          `<i>The code will appear here automatically once WhatsApp generates it. This usually takes 10–30 seconds.</i>` +
          FOOTER
        );
      }
    } catch (e) {
      // Remove waiter on error
      const sid = `tg_${phone}`;
      _pairingWaiters.get(sid)?.delete(chatId);

      editOrSend(bot, chatId, sent.message_id,
        `❌ <b>Pairing failed</b>\n\n` +
        `${esc(e.message)}\n\n` +
        `💡 Try again in a moment, or use the web dashboard.` +
        FOOTER
      );
    }
  });

  // ── Catch-all for unknown commands ─────────────────────────────────────────
  const KNOWN = /^\/(start|help|pair|status|ping)/;
  bot.on('message', (msg) => {
    if (msg.text?.startsWith('/') && !KNOWN.test(msg.text)) {
      sendText(bot, msg.chat.id,
        `❓ Unknown command.\n\nUse /help to see available commands.`
      );
    }
  });

  bot.on('polling_error', (err) => {
    logger.warn({ code: err.code, msg: err.message }, '📱 Telegram admin polling error');
  });

  logger.info('📱 Telegram admin bot started (pairing + status)');
  return bot;
}
