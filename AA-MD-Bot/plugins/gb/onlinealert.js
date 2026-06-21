// ============================================
// AA MD Bot - Online Alert (GB WhatsApp Feature)
// Get notified when a contact comes online
// ============================================

// In-memory alert registry (resets on bot restart)
const alertRegistry = new Map(); // ownerJid → Set of watched numbers

export function getAlertRegistry() { return alertRegistry; }

export default {
  command: 'onlinealert',
  alias: ['onlinetrack', 'watchonline', 'presencealert', 'oalert'],
  category: 'gb',
  description: 'Get notified when a contact comes online',
  usage: '.onlinealert <number> | .onlinealert list | .onlinealert clear',
  ownerOnly: true,

  async execute({ reply, args, sock, senderJid, db }) {
    const ownerNum = senderJid?.split('@')[0]?.split(':')[0];
    const sub = args[0]?.toLowerCase();

    // List active alerts
    if (sub === 'list') {
      const watching = alertRegistry.get(ownerNum);
      if (!watching?.size) {
        return reply(`👁️ *No active online alerts.*\n\nUse *.onlinealert <number>* to add one.`);
      }
      const nums = [...watching].join('\n  • ');
      return reply(
        `👁️ *Active Online Alerts (${watching.size})*\n\n  • ${nums}\n\n` +
        `You will be notified when any of these come online.\n` +
        `Use *.onlinealert clear* to remove all.`
      );
    }

    // Clear all alerts
    if (sub === 'clear') {
      alertRegistry.delete(ownerNum);
      return reply(`🗑️ *All online alerts cleared.*`);
    }

    // Remove specific number
    if (sub === 'remove' || sub === 'stop') {
      const num = args[1]?.replace(/\D/g, '');
      if (!num) return reply(`❌ Usage: *.onlinealert remove <number>*`);
      const watching = alertRegistry.get(ownerNum);
      if (watching?.has(num)) {
        watching.delete(num);
        return reply(`✅ Removed *${num}* from online alerts.`);
      }
      return reply(`❌ *${num}* was not being tracked.`);
    }

    // Help if no args
    if (!args[0] || isNaN(args[0].replace(/\D/g, ''))) {
      return reply(
        `👁️ *Online Alert*\n\n` +
        `*GB WhatsApp Feature* — Get pinged when a contact opens WhatsApp\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `▸ *.onlinealert 923001234567*  — Track a number\n` +
        `▸ *.onlinealert list*          — View tracked list\n` +
        `▸ *.onlinealert remove <num>*  — Stop tracking\n` +
        `▸ *.onlinealert clear*         — Remove all alerts\n\n` +
        `📌 Include country code. e.g. *923001234567*\n` +
        `⚠️ Contact must have your number saved for this to work.\n\n` +
        `> 🤖 *Powered by AA MD Bot*`
      );
    }

    // Add number to watch list
    const num = args[0].replace(/\D/g, '');
    if (num.length < 7) return reply(`❌ Invalid phone number. Include country code: *923001234567*`);

    if (!alertRegistry.has(ownerNum)) alertRegistry.set(ownerNum, new Set());
    const watching = alertRegistry.get(ownerNum);

    if (watching.size >= 10) {
      return reply(`❌ Max 10 numbers tracked at once.\n\nUse *.onlinealert clear* to reset.`);
    }

    if (watching.has(num)) {
      return reply(`ℹ️ Already tracking *${num}*.\n\nUse *.onlinealert list* to view all.`);
    }

    // Subscribe to their presence
    const watchJid = `${num}@s.whatsapp.net`;
    try {
      await sock.subscribePresence(watchJid);
    } catch {}

    watching.add(num);

    return reply(
      `✅ *Now tracking: ${num}*\n\n` +
      `You will get a DM when this number comes online.\n\n` +
      `📌 Tracking *${watching.size}/10* numbers.\n` +
      `Use *.onlinealert list* to view all.\n\n` +
      `> 🤖 *Powered by AA MD Bot*`
    );
  },
};
