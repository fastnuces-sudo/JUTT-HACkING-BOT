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

const execFileAsync = promisify(execFile);

// ── In-memory timer handles (rebuilt from MongoDB on restart) ─
const activeTimers = new Map();   // id → NodeJS.Timeout

// ── Generate 3-beep alarm voice note (OGG/Opus via ffmpeg) ───
async function generateAlarm() {
  const out = path.join(os.tmpdir(), `alarm_${randomBytes(6).toString('hex')}.ogg`);
  const filter =
    'sine=frequency=880:duration=0.3[b1];' +
    'aevalsrc=0:duration=0.15[s1];' +
    'sine=frequency=880:duration=0.3[b2];' +
    'aevalsrc=0:duration=0.15[s2];' +
    'sine=frequency=880:duration=0.3[b3];' +
    '[b1][s1][b2][s2][b3]concat=n=5:v=0:a=1[out]';
  await execFileAsync('ffmpeg', [
    '-y', '-filter_complex', filter,
    '-map', '[out]', '-c:a', 'libopus', '-b:a', '32k', out,
  ]);
  const buf = fs.readFileSync(out);
  fs.unlink(out, () => {});
  return buf;
}

// ── Fire a reminder ───────────────────────────────────────────
async function fireReminder(id, job, getSessions) {
  activeTimers.delete(id);
  db.reminders.delete(id);
  try {
    const sessMap = getSessions();
    const sock = (sessMap instanceof Map)
      ? sessMap.get(job.sessionId)
      : sessMap?.[job.sessionId];
    if (!sock) return;

    // 1. Alarm voice note (rings phone even on vibrate-only)
    try {
      const alarmBuf = await generateAlarm();
      await sock.sendMessage(job.jid, {
        audio: alarmBuf,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: true,
      });
    } catch (e) {
      console.error('[Remind] alarm audio failed:', e.message);
    }

    // 2. Text reminder with @mention
    await sock.sendMessage(job.jid, {
      text:
        `🔔 *REMINDER!* *(#${id.slice(-6)})*\n\n` +
        `@${job.senderJid.split('@')[0]}\n\n` +
        `📌 *${job.text}*\n\n` +
        `> ⏰ *AA MD Bot — Reminder*`,
      mentions: [job.senderJid],
    });
  } catch (e) {
    console.error(`[Remind] fire failed (${id}):`, e.message);
  }
}

// ── Schedule in-memory timer ──────────────────────────────────
function scheduleTimer(id, job, getSessions) {
  const delay = Math.max(0, job.fireAt - Date.now());
  const t = setTimeout(() => fireReminder(id, job, getSessions), delay);
  activeTimers.set(id, t);
}

// ── Restore reminders from MongoDB after bot restart ─────────
export function restoreReminders(getSessions) {
  const all = db.reminders.all();
  const ids = Object.keys(all);
  if (!ids.length) return;
  let restored = 0;
  for (const id of ids) {
    const job = all[id];
    if (!job) continue;
    if (job.fireAt <= Date.now()) {
      // Overdue — fire after 5s so sessions are fully ready
      db.reminders.delete(id);
      setTimeout(() => fireReminder(id, job, getSessions), 5000);
    } else {
      scheduleTimer(id, job, getSessions);
      restored++;
    }
  }
  if (restored > 0)
    console.log(`[Remind] ✅ Restored ${restored} pending reminder(s) from MongoDB`);
}

// ── Helpers ───────────────────────────────────────────────────
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

// ── Plugin export ─────────────────────────────────────────────
export default {
  command: 'remind',
  alias: ['reminder', 'remindme', 'yaad'],
  description: 'Reminder set karo — bot alarm + message bhejega',
  category: 'utility',
  usage: '.remind <time> <message>   e.g.  .remind 10m Take medication',

  async execute({ sock, jid, reply, args, senderJid }) {
    const sub = (args[0] || '').toLowerCase();

    // ── .remind list ─────────────────────────────────────────
    if (sub === 'list') {
      const all  = db.reminders.all();
      const mine = Object.entries(all).filter(([, j]) => j?.senderJid === senderJid);
      if (!mine.length) return reply(
        `🔔 *Koi active reminder nahi.*\n\nSet karo:\n*.remind 10m Take medication*\n\n> 🤖 *AA MD Bot*`
      );
      let txt = `🔔 *Tumhare Reminders (${mine.length})*\n\n`;
      for (const [id, j] of mine) {
        const left = Math.max(0, j.fireAt - Date.now());
        txt += `▸ *#${id.slice(-6)}* — in *${fmtMs(left)}*\n  _"${j.text.slice(0, 50)}"_\n\n`;
      }
      txt += `Cancel karne ke liye: *.remind cancel <id>*\n\n> 🤖 *AA MD Bot*`;
      return reply(txt);
    }

    // ── .remind cancel <id> ──────────────────────────────────
    if (sub === 'cancel') {
      const partial = args[1];
      // Support both full ID and last-6-char short ID
      const all = db.reminders.all();
      const entry = Object.entries(all).find(
        ([id, j]) => j?.senderJid === senderJid && (id === partial || id.endsWith(partial))
      );
      if (!entry) return reply(`❌ Reminder *#${partial}* nahi mila.\n\n*.remind list* — apne reminders dekho\n\n> 🤖 *AA MD Bot*`);
      const [id, job] = entry;
      const t = activeTimers.get(id);
      if (t) clearTimeout(t);
      activeTimers.delete(id);
      db.reminders.delete(id);
      return reply(`✅ *Reminder cancel ho gaya.*\n_"${job.text.slice(0, 50)}"_\n\n> 🤖 *AA MD Bot*`);
    }

    // ── .remind help (no args) ───────────────────────────────
    if (args.length < 2) {
      return reply(
        `🔔 *Personal Reminder*\n\n` +
        `Bot alarm 🔔 + message bhejega set time par!\n` +
        `Reminders save hote hain — restart ke baad bhi kaam karte hain.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `▸ *.remind 30s Message*         — 30 seconds\n` +
        `▸ *.remind 10m Take medication* — 10 minutes\n` +
        `▸ *.remind 2h Meeting at 3pm*   — 2 hours\n` +
        `▸ *.remind 1d Submit report*    — 1 day\n\n` +
        `▸ *.remind list*                — active reminders\n` +
        `▸ *.remind cancel <id>*         — cancel karo\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    // ── Parse delay + message ────────────────────────────────
    const delayMs = parseDelay(args[0]);
    if (!delayMs) return reply(
      `❌ *Invalid time format.*\n\nSahi formats: *30s*, *10m*, *2h*, *1d*\nExample: *.remind 10m Take medication*\n\n> 🤖 *AA MD Bot*`
    );
    if (delayMs < 5000)                  return reply(`❌ Minimum time *5 seconds* hai.\n\n> 🤖 *AA MD Bot*`);
    if (delayMs > 7 * 24 * 3600 * 1000) return reply(`❌ Maximum time *7 days* hai.\n\n> 🤖 *AA MD Bot*`);

    const text = args.slice(1).join(' ').trim();
    if (!text) return reply(`❌ Reminder message bhi likho.\nExample: *.remind 10m Take medication*\n\n> 🤖 *AA MD Bot*`);

    const id     = `r${Date.now()}${randomBytes(2).toString('hex')}`;
    const fireAt = Date.now() + delayMs;

    const job = {
      id, text, fireAt, jid,
      senderJid,
      sessionId: sock.sessionId || 'default',
      createdAt: Date.now(),
    };

    // Persist to MongoDB
    db.reminders.set(id, job);

    // Schedule timer (sock is already the live connection)
    scheduleTimer(id, job, () => new Map([[job.sessionId, sock]]));

    return reply(
      `✅ *Reminder Set!*\n\n` +
      `⏱️ In: *${fmtMs(delayMs)}*\n` +
      `📌 Message: _"${text.slice(0, 60)}"_\n` +
      `🔔 Bot alarm + message bhejega\n\n` +
      `Cancel: *.remind cancel ${id.slice(-6)}*\n\n> 🤖 *AA MD Bot*`
    );
  },
};
