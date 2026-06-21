// ============================================
// AA MD Bot - Message Scheduler (GB Feature)
// Schedule a message to be sent after a delay
// ============================================

// In-memory job store (resets on bot restart)
const scheduledJobs = new Map();
let jobCounter = 1;

function parseDelay(str) {
  const match = str?.match(/^(\d+)(s|m|h)$/i);
  if (!match) return null;
  const n = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 's') return n * 1000;
  if (unit === 'm') return n * 60 * 1000;
  if (unit === 'h') return n * 3600 * 1000;
  return null;
}

export default {
  command: 'schedule',
  alias: ['sched', 'remind', 'later', 'sendlater'],
  category: 'gb',
  description: 'Schedule a message to be sent after a delay',
  usage: '.schedule <time> <message>  e.g.  .schedule 5m Hello!',

  async execute({ reply, args, sock, jid, msg, text, isOwner }) {
    // List scheduled jobs
    if (args[0]?.toLowerCase() === 'list') {
      if (!scheduledJobs.size) {
        return reply(`📅 *No scheduled messages.*\n\nUse *.schedule 5m Your message* to schedule one.`);
      }
      let list = `📅 *Scheduled Messages (${scheduledJobs.size})*\n\n`;
      for (const [id, job] of scheduledJobs) {
        const remaining = Math.max(0, Math.floor((job.fireAt - Date.now()) / 1000));
        const min = Math.floor(remaining / 60);
        const sec = remaining % 60;
        const timeLeft = min > 0 ? `${min}m ${sec}s` : `${sec}s`;
        list += `▸ *#${id}* — fires in *${timeLeft}*\n  _"${job.text.slice(0, 40)}"_\n\n`;
      }
      list += `Use *.schedule cancel <id>* to cancel.`;
      return reply(list);
    }

    // Cancel a job
    if (args[0]?.toLowerCase() === 'cancel') {
      const id = parseInt(args[1]);
      if (isNaN(id) || !scheduledJobs.has(id)) {
        return reply(`❌ Job #${args[1]} not found.\n\nUse *.schedule list* to see active jobs.`);
      }
      const job = scheduledJobs.get(id);
      clearTimeout(job.timer);
      scheduledJobs.delete(id);
      return reply(`✅ *Schedule #${id} cancelled.*\n\n_"${job.text.slice(0, 60)}"_`);
    }

    // Schedule a new message
    if (args.length < 2) {
      return reply(
        `📅 *Message Scheduler*\n\n` +
        `*GB WhatsApp Feature* — Send a message after a delay\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `▸ *.schedule 30s Hello!*     — after 30 seconds\n` +
        `▸ *.schedule 5m Good night*  — after 5 minutes\n` +
        `▸ *.schedule 2h reminder*    — after 2 hours\n\n` +
        `▸ *.schedule list*           — view pending\n` +
        `▸ *.schedule cancel <id>*    — cancel a job\n\n` +
        `📌 Message is sent to the *same chat* it was scheduled from.\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    }

    const delayStr = args[0];
    const messageText = args.slice(1).join(' ').trim();
    const delayMs = parseDelay(delayStr);

    if (!delayMs) {
      return reply(
        `❌ *Invalid time format.*\n\n` +
        `Use: *30s*, *5m*, *2h*\n\n` +
        `Example: *.schedule 10m Hello there!*`
      );
    }

    if (delayMs < 5000) return reply(`❌ Minimum delay is *5 seconds*.`);
    if (delayMs > 24 * 3600 * 1000) return reply(`❌ Maximum delay is *24 hours*.`);
    if (!messageText) return reply(`❌ Please include a message to send.\n\nExample: *.schedule 5m Hello!*`);

    const jobId = jobCounter++;
    const fireAt = Date.now() + delayMs;

    // Human-readable time
    const secs = Math.floor(delayMs / 1000);
    const dispMin = Math.floor(secs / 60);
    const dispSec = secs % 60;
    const dispStr = dispMin > 0 ? `${dispMin}m ${dispSec}s` : `${dispSec}s`;

    const timer = setTimeout(async () => {
      scheduledJobs.delete(jobId);
      try {
        await sock.sendMessage(jid, { text: `⏰ *Scheduled Message #${jobId}*\n\n${messageText}` }, { quoted: msg });
      } catch {}
    }, delayMs);

    scheduledJobs.set(jobId, { timer, text: messageText, fireAt, jid });

    return reply(
      `✅ *Message Scheduled! (#${jobId})*\n\n` +
      `⏱ Fires in: *${dispStr}*\n` +
      `💬 Message: _"${messageText.slice(0, 60)}"_\n\n` +
      `Use *.schedule cancel ${jobId}* to cancel.`
    );
  },
};
