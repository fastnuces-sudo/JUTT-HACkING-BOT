// ============================================
// AA MD Bot - Personal Reminder
// Developer: Ahsan Ali | AA Mods
// .remind 10m Namaz padhni hai
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
  description: 'Set a personal reminder — bot aapko time pe yaad dilayega',
  category: 'utility',
  usage: '.remind <time> <message>   e.g.  .remind 10m Namaz padhni hai',

  async execute({ sock, jid, msg, reply, args, senderJid }) {

    const sub = (args[0] || '').toLowerCase();

    // ── .remind list ──────────────────────────────────────────────────────────
    if (sub === 'list') {
      const mine = [...reminderJobs.entries()].filter(([, j]) => j.senderJid === senderJid);
      if (!mine.length) return reply(
        `🔔 *Koi active reminder nahi.*\n\n` +
        `Set karo: *.remind 10m Namaz padhni hai*\n\n> 🤖 *AA MD Bot*`
      );
      let txt = `🔔 *Tumhare Active Reminders (${mine.length})*\n\n`;
      for (const [id, j] of mine) {
        const left = Math.max(0, j.fireAt - Date.now());
        txt += `▸ *#${id}* — *${fmtMs(left)}* baad\n  _"${j.text.slice(0, 50)}"_\n\n`;
      }
      txt += `Cancel karne ke liye: *.remind cancel <id>*\n\n> 🤖 *AA MD Bot*`;
      return reply(txt);
    }

    // ── .remind cancel <id> ───────────────────────────────────────────────────
    if (sub === 'cancel') {
      const id = parseInt(args[1]);
      const job = reminderJobs.get(id);
      if (!job) return reply(`❌ Reminder #${args[1]} nahi mila.\n\nList ke liye: *.remind list*\n\n> 🤖 *AA MD Bot*`);
      if (job.senderJid !== senderJid) return reply(`❌ Yeh tumhara reminder nahi hai.\n\n> 🤖 *AA MD Bot*`);
      clearTimeout(job.timer);
      reminderJobs.delete(id);
      return reply(`✅ *Reminder #${id} cancel ho gaya.*\n_"${job.text.slice(0, 50)}"_\n\n> 🤖 *AA MD Bot*`);
    }

    // ── .remind (no args) — help ──────────────────────────────────────────────
    if (args.length < 2) {
      return reply(
        `🔔 *Personal Reminder*\n\n` +
        `Bot aapko set kiye gaye time ke baad remind karega!\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `▸ *.remind 30s Message*      — 30 seconds\n` +
        `▸ *.remind 10m Namaz padhni hai*  — 10 minutes\n` +
        `▸ *.remind 2h Meeting hai*   — 2 hours\n` +
        `▸ *.remind 1d Kaam karna hai* — 1 din\n\n` +
        `▸ *.remind list*             — active reminders\n` +
        `▸ *.remind cancel <id>*      — cancel karo\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    // ── Parse delay + message ─────────────────────────────────────────────────
    const delayMs = parseDelay(args[0]);
    if (!delayMs) {
      return reply(
        `❌ *Galat time format.*\n\n` +
        `Sahi format: *30s*, *10m*, *2h*, *1d*\n` +
        `Example: *.remind 10m Namaz padhni hai*\n\n> 🤖 *AA MD Bot*`
      );
    }
    if (delayMs < 5000)                return reply(`❌ Minimum time *5 seconds* hai.\n\n> 🤖 *AA MD Bot*`);
    if (delayMs > 7 * 24 * 3600 * 1000) return reply(`❌ Maximum time *7 din* hai.\n\n> 🤖 *AA MD Bot*`);

    const text = args.slice(1).join(' ').trim();
    if (!text) return reply(`❌ Reminder message bhi likhna hai.\nExample: *.remind 10m Namaz padhni hai*\n\n> 🤖 *AA MD Bot*`);

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
      `⏱️ Time: *${fmtMs(delayMs)}* baad\n` +
      `📌 Message: _"${text.slice(0, 60)}"_\n\n` +
      `Cancel: *.remind cancel ${jobId}*\n\n> 🤖 *AA MD Bot*`
    );
  },
};
