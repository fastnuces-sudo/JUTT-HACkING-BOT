// ╔══════════════════════════════════════════════════════════════════╗
// ║   AA MD Bot — Telegram Admin / Pairing Bot                      ║
// ║   Token  : TELEGRAM_BOT_TOKEN                                   ║
// ║   Security: TELEGRAM_ADMIN_IDS  (comma-separated chat IDs)      ║
// ╚══════════════════════════════════════════════════════════════════╝

import TelegramBot from 'node-telegram-bot-api';
import fs          from 'fs-extra';
import path        from 'path';
import { fileURLToPath } from 'url';
import { logger }  from './logger.js';
import { db }      from './database.js';
import config      from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN     = process.env.TELEGRAM_BOT_TOKEN;
const HTML      = { parse_mode: 'HTML' };

// ── Admin whitelist (optional security layer) ────────────────────────────────
// Set TELEGRAM_ADMIN_IDS=123456789,987654321 in env to restrict all commands.
// Leave unset = anyone can use the bot (open access).
const ADMIN_IDS = (process.env.TELEGRAM_ADMIN_IDS || '')
  .split(',').map(s => s.trim()).filter(Boolean).map(Number);

function isAdmin(chatId) {
  if (!ADMIN_IDS.length) return true;          // open if not configured
  return ADMIN_IDS.includes(chatId);
}

// ── Style ────────────────────────────────────────────────────────────────────
const DIV    = '━━━━━━━━━━━━━━━━━━━━━━';
const LOGO   = `🤖 <b>AA MD Bot</b>  <i>v${config.version || '3.0.0'}</i>`;
const FOOTER = `\n${DIV}\n${LOGO}`;
const esc    = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function upStr(sec) {
  if (sec > 86400) return `${Math.floor(sec/86400)}d ${Math.floor((sec%86400)/3600)}h`;
  if (sec > 3600)  return `${Math.floor(sec/3600)}h ${Math.floor((sec%3600)/60)}m`;
  return `${Math.floor(sec/60)}m ${sec%60}s`;
}

function memStr() {
  const u = process.memoryUsage();
  return `${Math.round(u.heapUsed/1024/1024)}MB / ${Math.round(u.rss/1024/1024)}MB`;
}

// ── Send helpers ─────────────────────────────────────────────────────────────
const sendText = (bot, id, text, extra = {}) =>
  bot.sendMessage(id, text, { parse_mode: 'HTML', ...extra }).catch(() => {});

async function editOrSend(bot, chatId, msgId, text, extra = {}) {
  try {
    return await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', ...extra });
  } catch {
    return bot.sendMessage(chatId, text, { parse_mode: 'HTML', ...extra }).catch(() => {});
  }
}

// ── Injected context ─────────────────────────────────────────────────────────
let _createSession   = null;
let _getAllSessions   = null;
let _latestCodes     = null;
let _botEvents       = null;
const _pairingWaiters = new Map();

// ── Inline keyboards ─────────────────────────────────────────────────────────
const KB_MAIN = {
  inline_keyboard: [
    [{ text: '📱 Pair Number',  callback_data: 'guide_pair'   },
     { text: '📊 Status',       callback_data: 'cmd_status'   }],
    [{ text: '📋 Sessions',     callback_data: 'cmd_sessions' },
     { text: '📈 System Stats', callback_data: 'cmd_stats'    }],
    [{ text: '📣 Broadcast',    callback_data: 'guide_bc'     },
     { text: '📜 Recent Logs',  callback_data: 'cmd_logs'     }],
    [{ text: '❓ Help',         callback_data: 'cmd_help'     }],
  ],
};

const KB_BACK = {
  inline_keyboard: [[{ text: '« Back to Menu', callback_data: 'cmd_menu' }]],
};

// ── Log tail helper ──────────────────────────────────────────────────────────
function tailLog(lines = 20) {
  try {
    const logsDir = path.join(__dirname, '..', 'logs');
    const files   = fs.readdirSync(logsDir)
      .filter(f => f.endsWith('.log'))
      .map(f => ({ f, t: fs.statSync(path.join(logsDir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    if (!files.length) return 'No log files found.';
    const content = fs.readFileSync(path.join(logsDir, files[0].f), 'utf8');
    const tail    = content.trim().split('\n').slice(-lines);
    return tail.map(line => {
      try { const o = JSON.parse(line); return `[${o.level}] ${o.msg || ''}`; }
      catch { return line; }
    }).join('\n');
  } catch {
    return 'Could not read logs.';
  }
}

export function initTelegramAdmin({ createSession, getAllSessions, latestPairingCodes, botEvents }) {
  if (!TOKEN) {
    logger.warn('⚡ TELEGRAM_BOT_TOKEN not set — Telegram admin bot disabled');
    return;
  }

  _createSession  = createSession;
  _getAllSessions  = getAllSessions;
  _latestCodes    = latestPairingCodes;
  _botEvents      = botEvents;

  const bot = new TelegramBot(TOKEN, { polling: true });

  // ── Forward pairing codes ──────────────────────────────────────────────────
  botEvents.on('pairingCode', ({ sessionId, code }) => {
    const waiters = _pairingWaiters.get(sessionId);
    if (!waiters?.size) return;
    for (const chatId of waiters) {
      bot.sendMessage(chatId,
        `✅ <b>Pairing Code Ready!</b>\n${DIV}\n\n` +
        `📱 Phone: <code>+${esc(sessionId.replace('tg_',''))}</code>\n\n` +
        `🔑 Your Code:\n<code>${esc(code)}</code>\n\n` +
        `<b>Steps:</b>\n` +
        `1️⃣ Open WhatsApp on your phone\n` +
        `2️⃣ Go to Settings → Linked Devices\n` +
        `3️⃣ Tap "Link a Device"\n` +
        `4️⃣ Tap "Link with phone number"\n` +
        `5️⃣ Enter the code above\n\n` +
        `⏰ <i>Expires in ~60 seconds — enter it quickly!</i>` +
        FOOTER,
        HTML
      ).catch(() => {});
    }
    _pairingWaiters.delete(sessionId);
  });

  // ── Guard middleware ───────────────────────────────────────────────────────
  function guard(fn) {
    return async (msg, ...rest) => {
      if (!isAdmin(msg.chat.id)) {
        return sendText(bot, msg.chat.id,
          `🔒 <b>Access Denied</b>\n\n<i>This bot is restricted to authorized users.</i>`
        );
      }
      return fn(msg, ...rest);
    };
  }

  // ── /start ──────────────────────────────────────────────────────────────────
  bot.onText(/\/start/, guard((msg) => {
    const name = esc(msg.from?.first_name || 'there');
    sendText(bot, msg.chat.id,
      `🤖 <b>AA MD Bot — Admin Panel</b>\n${DIV}\n\n` +
      `👋 Hello, <b>${name}</b>!\n\n` +
      `Manage your WhatsApp connections and monitor your bot from here.\n\n` +
      `Use the buttons below or type /help for all commands.`,
      { reply_markup: KB_MAIN }
    );
  }));

  // ── /menu ───────────────────────────────────────────────────────────────────
  bot.onText(/\/menu/, guard((msg) => {
    sendText(bot, msg.chat.id,
      `🤖 <b>AA MD Bot — Admin Panel</b>\n${DIV}\n\n` +
      `Choose an action below:`,
      { reply_markup: KB_MAIN }
    );
  }));

  // ── /help ───────────────────────────────────────────────────────────────────
  bot.onText(/\/help/, guard((msg) => {
    sendText(bot, msg.chat.id,
      `📋 <b>Admin Commands</b>\n${DIV}\n\n` +

      `📱 <b>WhatsApp Pairing</b>\n` +
      `/pair <code>&lt;phone&gt;</code> — Get pairing code\n` +
      `  <i>Example: /pair 923001234567</i>\n\n` +

      `📊 <b>Bot Info</b>\n` +
      `/status — Connected numbers & uptime\n` +
      `/sessions — Detailed session list\n` +
      `/stats — Full system statistics\n` +
      `/ping — Response time check\n\n` +

      `📣 <b>Messaging</b>\n` +
      `/broadcast <code>&lt;message&gt;</code> — Send to all connected numbers\n` +
      `  <i>Example: /broadcast Server restart in 5min</i>\n\n` +

      `🔧 <b>System</b>\n` +
      `/logs — Show recent log entries\n` +
      `/restart — Restart the bot process\n\n` +

      `💡 <b>Tips</b>\n` +
      `• Phone: include country code, no + or spaces\n` +
      `• Pakistan: <code>923XXXXXXXXX</code>\n` +
      `• Saudi: <code>9665XXXXXXXX</code>\n` +
      `• UAE: <code>971XXXXXXXXX</code>` +
      FOOTER,
      { reply_markup: KB_BACK }
    );
  }));

  // ── /ping ───────────────────────────────────────────────────────────────────
  bot.onText(/\/ping/, guard(async (msg) => {
    const t0   = Date.now();
    const sent = await bot.sendMessage(msg.chat.id, '🏓 <i>Pinging...</i>', HTML).catch(() => null);
    if (!sent) return;
    const ms = Date.now() - t0;
    editOrSend(bot, msg.chat.id, sent.message_id,
      `🏓 <b>Pong!</b>  <code>${ms}ms</code>\n${DIV}\n\n` +
      `⏱ Uptime: <b>${esc(upStr(Math.floor(process.uptime())))}</b>\n` +
      `💾 RAM: <b>${memStr()}</b>\n` +
      `📦 Node: <b>${esc(process.version)}</b>` +
      FOOTER
    );
  }));

  // ── /status ─────────────────────────────────────────────────────────────────
  bot.onText(/\/status/, guard(async (msg) => {
    const chatId = msg.chat.id;
    const sent   = await bot.sendMessage(chatId, '📊 <b>Fetching status...</b>', HTML).catch(() => null);
    if (!sent) return;

    try {
      const sessions = _getAllSessions ? _getAllSessions() : [];
      const mem      = process.memoryUsage();

      let text =
        `📊 <b>Bot Status</b>\n${DIV}\n\n` +
        `🟢 <b>Status:</b> Online\n` +
        `⏱ <b>Uptime:</b> ${esc(upStr(Math.floor(process.uptime())))}\n` +
        `💾 <b>Heap:</b> ${Math.round(mem.heapUsed/1024/1024)}MB / ${Math.round(mem.heapTotal/1024/1024)}MB\n` +
        `🖥 <b>RSS:</b> ${Math.round(mem.rss/1024/1024)}MB\n` +
        `📦 <b>Node:</b> ${esc(process.version)}\n\n`;

      if (!sessions.length) {
        text += `📱 <b>WhatsApp:</b> No sessions connected\n\n<i>Use /pair to connect a number.</i>`;
      } else {
        text += `📱 <b>Connected (${sessions.length}):</b>\n`;
        for (const s of sessions) {
          const num  = s.jid?.split('@')[0]?.split(':')[0] || s.id || '?';
          const name = s.pushName ? ` — ${esc(s.pushName)}` : '';
          text += `  • <code>+${esc(num)}</code>${name}\n`;
        }
      }

      text += FOOTER;
      editOrSend(bot, chatId, sent.message_id, text, { reply_markup: KB_BACK });
    } catch (e) {
      editOrSend(bot, chatId, sent.message_id, `❌ Failed: ${esc(e.message)}`);
    }
  }));

  // ── /sessions ───────────────────────────────────────────────────────────────
  bot.onText(/\/sessions/, guard(async (msg) => {
    const sessions = _getAllSessions ? _getAllSessions() : [];
    if (!sessions.length) {
      return sendText(bot, msg.chat.id,
        `📱 <b>No Active Sessions</b>\n\n<i>Use /pair to connect a WhatsApp number.</i>`,
        { reply_markup: KB_BACK }
      );
    }

    let text = `📱 <b>Active Sessions (${sessions.length})</b>\n${DIV}\n\n`;
    for (let i = 0; i < sessions.length; i++) {
      const s   = sessions[i];
      const num = s.jid?.split('@')[0]?.split(':')[0] || s.id || '?';
      text +=
        `<b>${i+1}.</b> <code>+${esc(num)}</code>\n` +
        `   👤 ${esc(s.pushName || 'Unknown')}\n` +
        `   🔌 ${s.connected !== false ? '🟢 Connected' : '🔴 Disconnected'}\n\n`;
    }
    text += FOOTER;
    sendText(bot, msg.chat.id, text, { reply_markup: KB_BACK });
  }));

  // ── /stats ──────────────────────────────────────────────────────────────────
  bot.onText(/\/stats/, guard(async (msg) => {
    const chatId = msg.chat.id;
    const sent   = await bot.sendMessage(chatId, '📈 <b>Gathering stats...</b>', HTML).catch(() => null);
    if (!sent) return;

    try {
      const sessions = _getAllSessions ? _getAllSessions() : [];
      const mem      = process.memoryUsage();
      const cpu      = process.cpuUsage();
      const upSec    = Math.floor(process.uptime());

      // Count DB entries
      let userCount = 0, groupCount = 0;
      try {
        const users  = db.get('users')  || {};
        const groups = db.get('groups') || {};
        userCount  = Object.keys(users).length;
        groupCount = Object.keys(groups).length;
      } catch {}

      const text =
        `📈 <b>System Statistics</b>\n${DIV}\n\n` +

        `🤖 <b>Bot</b>\n` +
        `  Version: v${esc(config.version || '3.0.0')}\n` +
        `  Uptime: ${esc(upStr(upSec))}\n` +
        `  Sessions: ${sessions.length} connected\n\n` +

        `💾 <b>Memory</b>\n` +
        `  Heap used: ${Math.round(mem.heapUsed/1024/1024)}MB\n` +
        `  Heap total: ${Math.round(mem.heapTotal/1024/1024)}MB\n` +
        `  RSS: ${Math.round(mem.rss/1024/1024)}MB\n` +
        `  External: ${Math.round(mem.external/1024/1024)}MB\n\n` +

        `🖥 <b>Process</b>\n` +
        `  PID: ${process.pid}\n` +
        `  Node: ${esc(process.version)}\n` +
        `  Platform: ${esc(process.platform)}\n` +
        `  CPU user: ${Math.round(cpu.user/1000)}ms\n\n` +

        `📦 <b>Database</b>\n` +
        `  Users: ${userCount}\n` +
        `  Groups: ${groupCount}\n` +
        FOOTER;

      editOrSend(bot, chatId, sent.message_id, text, { reply_markup: KB_BACK });
    } catch (e) {
      editOrSend(bot, chatId, sent.message_id, `❌ Failed: ${esc(e.message)}`);
    }
  }));

  // ── /logs ───────────────────────────────────────────────────────────────────
  bot.onText(/\/logs(?:\s+(\d+))?/, guard(async (msg, match) => {
    const lines = Math.min(parseInt(match[1] || '25', 10), 50);
    const tail  = tailLog(lines);
    const text  =
      `📜 <b>Recent Logs</b> (last ${lines} lines)\n${DIV}\n\n` +
      `<pre>${esc(tail.slice(-3500))}</pre>` +
      FOOTER;
    sendText(bot, msg.chat.id, text, { reply_markup: KB_BACK });
  }));

  // ── /broadcast ──────────────────────────────────────────────────────────────
  bot.onText(/\/broadcast(?:\s+(.+))?/s, guard(async (msg, match) => {
    const chatId = msg.chat.id;
    const text   = (match[1] || '').trim();

    if (!text) {
      return sendText(bot, chatId,
        `📣 <b>Broadcast Usage</b>\n\n` +
        `<code>/broadcast Your message here</code>\n\n` +
        `<i>Sends the message to all connected WhatsApp numbers (as the bot).</i>`
      );
    }

    const sessions = _getAllSessions ? _getAllSessions() : [];
    if (!sessions.length) {
      return sendText(bot, chatId, `❌ No connected sessions to broadcast to.`);
    }

    const sent = await bot.sendMessage(chatId,
      `📣 <b>Broadcasting to ${sessions.length} number(s)...</b>`, HTML
    ).catch(() => null);

    // Emit broadcast event for index.js to handle
    _botEvents.emit('telegramBroadcast', { text });

    editOrSend(bot, chatId, sent?.message_id || 0,
      `✅ <b>Broadcast sent</b>\n\n` +
      `📣 Delivered to <b>${sessions.length}</b> connected number(s).\n` +
      `📝 Message:\n<i>${esc(text.slice(0, 300))}</i>` +
      FOOTER
    );
  }));

  // ── /restart ────────────────────────────────────────────────────────────────
  bot.onText(/\/restart/, guard(async (msg) => {
    await sendText(bot, msg.chat.id,
      `🔄 <b>Restarting bot...</b>\n\n<i>The bot will be back online in a few seconds.</i>` + FOOTER
    );
    setTimeout(() => process.exit(0), 1500);
  }));

  // ── /pair <phone> ───────────────────────────────────────────────────────────
  bot.onText(/\/pair(?:\s+(\S+))?/, guard(async (msg, match) => {
    const chatId = msg.chat.id;
    const phone  = (match[1] || '').replace(/[^0-9]/g, '');

    if (!phone || phone.length < 7 || phone.length > 15) {
      return sendText(bot, chatId,
        `❌ <b>Invalid Phone Number</b>\n\n` +
        `<b>Usage:</b> <code>/pair 923001234567</code>\n\n` +
        `• Include country code, no spaces or +\n` +
        `• 🇵🇰 Pakistan: <code>923XXXXXXXXX</code>\n` +
        `• 🇸🇦 Saudi Arabia: <code>9665XXXXXXXX</code>\n` +
        `• 🇦🇪 UAE: <code>971XXXXXXXXX</code>\n` +
        `• 🇬🇧 UK: <code>447XXXXXXXXX</code>\n` +
        `• 🇺🇸 USA: <code>1XXXXXXXXXX</code>`
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
      if (!_createSession) throw new Error('Session manager not ready — restart the bot.');

      const sessionId = `tg_${phone}`;

      // Return existing code if fresh
      const existing = _latestCodes?.get(sessionId);
      if (existing) {
        return editOrSend(bot, chatId, sent.message_id,
          `✅ <b>Pairing Code</b>\n${DIV}\n\n` +
          `📱 Phone: <code>+${esc(phone)}</code>\n\n` +
          `🔑 <b>Code:</b>\n<code>${esc(existing)}</code>\n\n` +
          `<b>Steps:</b>\n` +
          `1️⃣ WhatsApp → Settings → Linked Devices\n` +
          `2️⃣ Tap "Link a Device" → "Link with phone number"\n` +
          `3️⃣ Enter the code above\n\n` +
          `⏰ <i>If expired, send /pair again</i>` +
          FOOTER
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

        editOrSend(bot, chatId, sent.message_id,
          `✅ <b>Pairing Code Ready!</b>\n${DIV}\n\n` +
          `📱 Phone: <code>+${esc(phone)}</code>\n\n` +
          `🔑 <b>Code:</b>\n<code>${esc(code)}</code>\n\n` +
          `<b>Steps:</b>\n` +
          `1️⃣ WhatsApp → Settings → Linked Devices\n` +
          `2️⃣ Tap "Link a Device" → "Link with phone number"\n` +
          `3️⃣ Enter the code above\n\n` +
          `⏰ <i>Expires in ~60 seconds — enter quickly!</i>` +
          FOOTER
        );
      } else {
        editOrSend(bot, chatId, sent.message_id,
          `⏳ <b>Waiting for pairing code...</b>\n\n` +
          `📱 Phone: <code>+${esc(phone)}</code>\n\n` +
          `<i>The code will appear here automatically (usually 10–30s).\nDo not close this chat.</i>` +
          FOOTER
        );
      }
    } catch (e) {
      const sid = `tg_${phone}`;
      _pairingWaiters.get(sid)?.delete(chatId);
      editOrSend(bot, chatId, sent.message_id,
        `❌ <b>Pairing Failed</b>\n\n` +
        `<i>${esc(e.message)}</i>\n\n` +
        `💡 Try again in a moment, or use the web dashboard.` +
        FOOTER
      );
    }
  }));

  // ── Inline keyboard callbacks ───────────────────────────────────────────────
  bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const msgId  = query.message.message_id;
    await bot.answerCallbackQuery(query.id).catch(() => {});

    if (!isAdmin(chatId)) {
      return bot.answerCallbackQuery(query.id, { text: '🔒 Access denied', show_alert: true }).catch(() => {});
    }

    switch (query.data) {

      case 'cmd_menu':
        editOrSend(bot, chatId, msgId,
          `🤖 <b>AA MD Bot — Admin Panel</b>\n${DIV}\n\nChoose an action:`,
          { reply_markup: KB_MAIN }
        );
        break;

      case 'cmd_help':
        editOrSend(bot, chatId, msgId,
          `📋 <b>Admin Commands</b>\n${DIV}\n\n` +
          `/pair <code>&lt;phone&gt;</code> — Pair a WhatsApp number\n` +
          `/status — Bot status & sessions\n` +
          `/sessions — Detailed session list\n` +
          `/stats — Full system statistics\n` +
          `/broadcast <code>&lt;msg&gt;</code> — Send to all numbers\n` +
          `/logs — Recent log entries\n` +
          `/restart — Restart the bot\n` +
          `/ping — Response time\n` + FOOTER,
          { reply_markup: KB_BACK }
        );
        break;

      case 'guide_pair':
        editOrSend(bot, chatId, msgId,
          `📱 <b>How to Pair a Number</b>\n${DIV}\n\n` +
          `Send: <code>/pair PHONENUMBER</code>\n\n` +
          `<b>Example:</b>\n<code>/pair 923001234567</code>\n\n` +
          `<b>Format rules:</b>\n` +
          `• Include country code\n` +
          `• No + sign, no spaces\n` +
          `• 🇵🇰 Pakistan: 92 + 10 digits\n` +
          `• 🇸🇦 Saudi: 966 + 9 digits\n` +
          `• 🇦🇪 UAE: 971 + 9 digits` + FOOTER,
          { reply_markup: KB_BACK }
        );
        break;

      case 'guide_bc':
        editOrSend(bot, chatId, msgId,
          `📣 <b>Broadcast Guide</b>\n${DIV}\n\n` +
          `Send: <code>/broadcast Your message here</code>\n\n` +
          `The message will be sent to <b>all connected WhatsApp numbers</b>.\n\n` +
          `<i>Useful for announcing maintenance, updates, or alerts.</i>` + FOOTER,
          { reply_markup: KB_BACK }
        );
        break;

      case 'cmd_status': {
        const sessions = _getAllSessions ? _getAllSessions() : [];
        let text =
          `📊 <b>Bot Status</b>\n${DIV}\n\n` +
          `🟢 Status: <b>Online</b>\n` +
          `⏱ Uptime: <b>${esc(upStr(Math.floor(process.uptime())))}</b>\n` +
          `💾 RAM: <b>${memStr()}</b>\n\n`;
        if (!sessions.length) {
          text += `📱 No sessions connected.\n<i>Use /pair to add one.</i>`;
        } else {
          text += `📱 <b>Sessions (${sessions.length}):</b>\n`;
          for (const s of sessions) {
            const num = s.jid?.split('@')[0]?.split(':')[0] || s.id || '?';
            text += `  • <code>+${esc(num)}</code>${s.pushName ? ` — ${esc(s.pushName)}` : ''}\n`;
          }
        }
        editOrSend(bot, chatId, msgId, text + FOOTER, { reply_markup: KB_BACK });
        break;
      }

      case 'cmd_sessions': {
        const sessions = _getAllSessions ? _getAllSessions() : [];
        if (!sessions.length) {
          editOrSend(bot, chatId, msgId,
            `📱 <b>No Active Sessions</b>\n\n<i>Use /pair to connect a number.</i>` + FOOTER,
            { reply_markup: KB_BACK }
          );
          break;
        }
        let text = `📱 <b>Active Sessions (${sessions.length})</b>\n${DIV}\n\n`;
        for (let i = 0; i < sessions.length; i++) {
          const s   = sessions[i];
          const num = s.jid?.split('@')[0]?.split(':')[0] || s.id || '?';
          text += `<b>${i+1}.</b> <code>+${esc(num)}</code>\n   👤 ${esc(s.pushName || 'Unknown')}\n   ${s.connected !== false ? '🟢 Connected' : '🔴 Disconnected'}\n\n`;
        }
        editOrSend(bot, chatId, msgId, text + FOOTER, { reply_markup: KB_BACK });
        break;
      }

      case 'cmd_stats': {
        const mem = process.memoryUsage();
        let userCount = 0, groupCount = 0;
        try {
          userCount  = Object.keys(db.get('users')  || {}).length;
          groupCount = Object.keys(db.get('groups') || {}).length;
        } catch {}
        const text =
          `📈 <b>System Statistics</b>\n${DIV}\n\n` +
          `🤖 Version: v${esc(config.version || '3.0.0')}\n` +
          `⏱ Uptime: ${esc(upStr(Math.floor(process.uptime())))}\n\n` +
          `💾 Heap: ${Math.round(mem.heapUsed/1024/1024)}MB / ${Math.round(mem.heapTotal/1024/1024)}MB\n` +
          `🖥 RSS: ${Math.round(mem.rss/1024/1024)}MB\n` +
          `📦 Node: ${esc(process.version)}\n\n` +
          `👥 Users in DB: ${userCount}\n` +
          `👥 Groups in DB: ${groupCount}\n` + FOOTER;
        editOrSend(bot, chatId, msgId, text, { reply_markup: KB_BACK });
        break;
      }

      case 'cmd_logs': {
        const tail = tailLog(20);
        editOrSend(bot, chatId, msgId,
          `📜 <b>Recent Logs</b>\n${DIV}\n\n<pre>${esc(tail.slice(-3000))}</pre>` + FOOTER,
          { reply_markup: KB_BACK }
        );
        break;
      }
    }
  });

  // ── Catch-all unknown commands ─────────────────────────────────────────────
  const KNOWN = /^\/(start|menu|help|pair|status|sessions|stats|logs|broadcast|restart|ping)/;
  bot.on('message', guard((msg) => {
    if (msg.text?.startsWith('/') && !KNOWN.test(msg.text)) {
      sendText(bot, msg.chat.id,
        `❓ Unknown command.\n\nType /help to see available commands.`,
        { reply_markup: KB_BACK }
      );
    }
  }));

  bot.on('polling_error', (err) => {
    logger.warn({ code: err.code, msg: err.message }, '📱 Telegram admin polling error');
  });

  logger.info('📱 Telegram admin bot started (pairing + management)');
  return bot;
}
