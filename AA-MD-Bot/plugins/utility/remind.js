// ============================================
// AA MD Bot - Personal Reminder
// Developer: Ahsan Ali | AA Mods
// .remind 10m Take medication
// ============================================

const reminderJobs = new Map();   // id → { timer, text, fireAt, jid, senderJid }
let remindCounter = 1;

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
  if (s < 3600) return `${Math.floor(s/60)}m ${s%60}s`;
  return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
}

export default {
  command: 'remind',
  alias: ['reminder', 'remindme', 'yaad'],
  description: 'Set a personal reminder — the bot will notify you at the set time',
  category: 'utility',
  usage: '.remind <time> <message>   e.g.  .remind 10m Take medication',

  async execute({ sock, jid, msg, reply, args, senderJid }) {

    const sub = (args[0] || '').toLowerCase();

    // ── .remind list ──────────────────────────────────────────────────────────
    if (sub === 'list') {
      const mine = [...reminderJobs.entries()].filter(([, j]) => j.senderJid === senderJid);
      if (!mine.length) return reply(
        `🔔 *No active reminders.*\n\n` +
        `Set one with: *.remind 10m Take medication*\n\n> 🤖 *AA MD Bot*`
      );
      let txt = `🔔 *Your Active Reminders (${mine.length})*\n\n`;
      for (const [id, j] of mine) {
        const left = Math.max(0, j.fireAt - Date.now());
        txt += `▸ *#${id}* — in *${fmtMs(left)}*\n  _"${j.text.slice(0, 50)}"_\n\n`;
      }
      txt += `To cancel: *.remind cancel <id>*\n\n> 🤖 *AA MD Bot*`;
      return reply(txt);
    }

    // ── .remind cancel <id> ───────────────────────────────────────────────────
    if (sub === 'cancel') {
      const id = parseInt(args[1]);
      const job = reminderJobs.get(id);
      if (!job) return reply(`❌ Reminder #${args[1]} not found.\n\nSee your reminders: *.remind list*\n\n> 🤖 *AA MD Bot*`);
      if (job.senderJid !== senderJid) return reply(`❌ This is not your reminder.\n\n> 🤖 *AA MD Bot*`);
      clearTimeout(job.timer);
      reminderJobs.delete(id);
      return reply(`✅ *Reminder #${id} cancelled.*\n_"${job.text.slice(0, 50)}"_\n\n> 🤖 *AA MD Bot*`);
    }

    // ── .remind (no args) — help ──────────────────────────────────────────────
    if (args.length < 2) {
      return reply(
        `🔔 *Personal Reminder*\n\n` +
        `The bot will remind you after the specified time!\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `▸ *.remind 30s Message*        — 30 seconds\n` +
        `▸ *.remind 10m Take medication* — 10 minutes\n` +
        `▸ *.remind 2h Meeting at 3pm*  — 2 hours\n` +
        `▸ *.remind 1d Submit report*   — 1 day\n\n` +
        `▸ *.remind list*               — view active reminders\n` +
        `▸ *.remind cancel <id>*        — cancel a reminder\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    // ── Parse delay + message ─────────────────────────────────────────────────
    const delayMs = parseDelay(args[0]);
    if (!delayMs) {
      return reply(
        `❌ *Invalid time format.*\n\n` +
        `Valid formats: *30s*, *10m*, *2h*, *1d*\n` +
        `Example: *.remind 10m Take medication*\n\n> 🤖 *AA MD Bot*`
      );
    }
    if (delayMs < 5000)                return reply(`❌ Minimum time is *5 seconds*.\n\n> 🤖 *AA MD Bot*`);
    if (delayMs > 7 * 24 * 3600 * 1000) return reply(`❌ Maximum time is *7 days*.\n\n> 🤖 *AA MD Bot*`);

    const text = args.slice(1).join(' ').trim();
    if (!text) return reply(`❌ Please include a reminder message.\nExample: *.remind 10m Take medication*\n\n> 🤖 *AA MD Bot*`);

    const jobId  = remindCounter++;
    const fireAt = Date.now() + delayMs;

    const timer = setTimeout(async () => {
      reminderJobs.delete(jobId);
      try {
        await sock.sendMessage(jid, {
          text:
            `🔔 *REMINDER!* *(#${jobId})*\n\n` +
            `@${senderJid.split('@')[0]}\n\n` +
            `📌 *${text}*\n\n` +
            `> ⏰ *AA MD Bot — Reminder System*`,
          mentions: [senderJid],
        }, { quoted: msg });
      } catch {}
    }, delayMs);

    reminderJobs.set(jobId, { timer, text, fireAt, jid, senderJid });

    return reply(
      `✅ *Reminder Set! (#${jobId})*\n\n` +
      `⏱️ In: *${fmtMs(delayMs)}*\n` +
      `📌 Message: _"${text.slice(0, 60)}"_\n\n` +
      `Cancel: *.remind cancel ${jobId}*\n\n> 🤖 *AA MD Bot*`
    );
  },
};
