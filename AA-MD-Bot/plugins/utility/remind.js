// ============================================
// AA MD Bot - Personal Reminder
// Developer: Ahsan Ali | AA Mods
// ✅ MongoDB persistent — survives restarts
// ✅ Alarm voice note — rings on phone
// .remind 10m Take medication
// ============================================

import { execFile } from 'child_process';
import { promisify } from 'util';
import { randomBytes } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { db } from '../../lib/database.js';
import { sessions as _globalSessions } from '../../lib/sessionManager.js';

const execFileAsync = promisify(execFile);

// ── In-memory map of active timers (rebuilt on restart from MongoDB) ──────────
// id → { timer, fireAt, jid, senderJid, text, sessionId }
const activeTimers = new Map();

// ── Generate alarm voice note (OGG/Opus via ffmpeg) ──────────────────────────
// Sounds like a phone ringing: rising-pitch double-beep pattern × 4 bursts (~4s)
async function generateAlarm() {
  const out = path.join(os.tmpdir(), `alarm_${randomBytes(6).toString('hex')}.ogg`);
  // Pattern: 880Hz beep (0.25s) + 1100Hz beep (0.25s) + 0.4s silence, × 4
  const parts = [];
  const concat = [];
  let idx = 0;
  for (let burst = 0; burst < 4; burst++) {
    parts.push(`sine=frequency=880:duration=0.25[b${idx}]`);
    concat.push(`[b${idx}]`);
    idx++;
    parts.push(`sine=frequency=1100:duration=0.25[b${idx}]`);
    concat.push(`[b${idx}]`);
    idx++;
    parts.push(`aevalsrc=0:duration=0.4[s${burst}]`);
    concat.push(`[s${burst}]`);
  }
  const filter = parts.join(';') + ';' + concat.join('') + `concat=n=${idx + 4}:v=0:a=1[out]`;
  await execFileAsync('ffmpeg', [
    '-y',
    '-filter_complex', filter,
    '-map', '[out]',
    '-c:a', 'libopus',
    '-b:a', '32k',
    out,
  ]);
  const buf = fs.readFileSync(out);
  fs.unlink(out, () => {});
  return buf;
}

// ── Fire a reminder ───────────────────────────────────────────────────────────
async function fireReminder(id, job, getSessions) {
  activeTimers.delete(id);
  db.reminders.delete(id);

  try {
    // Get the socket for this session
    const sessions = getSessions();
    const sock = sessions instanceof Map ? sessions.get(job.sessionId) : sessions[job.sessionId];
    if (!sock) return;

    // 1. Send alarm voice note (rings even on silent via WhatsApp)
    try {
      const alarmBuf = await generateAlarm();
      await sock.sendMessage(job.jid, {
        audio: alarmBuf,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true,
      });
    } catch (e) {
      // Alarm failed — still send text
      console.error('[Remind] alarm audio failed:', e.message);
    }

    // 2. Send text reminder with mention
    await sock.sendMessage(job.jid, {
      text:
        `🔔 *REMINDER!* *(#${id})*\n\n` +
        `@${job.senderJid.split('@')[0]}\n\n` +
        `📌 *${job.text}*\n\n` +
        `> ⏰ *AA MD Bot — Reminder*`,
      mentions: [job.senderJid],
    });
  } catch (e) {
    console.error(`[Remind] fire failed (#${id}):`, e.message);
  }
}

// ── Schedule a single reminder (in-memory timer) ──────────────────────────────
function scheduleTimer(id, job, getSessions) {
  const delay = Math.max(0, job.fireAt - Date.now());
  const timer = setTimeout(() => fireReminder(id, job, getSessions), delay);
  activeTimers.set(id, timer);
}

// ── Restore reminders from MongoDB on startup ─────────────────────────────────
export function restoreReminders(getSessions) {
  const all = db.reminders.all();
  let restored = 0;
  for (const [id, job] of Object.entries(all)) {
    if (!job || job.fireAt <= Date.now()) {
      // Already overdue — fire immediately (small delay so sessions are ready)
      db.reminders.delete(id);
      setTimeout(() => fireReminder(id, job, getSessions), 3000);
    } else {
      scheduleTimer(id, job, getSessions);
      restored++;
    }
  }
  if (restored > 0) console.log(`[Remind] ✅ Restored ${restored} reminder(s) from MongoDB`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseDelay(str) {
  const s = (str || '').trim().toLowerCase();
  const m = s.match(/^(\d+)\s*(s|sec|m|min|h|hr|hour|d|day)s?$/);
  if (!m) return null;
  const n = parseInt(m[1]);
  const u = m[2][0];
  if (u === 's') return n * 1000;
  if (u === 'm') return n * 60 * 1000;
  if (u === 'h') return n * 3600 * 1000;
  if (u === 'd') return n * 86400 * 1000;
  return null;
}

function fmtMs(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

// ── Plugin ────────────────────────────────────────────────────────────────────
export default {
  command: 'remind',
  alias: ['reminder', 'remindme', 'yaad'],
  description: 'Set a reminder — bot will send alarm + message at the set time',
  category: 'utility',
  usage: '.remind <time> <message>   e.g.  .remind 10m Take medication',

  async execute({ sock, jid, msg, reply, args, senderJid }) {
    const sub = (args[0] || '').toLowerCase();

    // ── .remind list ────────────────────────────────────────────────────────
    if (sub === 'list') {
      const all  = db.reminders.all();
      const mine = Object.entries(all).filter(([, j]) => j?.senderJid === senderJid);
      if (!mine.length) return reply(
        `🔔 *No active reminders.*\n\nSet one:\n*.remind 10m Take medication*\n\n> 🤖 *AA MD Bot*`
      );
      let txt = `🔔 *Your Reminders (${mine.length})*\n\n`;
      for (const [id, j] of mine) {
        const left = Math.max(0, j.fireAt - Date.now());
        txt += `▸ *#${id}* — in *${fmtMs(left)}*\n  _"${j.text.slice(0, 50)}"_\n\n`;
      }
      txt += `Cancel: *.remind cancel <id>*\n\n> 🤖 *AA MD Bot*`;
      return reply(txt);
    }

    // ── .remind cancel <id> ─────────────────────────────────────────────────
    if (sub === 'cancel') {
      const id  = args[1];
      const job = db.reminders.get(id);
      if (!job) return reply(`❌ Reminder *#${args[1]}* not found.\n\n*.remind list* — see yours\n\n> 🤖 *AA MD Bot*`);
      if (job.senderJid !== senderJid) return reply(`❌ This is not your reminder.\n\n> 🤖 *AA MD Bot*`);
      const timer = activeTimers.get(id);
      if (timer) clearTimeout(timer);
      activeTimers.delete(id);
      db.reminders.delete(id);
      return reply(`✅ *Reminder #${id} cancelled.*\n_"${job.text.slice(0, 50)}"_\n\n> 🤖 *AA MD Bot*`);
    }

    // ── .remind (no args) — help ─────────────────────────────────────────────
    if (args.length < 2) {
      return reply(
        `🔔 *Personal Reminder*\n\n` +
        `Bot will send an *alarm 🔔 + message* at the set time!\n` +
        `Reminders are saved — survive bot restarts.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `▸ *.remind 30s Message*         — 30 seconds\n` +
        `▸ *.remind 10m Take medication* — 10 minutes\n` +
        `▸ *.remind 2h Meeting at 3pm*   — 2 hours\n` +
        `▸ *.remind 1d Submit report*    — 1 day\n\n` +
        `▸ *.remind list*                — active reminders\n` +
        `▸ *.remind cancel <id>*         — cancel one\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    // ── Parse delay + message ────────────────────────────────────────────────
    const delayMs = parseDelay(args[0]);
    if (!delayMs) return reply(
      `❌ *Invalid time format.*\n\nValid: *30s*, *10m*, *2h*, *1d*\nExample: *.remind 10m Take medication*\n\n> 🤖 *AA MD Bot*`
    );
    if (delayMs < 5000)                  return reply(`❌ Minimum time is *5 seconds*.\n\n> 🤖 *AA MD Bot*`);
    if (delayMs > 7 * 24 * 3600 * 1000) return reply(`❌ Maximum time is *7 days*.\n\n> 🤖 *AA MD Bot*`);

    const text = args.slice(1).join(' ').trim();
    if (!text) return reply(`❌ Please include a reminder message.\nExample: *.remind 10m Take medication*\n\n> 🤖 *AA MD Bot*`);

    // Generate unique ID
    const id     = `r${Date.now()}${randomBytes(2).toString('hex')}`;
    const fireAt = Date.now() + delayMs;

    const job = {
      id, text, fireAt, jid, senderJid,
      sessionId: sock.sessionId || 'default',
      createdAt: Date.now(),
    };

    // Save to MongoDB (persists across restarts)
    db.reminders.set(id, job);

    // Use the live sessions Map so reconnects don't break delivery
    scheduleTimer(id, job, () => _globalSessions);

    return reply(
      `✅ *Reminder Set! (#${id.slice(-6)})*\n\n` +
      `⏱️ In: *${fmtMs(delayMs)}*\n` +
      `📌 Message: _"${text.slice(0, 60)}"_\n` +
      `🔔 Bot will send alarm + message\n\n` +
      `Cancel: *.remind cancel ${id}*\n\n> 🤖 *AA MD Bot*`
    );
  },
};
