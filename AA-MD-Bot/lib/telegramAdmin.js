// ╔══════════════════════════════════════════════════════════════════╗
// ║   AA MD Bot — Telegram Pairing Bot                              ║
// ║   Token  : TELEGRAM_BOT_TOKEN                                   ║
// ║   Access : Single authorized user only (OWNER_ID)               ║
// ╚══════════════════════════════════════════════════════════════════╝

import TelegramBot from 'node-telegram-bot-api';
import { logger }  from './logger.js';

const TOKEN    = process.env.TELEGRAM_BOT_TOKEN;
const HTML     = { parse_mode: 'HTML' };

// ── Only this Telegram user may use the bot ──────────────────────────────────
const OWNER_ID = 6001083166;

const DIV    = '━━━━━━━━━━━━━━━━━━━━━━';
const FOOTER = `\n${DIV}\n🤖 <b>AA MD Bot</b>`;
const esc    = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ── Injected context ─────────────────────────────────────────────────────────
let _createSession  = null;
let _latestCodes    = null;
let _botEvents      = null;

const _pairingWaiters = new Map(); // sessionId → Set<chatId>
const _pairingChats   = new Map(); // sessionId → chatId
const _awaitingPhone  = new Map(); // chatId → { msgId }

// ── Keyboards ────────────────────────────────────────────────────────────────
const KB_HOME = {
  inline_keyboard: [[
    { text: '📱 Get Pairing Code', callback_data: 'do_pair' },
  ]],
};

const KB_BACK = {
  inline_keyboard: [[
    { text: '« Back', callback_data: 'home' },
  ]],
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const sendText = (bot, id, text, extra = {}) =>
  bot.sendMessage(id, text, { parse_mode: 'HTML', ...extra }).catch(() => {});

async function editOrSend(bot, chatId, msgId, text, extra = {}) {
  try {
    return await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', ...extra });
  } catch {
    return bot.sendMessage(chatId, text, { parse_mode: 'HTML', ...extra }).catch(() => {});
  }
}

function isOwner(chatId) { return chatId === OWNER_ID; }

// ── Core pairing logic ────────────────────────────────────────────────────────
async function doPair(bot, chatId, phone, editMsgId = null) {
  const waiting =
    `⏳ <b>Requesting pairing code...</b>\n\n` +
    `📱 Number: <code>+${esc(phone)}</code>\n\n` +
    `<i>Please wait a moment...</i>` + FOOTER;

  const sent = editMsgId
    ? await editOrSend(bot, chatId, editMsgId, waiting).catch(() => null)
    : await bot.sendMessage(chatId, waiting, HTML).catch(() => null);
  if (!sent) return;

  const sentId = sent.message_id ?? editMsgId;

  try {
    if (!_createSession) throw new Error('Bot session manager not ready — restart the bot.');

    const sessionId = `tg_${phone}`;
    _pairingChats.set(sessionId, chatId);

    // Return existing fresh code if available
    const existing = _latestCodes?.get(sessionId);
    if (existing) {
      return editOrSend(bot, chatId, sentId,
        `✅ <b>Pairing Code</b>\n${DIV}\n\n` +
        `📱 <b>Number:</b> <code>+${esc(phone)}</code>\n\n` +
        `🔑 <b>Code:</b>\n<code>${esc(existing)}</code>\n\n` +
        `<b>Steps:</b>\n` +
        `1️⃣ Open WhatsApp → Settings → Linked Devices\n` +
        `2️⃣ Tap <b>Link a Device</b> → <b>Link with phone number</b>\n` +
        `3️⃣ Enter the code above\n\n` +
        `⏰ <i>If expired, tap Pair again.</i>` + FOOTER,
        { reply_markup: KB_BACK }
      );
    }

    // Register waiter then create session
    if (!_pairingWaiters.has(sessionId)) _pairingWaiters.set(sessionId, new Set());
    _pairingWaiters.get(sessionId).add(chatId);

    await _createSession(sessionId, phone);
    await new Promise(r => setTimeout(r, 4000));

    const code = _latestCodes?.get(sessionId);
    if (code && _pairingWaiters.has(sessionId)) {
      _pairingWaiters.get(sessionId).delete(chatId);
      if (!_pairingWaiters.get(sessionId).size) _pairingWaiters.delete(sessionId);

      editOrSend(bot, chatId, sentId,
        `✅ <b>Pairing Code Ready!</b>\n${DIV}\n\n` +
        `📱 <b>Number:</b> <code>+${esc(phone)}</code>\n\n` +
        `🔑 <b>Code:</b>\n<code>${esc(code)}</code>\n\n` +
        `<b>Steps:</b>\n` +
        `1️⃣ Open WhatsApp → Settings → Linked Devices\n` +
        `2️⃣ Tap <b>Link a Device</b> → <b>Link with phone number</b>\n` +
        `3️⃣ Enter the code above\n\n` +
        `⏰ <i>Expires in ~60 seconds — enter it quickly!</i>\n` +
        `<i>You will get a confirmation here when connected.</i>` + FOOTER,
        { reply_markup: KB_BACK }
      );
    } else {
      editOrSend(bot, chatId, sentId,
        `⏳ <b>Waiting for pairing code...</b>\n\n` +
        `📱 Number: <code>+${esc(phone)}</code>\n\n` +
        `<i>The code will appear here automatically (usually 10–30 seconds).\nDo not close this chat.</i>` + FOOTER,
        { reply_markup: KB_BACK }
      );
    }
  } catch (e) {
    const sid = `tg_${phone}`;
    _pairingWaiters.get(sid)?.delete(chatId);
    _pairingChats.delete(sid);
    editOrSend(bot, chatId, sentId,
      `❌ <b>Pairing Failed</b>\n\n<i>${esc(e.message)}</i>\n\n` +
      `💡 Check the number format and try again.` + FOOTER,
      { reply_markup: KB_BACK }
    );
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
export function initTelegramAdmin({ createSession, getAllSessions, latestPairingCodes, botEvents }) {
  if (!TOKEN) {
    logger.warn('⚡ TELEGRAM_BOT_TOKEN not set — Telegram admin bot disabled');
    return;
  }

  _createSession = createSession;
  _latestCodes   = latestPairingCodes;
  _botEvents     = botEvents;

  const bot = new TelegramBot(TOKEN, { polling: true });

  // ── Forward pairing codes from bot events ─────────────────────────────────
  botEvents.on('pairingCode', ({ sessionId, code }) => {
    const waiters = _pairingWaiters.get(sessionId);
    if (!waiters?.size) return;
    for (const chatId of waiters) {
      bot.sendMessage(chatId,
        `✅ <b>Pairing Code Ready!</b>\n${DIV}\n\n` +
        `📱 Number: <code>+${esc(sessionId.replace('tg_', ''))}</code>\n\n` +
        `🔑 Your Code:\n<code>${esc(code)}</code>\n\n` +
        `<b>Steps:</b>\n` +
        `1️⃣ Open WhatsApp → Settings → Linked Devices\n` +
        `2️⃣ Tap <b>Link a Device</b> → <b>Link with phone number</b>\n` +
        `3️⃣ Enter the code above\n\n` +
        `⏰ <i>Expires in ~60 seconds — enter it quickly!</i>` + FOOTER,
        HTML
      ).catch(() => {});
    }
    _pairingWaiters.delete(sessionId);
  });

  // ── Connection confirmed ──────────────────────────────────────────────────
  botEvents.on('status', ({ sessionId, status, user }) => {
    if (status !== 'connected') return;
    const chatId = _pairingChats.get(sessionId);
    if (!chatId) return;
    _pairingChats.delete(sessionId);

    const phone = sessionId.replace('tg_', '');
    const name  = user?.name || user?.notify || user?.verifiedName || '';
    bot.sendMessage(chatId,
      `🎉 <b>WhatsApp Connected!</b>\n${DIV}\n\n` +
      `📱 Number: <code>+${esc(phone)}</code>\n` +
      (name ? `👤 Name: <b>${esc(name)}</b>\n` : '') +
      `🟢 Status: <b>Active &amp; Running</b>\n\n` +
      `Your bot is now live on WhatsApp!` + FOOTER,
      HTML
    ).catch(() => {});
  });

  // ── Guard: reject everyone except the owner ───────────────────────────────
  function guard(fn) {
    return async (msg, ...rest) => {
      if (!isOwner(msg.chat.id)) {
        return sendText(bot, msg.chat.id,
          `🔒 <b>Private Bot</b>\n\n<i>This bot is restricted to authorized users only.</i>`
        );
      }
      return fn(msg, ...rest);
    };
  }

  // ── /start ────────────────────────────────────────────────────────────────
  bot.onText(/\/start/, guard((msg) => {
    sendText(bot, msg.chat.id,
      `🤖 <b>AA MD Bot — Pairing Panel</b>\n${DIV}\n\n` +
      `👋 Welcome, <b>AA Mods</b>!\n\n` +
      `Tap the button below to get your WhatsApp pairing code.` + FOOTER,
      { reply_markup: KB_HOME }
    );
  }));

  // ── /pair [phone] ─────────────────────────────────────────────────────────
  bot.onText(/\/pair(?:\s+(\S+))?/, guard(async (msg, match) => {
    const chatId = msg.chat.id;
    const raw    = (match[1] || '').replace(/[^0-9]/g, '');

    if (raw && raw.length >= 7 && raw.length <= 15) {
      _awaitingPhone.delete(chatId);
      return doPair(bot, chatId, raw);
    }

    // Ask for number interactively
    const sent = await bot.sendMessage(chatId,
      `📱 <b>Enter Your WhatsApp Number</b>\n${DIV}\n\n` +
      `Send your number with country code (digits only):\n\n` +
      `• 🇵🇰 Pakistan: <code>923001234567</code>\n` +
      `• 🇸🇦 Saudi: <code>9665XXXXXXXX</code>\n` +
      `• 🇦🇪 UAE: <code>971XXXXXXXXX</code>\n` +
      `• 🇬🇧 UK: <code>447XXXXXXXXX</code>\n` +
      `• 🇺🇸 USA: <code>1XXXXXXXXXX</code>\n\n` +
      `<i>No + sign, no spaces.</i>` + FOOTER,
      { ...HTML, reply_markup: { force_reply: true, selective: true } }
    ).catch(() => null);

    if (sent) _awaitingPhone.set(chatId, { msgId: sent.message_id });
  }));

  // ── Inline callback handler ───────────────────────────────────────────────
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const msgId  = query.message.message_id;
    await bot.answerCallbackQuery(query.id).catch(() => {});

    if (!isOwner(chatId)) {
      return bot.answerCallbackQuery(query.id, { text: '🔒 Private bot', show_alert: true }).catch(() => {});
    }

    switch (query.data) {
      case 'home':
        editOrSend(bot, chatId, msgId,
          `🤖 <b>AA MD Bot — Pairing Panel</b>\n${DIV}\n\n` +
          `Tap the button below to get your WhatsApp pairing code.` + FOOTER,
          { reply_markup: KB_HOME }
        );
        break;

      case 'do_pair':
        // Ask for phone number
        editOrSend(bot, chatId, msgId,
          `📱 <b>Enter Your WhatsApp Number</b>\n${DIV}\n\n` +
          `Reply with your number (country code, digits only):\n\n` +
          `• 🇵🇰 Pakistan: <code>923001234567</code>\n` +
          `• 🇸🇦 Saudi: <code>9665XXXXXXXX</code>\n` +
          `• 🇦🇪 UAE: <code>971XXXXXXXXX</code>\n\n` +
          `<i>No + sign, no spaces.</i>` + FOOTER,
          { reply_markup: KB_BACK }
        );
        _awaitingPhone.set(chatId, { msgId });
        break;
    }
  });

  // ── Catch-all: awaiting phone number + reject unknown commands ─────────────
  bot.on('message', guard(async (msg) => {
    const chatId = msg.chat.id;
    const text   = (msg.text || '').trim();

    // Handle phone number reply from interactive flow
    if (_awaitingPhone.has(chatId) && text && !text.startsWith('/')) {
      const { msgId } = _awaitingPhone.get(chatId);
      _awaitingPhone.delete(chatId);

      const phone = text.replace(/[^0-9]/g, '');
      if (!phone || phone.length < 7 || phone.length > 15) {
        return sendText(bot, chatId,
          `❌ Invalid number format.\n\nSend digits only with country code.\nExample: <code>923001234567</code>`,
          HTML
        );
      }
      return doPair(bot, chatId, phone, msgId);
    }

    // Ignore known commands (handled above)
    if (text.startsWith('/start') || text.startsWith('/pair')) return;

    // Prompt for any other input
    if (text.startsWith('/')) {
      sendText(bot, chatId,
        `📱 <b>Pairing Bot</b>\n\n` +
        `This bot only provides WhatsApp pairing codes.\n\n` +
        `Use /pair to get started.` + FOOTER,
        { reply_markup: KB_HOME }
      );
    }
  }));

  bot.on('polling_error', (err) => {
    logger.warn({ code: err.code, msg: err.message }, '🤖 Telegram admin polling error');
  });

  logger.info('🤖 Telegram pairing bot started (owner-only mode)');
  return bot;
}
