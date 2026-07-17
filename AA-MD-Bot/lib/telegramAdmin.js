// ============================================
// AA MD Bot - Telegram Admin / Pairing Bot
// Token: TELEGRAM_BOT_TOKEN
// Features:
//   /start   — welcome
//   /pair    — get WhatsApp pairing code
//   /status  — bot status
//   /help    — command list
// ============================================

import TelegramBot from 'node-telegram-bot-api';
import { logger }  from './logger.js';
import { db }      from './database.js';
import config      from '../config.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

let bot = null;

// Injected by index.js after sessions are ready
let _createSession   = null;
let _getAllSessions   = null;
let _latestCodes     = null; // Map<sessionId, code>
let _botEvents       = null;

export function initTelegramAdmin({ createSession, getAllSessions, latestPairingCodes, botEvents }) {
  if (!TOKEN) {
    logger.warn('⚡ TELEGRAM_BOT_TOKEN not set — Telegram admin bot disabled');
    return;
  }

  _createSession   = createSession;
  _getAllSessions   = getAllSessions;
  _latestCodes     = latestPairingCodes;
  _botEvents       = botEvents;

  bot = new TelegramBot(TOKEN, { polling: true });

  // Forward pairing codes to Telegram when they arrive
  botEvents.on('pairingCode', ({ sessionId, code }) => {
    const waiters = _pairingWaiters.get(sessionId);
    if (waiters) {
      for (const chatId of waiters) {
        bot.sendMessage(chatId,
          `✅ *Pairing Code for ${sessionId}*\n\n` +
          `\`${code}\`\n\n` +
          `Open WhatsApp → Linked Devices → Link with phone number → enter this code.\n\n` +
          `_Code expires in ~60 seconds_`,
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      }
      _pairingWaiters.delete(sessionId);
    }
  });

  // ── /start ───────────────────────────────────────────────────────────────────
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
      `🤖 *AA MD Bot — Admin Panel*\n\n` +
      `Welcome! Use this bot to manage your WhatsApp connections.\n\n` +
      `📋 *Commands:*\n` +
      `/pair \\<phone\\> — Get WhatsApp pairing code\n` +
      `/status — Bot status & connected numbers\n` +
      `/help — Show this help\n\n` +
      `*Example:*\n` +
      `/pair 923001234567\n\n` +
      `_Phone number must include country code, no \\+_`,
      { parse_mode: 'MarkdownV2' }
    ).catch(() => {});
  });

  // ── /help ────────────────────────────────────────────────────────────────────
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
      `📋 *AA MD Bot — Commands*\n\n` +
      `*/pair <phone>* — Generate WhatsApp pairing code\n` +
      `_Example: /pair 923001234567_\n\n` +
      `*/status* — Show connected WhatsApp numbers\n\n` +
      `*/help* — Show this message\n\n` +
      `💡 Use /pair with your number (include country code, no +)`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  });

  // ── /status ──────────────────────────────────────────────────────────────────
  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const sessions = _getAllSessions ? _getAllSessions() : [];
      if (!sessions.length) {
        return bot.sendMessage(chatId,
          `📊 *Bot Status*\n\n❌ No WhatsApp numbers connected.\n\nUse /pair to connect a number.`,
          { parse_mode: 'Markdown' }
        );
      }
      let text = `📊 *Bot Status*\n\n✅ Connected Numbers: ${sessions.length}\n\n`;
      for (const s of sessions) {
        const num = s.jid?.split('@')[0]?.split(':')[0] || s.id || '?';
        text += `• +${num}\n`;
      }
      text += `\n_AA MD Bot v${config.version}_`;
      bot.sendMessage(chatId, text, { parse_mode: 'Markdown' }).catch(() => {});
    } catch {
      bot.sendMessage(chatId, '❌ Could not fetch status.').catch(() => {});
    }
  });

  // ── /pair <phone> ─────────────────────────────────────────────────────────────
  // Map of sessionId → Set<chatId> waiting for the pairing code event
  const _pairingWaiters = new Map();

  bot.onText(/\/pair(?:\s+(\S+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const phone  = (match[1] || '').replace(/[^0-9]/g, '');

    if (!phone || phone.length < 7) {
      return bot.sendMessage(chatId,
        `❌ *Invalid phone number*\n\nUsage: /pair <phone with country code>\n\nExample:\n/pair 923001234567`,
        { parse_mode: 'Markdown' }
      );
    }

    await bot.sendMessage(chatId,
      `⏳ *Requesting pairing code...*\n\nPhone: +${phone}\n\n_Please wait a moment..._`,
      { parse_mode: 'Markdown' }
    );

    try {
      if (!_createSession) throw new Error('Session manager not ready');

      const sessionId = `tg_${phone}`;

      // If already connected, check for latest code
      const existing = _latestCodes?.get(sessionId);
      if (existing) {
        return bot.sendMessage(chatId,
          `✅ *Pairing Code*\n\n\`${existing}\`\n\nEnter this in WhatsApp → Linked Devices → Link with phone number.`,
          { parse_mode: 'Markdown' }
        );
      }

      // Register this chatId as a waiter
      if (!_pairingWaiters.has(sessionId)) _pairingWaiters.set(sessionId, new Set());
      _pairingWaiters.get(sessionId).add(chatId);

      // Trigger session creation — bot will emit pairingCode event
      await _createSession(sessionId, phone);

      // Also check immediately in case code came in during init
      await new Promise(r => setTimeout(r, 3000));
      const code = _latestCodes?.get(sessionId);
      if (code && _pairingWaiters.has(sessionId)) {
        _pairingWaiters.delete(sessionId);
        bot.sendMessage(chatId,
          `✅ *Pairing Code*\n\n\`${code}\`\n\nEnter this in WhatsApp → Linked Devices → Link with phone number.\n\n_Expires in ~60 seconds_`,
          { parse_mode: 'Markdown' }
        ).catch(() => {});
      }

    } catch (e) {
      _pairingWaiters.forEach((set, sid) => { set.delete(chatId); });
      bot.sendMessage(chatId,
        `❌ *Failed to generate pairing code*\n\n${e.message}\n\nTry again or use the web dashboard.`,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    }
  });

  // ── Unknown command ──────────────────────────────────────────────────────────
  bot.on('message', (msg) => {
    if (msg.text?.startsWith('/') && !msg.text.match(/^\/(start|help|pair|status)/)) {
      bot.sendMessage(msg.chat.id,
        `❓ Unknown command. Use /help to see available commands.`
      ).catch(() => {});
    }
  });

  bot.on('polling_error', (err) => {
    logger.warn({ err: err.message }, '📱 Telegram admin bot polling error');
  });

  logger.info('📱 Telegram admin bot started (pairing + status)');
  return bot;
}
