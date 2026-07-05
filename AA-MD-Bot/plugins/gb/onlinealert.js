// ============================================
// AA MD Bot - Online Alert (GB WhatsApp Feature)
// Persists to db so alerts survive bot restarts
// ============================================

import { db } from '../../lib/database.js';

const DB_KEY = 'onlineAlerts'; // stored in db.settings as { [ownerNum]: [num, num, ...] }

function loadRegistry() {
  const raw = db.settings.getValue(DB_KEY) || {};
  const map = new Map();
  for (const [owner, nums] of Object.entries(raw)) {
    map.set(owner, new Set(nums));
  }
  return map;
}

function saveRegistry(map) {
  const raw = {};
  for (const [owner, set] of map.entries()) {
    raw[owner] = [...set];
  }
  db.settings.setValue(DB_KEY, raw);
}

// In-memory cache — always synced to db.
// Always re-load from db to avoid divergence when settings
// are modified externally (dashboard, restart, etc.)
export function getAlertRegistry() {
  // Reload from db every call — cheap JSON read, prevents stale cache
  const fresh = loadRegistry();
  return fresh;
}

export default {
  command: 'onlinealert',
  alias: ['onlinetrack', 'watchonline', 'presencealert', 'oalert'],
  category: 'gb',
  description: 'Get notified when a contact comes online (persists after restart)',
  usage: '.onlinealert <number> | .onlinealert list | .onlinealert clear',
  ownerOnly: true,

  async execute({ reply, args, sock, senderJid }) {
    const reg = getAlertRegistry();
    const ownerNum = senderJid?.split('@')[0]?.split(':')[0];
    const sub = args[0]?.toLowerCase();

    if (sub === 'list') {
      const watching = reg.get(ownerNum);
      if (!watching?.size) return reply(`👁️ *No active online alerts.*\n\nUse *.onlinealert <number>* to add one.`);
      const nums = [...watching].map((n, i) => `${i + 1}. +${n}`).join('\n');
      return reply(
        `👁️ *Active Online Alerts (${watching.size}/10)*\n\n${nums}\n\n` +
        `> ✅ Persisted — survives bot restart\n> 🤖 *AA MD Bot*`
      );
    }

    if (sub === 'clear') {
      reg.delete(ownerNum);
      saveRegistry(reg);
      return reply(`🗑️ *All online alerts cleared and saved.*`);
    }

    if (sub === 'remove' || sub === 'stop') {
      const num = args[1]?.replace(/\D/g, '');
      if (!num) return reply(`❌ Usage: *.onlinealert remove <number>*`);
      const watching = reg.get(ownerNum);
      if (watching?.has(num)) {
        watching.delete(num);
        saveRegistry(reg);
        return reply(`✅ Removed *+${num}* from alerts. (saved)`);
      }
      return reply(`❌ *${num}* was not being tracked.`);
    }

    if (!args[0] || isNaN(args[0].replace(/\D/g, ''))) {
      return reply(
        `👁️ *Online Alert*\n\n` +
        `*GB Feature* — Get pinged when a contact opens WhatsApp\n` +
        `✅ *Persists after restart* — alerts are saved to database\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `▸ *.onlinealert 923001234567*  — Track a number\n` +
        `▸ *.onlinealert list*          — View tracked list\n` +
        `▸ *.onlinealert remove <num>*  — Stop tracking one\n` +
        `▸ *.onlinealert clear*         — Remove all alerts\n\n` +
        `📌 Include country code. e.g. *923001234567*\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    const num = args[0].replace(/\D/g, '');
    if (num.length < 7) return reply(`❌ Invalid phone number. Include country code: *923001234567*`);

    if (!reg.has(ownerNum)) reg.set(ownerNum, new Set());
    const watching = reg.get(ownerNum);

    if (watching.size >= 10) return reply(`❌ Max 10 numbers tracked.\n\nUse *.onlinealert clear* to reset.`);
    if (watching.has(num)) return reply(`ℹ️ Already tracking *+${num}*.`);

    try { await sock.subscribePresence(`${num}@s.whatsapp.net`); } catch {}

    watching.add(num);
    saveRegistry(reg);

    return reply(
      `✅ *Now tracking: +${num}*\n\n` +
      `You will get a DM when this number comes online.\n` +
      `💾 *Saved to database* — survives restart.\n\n` +
      `📌 Tracking *${watching.size}/10* numbers.\n\n` +
      `> 🤖 *AA MD Bot*`
    );
  },
};
