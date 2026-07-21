// ============================================
// AA MD Bot - Birthday Auto-Wish System
// Developer: Ahsan Ali | AA Mods
// Exactly midnight wish • custom messages • set for any number
// ============================================

import { db } from '../../lib/database.js';

const MONTHS = {
  jan:1,feb:2,mar:3,apr:4,may:5,jun:6,
  jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
  january:1,february:2,march:3,april:4,june:6,
  july:7,august:8,september:9,october:10,november:11,december:12,
};
const MN = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function parseDate(str) {
  if (!str) return null;
  str = str.trim().toLowerCase();
  // "15 aug" or "aug 15"
  const wm = str.match(/^(\d{1,2})\s+([a-z]+)$/) || str.match(/^([a-z]+)\s+(\d{1,2})$/);
  if (wm) {
    const [,a,b] = wm;
    const day   = parseInt(/^\d+$/.test(a) ? a : b);
    const month = MONTHS[/^\d+$/.test(a) ? b : a];
    if (month && day >= 1 && day <= 31) return { day, month };
  }
  // "15/8" or "15-8"
  const nm = str.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (nm) {
    const a = parseInt(nm[1]), b = parseInt(nm[2]);
    if (a > 12) return { day: a, month: b };
    if (b > 12) return { day: b, month: a };
    return { day: a, month: b };
  }
  return null;
}

// Convert number to JID (92xxxxxxxxxx → 92xxxxxxxxxx@s.whatsapp.net)
function toJid(num) {
  const clean = num.replace(/[^0-9]/g, '');
  if (!clean) return null;
  return `${clean}@s.whatsapp.net`;
}

// ── Midnight Scheduler ───────────────────────────────────────────────────────
let _wishedToday = new Set();

async function runBirthdayWishes(getSessions) {
  _wishedToday = new Set();
  const today = new Date();
  const d = today.getDate(), m = today.getMonth() + 1;

  const allUsers = db.users.all();
  for (const [userJid, userData] of Object.entries(allUsers)) {
    const bday = userData?.birthday;
    if (!bday || bday.day !== d || bday.month !== m) continue;

    const msgs = userData.bdayMsgs;
    if (!msgs?.length) continue; // no message set — skip

    if (_wishedToday.has(userJid)) continue;
    _wishedToday.add(userJid);

    const sessionId = userData.bdaySessionId || 'default';
    const sMap      = getSessions();
    const sock      = sMap instanceof Map ? sMap.get(sessionId) : sMap[sessionId];
    if (!sock) continue;

    const wishText = msgs[Math.floor(Math.random() * msgs.length)];
    const targetJid = userData.bdayGroup || userJid;
    const mention   = userData.bdayGroup ? [userJid] : [];
    const numStr    = userJid.split('@')[0];
    const name      = userData.bdayName || numStr;

    try {
      await sock.sendMessage(targetJid, {
        text: `🎂🎉 *Happy Birthday ${name}!*\n\n${wishText}\n\n> 🤖 *AA MD Bot*`,
        mentions: mention,
      });
    } catch {}
  }
}

export function startBirthdayScheduler(getSessions) {
  function scheduleNext() {
    const now      = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 500); // exact 12:00:00 AM next day
    const delay = midnight - now;
    setTimeout(async () => {
      await runBirthdayWishes(getSessions).catch(() => {});
      scheduleNext();
    }, delay);
  }
  scheduleNext();
}

// ── Plugin ───────────────────────────────────────────────────────────────────
export default {
  command: 'bday',
  alias: ['birthday', 'bdate'],
  description: 'Save a birthday — the bot will auto-wish at exactly midnight',
  category: 'utility',

  async execute({ sock, jid, msg, reply, args, senderJid, isGroupMsg, db: db_ }) {
    const sub  = (args[0] || '').toLowerCase();
    const rest = args.slice(1).join(' ').trim();

    // ── .bday set <date>  OR  .bday set <number> <date> ─────────────────────
    if (sub === 'set') {
      if (!rest) return reply(
        `❌ Please provide a date.\n` +
        `Example:\n` +
        `*.bday set 15 Aug* — your own birthday\n` +
        `*.bday set 923001234567 15 Aug* — someone else's birthday\n\n` +
        `> 🤖 *AA MD Bot*`
      );

      // Check if first token looks like a phone number (≥7 digits)
      const firstToken = args[1] || '';
      const isNumber   = /^[+\d]{7,15}$/.test(firstToken.replace(/[\s\-]/g, ''));

      let targetJid, dateStr, targetName;
      if (isNumber) {
        targetJid  = toJid(firstToken);
        dateStr    = args.slice(2).join(' ').trim();
        targetName = targetJid?.split('@')[0];
      } else {
        targetJid  = senderJid;
        dateStr    = rest;
        targetName = msg.pushName || senderJid.split('@')[0];
      }

      if (!targetJid) return reply(`❌ Invalid number format.\nExample: *923001234567*\n\n> 🤖 *AA MD Bot*`);
      if (!dateStr)   return reply(`❌ Please provide a date.\nExample: *15 Aug* or *15/8*\n\n> 🤖 *AA MD Bot*`);

      const parsed = parseDate(dateStr);
      if (!parsed) return reply(`❌ Invalid date format.\nExample: *15 Aug* or *15/8*\n\n> 🤖 *AA MD Bot*`);

      const existing = db_.users.get(targetJid) || {};
      db_.users.set(targetJid, {
        birthday:      parsed,
        bdayGroup:     isGroupMsg ? jid : null,
        bdaySessionId: sock.sessionId || 'default',
        bdayName:      targetName,
      });

      const hasMsgs  = (existing.bdayMsgs?.length || 0) > 0;
      const isSelf   = targetJid === senderJid;
      const forLabel = isSelf ? 'Your' : `${targetName}'s`;

      return reply(
        `🎂 *Birthday Saved!*\n\n` +
        `👤 *For:* ${forLabel}\n` +
        `📅 *Date:* ${parsed.day} ${MN[parsed.month]}\n` +
        `📍 *Wish will be sent in:* ${isGroupMsg ? 'This group' : 'DM'}\n\n` +
        (hasMsgs
          ? `✅ Wish message is already set!\n`
          : `⚠️ *No wish message set!*\nThe bot will NOT wish until you add a message:\n*.bday addmsg Happy Birthday! 🎂*\n`) +
        `\n> 🤖 *AA MD Bot*`
      );
    }

    // ── .bday addmsg <text> ──────────────────────────────────────────────────
    if (sub === 'addmsg') {
      if (!rest) return reply(`❌ Please write a message.\nExample: *.bday addmsg Happy Birthday! 🎂*\n\n> 🤖 *AA MD Bot*`);
      const userData = db_.users.get(senderJid) || {};
      const existing = userData.bdayMsgs || [];
      if (existing.length >= 10) return reply(`❌ Max 10 messages allowed.\nDelete one first with *.bday delmsg <number>*.\n\n> 🤖 *AA MD Bot*`);
      const updated = [...existing, rest];
      db_.users.set(senderJid, { bdayMsgs: updated });
      return reply(`✅ *Message #${updated.length} added!*\n\n_"${rest}"_\n\nYou now have ${updated.length} message(s) set. The bot will pick one randomly.\n\n> 🤖 *AA MD Bot*`);
    }

    // ── .bday addmsgfor <number> <text> — add msg for another number ─────────
    if (sub === 'addmsgfor') {
      const [numToken, ...msgParts] = args.slice(1);
      const msgText = msgParts.join(' ').trim();
      const tJid    = toJid(numToken || '');
      if (!tJid || !msgText) return reply(
        `❌ Format: *.bday addmsgfor <number> <message>*\nExample: *.bday addmsgfor 923001234567 Happy Birthday! 🎂*\n\n> 🤖 *AA MD Bot*`
      );
      const tData    = db_.users.get(tJid) || {};
      const existing = tData.bdayMsgs || [];
      if (existing.length >= 10) return reply(`❌ Max 10 messages allowed.\n\n> 🤖 *AA MD Bot*`);
      const updated = [...existing, msgText];
      db_.users.set(tJid, { bdayMsgs: updated });
      return reply(`✅ *Message #${updated.length} added!*\n👤 Number: ${numToken}\n_"${msgText}"_\n\n> 🤖 *AA MD Bot*`);
    }

    // ── .bday delmsg <num> ───────────────────────────────────────────────────
    if (sub === 'delmsg') {
      const userData = db_.users.get(senderJid) || {};
      const idx      = parseInt(rest) - 1;
      const existing = userData.bdayMsgs || [];
      if (isNaN(idx) || idx < 0 || idx >= existing.length) {
        return reply(`❌ Please enter a valid number (1-${existing.length}).\nSee your list with *.bday msgs*.\n\n> 🤖 *AA MD Bot*`);
      }
      existing.splice(idx, 1);
      db_.users.set(senderJid, { bdayMsgs: existing });
      return reply(`✅ *Message deleted.*\nYou now have ${existing.length} message(s) remaining.\n\n> 🤖 *AA MD Bot*`);
    }

    // ── .bday msgs ───────────────────────────────────────────────────────────
    if (sub === 'msgs') {
      const userData = db_.users.get(senderJid) || {};
      const msgs     = userData.bdayMsgs || [];
      if (!msgs.length) return reply(`📭 No wish messages set.\nAdd one with *.bday addmsg <text>*.\n\n> 🤖 *AA MD Bot*`);
      const list = msgs.map((m,i) => `*${i+1}.* ${m}`).join('\n');
      return reply(`🎂 *Your Wish Messages (${msgs.length}):*\n\n${list}\n\n> 🤖 *AA MD Bot*`);
    }

    // ── .bday del ────────────────────────────────────────────────────────────
    if (sub === 'del') {
      db_.users.set(senderJid, { birthday: null, bdayMsgs: [], bdayGroup: null });
      return reply(`🗑️ *Birthday removed.*\n\n> 🤖 *AA MD Bot*`);
    }

    // ── .bday list ───────────────────────────────────────────────────────────
    if (sub === 'list') {
      const allU    = db.users.all();
      const entries = [];
      for (const [, u] of Object.entries(allU)) {
        const b = u?.birthday;
        if (!b) continue;
        if (isGroupMsg && u.bdayGroup !== jid) continue;
        entries.push({ name: u.bdayName || '?', day: b.day, month: b.month, hasMsgs: (u.bdayMsgs?.length || 0) > 0 });
      }
      if (!entries.length) return reply(`📭 No birthdays saved.\n\n> 🤖 *AA MD Bot*`);
      entries.sort((a,b) => a.month - b.month || a.day - b.day);
      const today = new Date();
      const txt = entries.map(e => {
        const isToday = e.day === today.getDate() && e.month === today.getMonth()+1;
        return `${isToday ? '🥳' : '🎂'} *${e.name}* — ${e.day} ${MN[e.month]}${!e.hasMsgs ? ' ⚠️' : ''}${isToday ? ' ← *TODAY!* 🎉' : ''}`;
      }).join('\n');
      return reply(`🎂 *Birthday List (${entries.length}):*\n\n${txt}\n\n⚠️ = no wish message set\n\n> 🤖 *AA MD Bot*`);
    }

    // ── .bday today ──────────────────────────────────────────────────────────
    if (sub === 'today') {
      const today = new Date();
      const d = today.getDate(), m = today.getMonth()+1;
      const allU  = db.users.all();
      const bdays = Object.values(allU).filter(u => u?.birthday?.day === d && u?.birthday?.month === m);
      if (!bdays.length) return reply(`🎂 No birthdays today.\n\n> 🤖 *AA MD Bot*`);
      const txt = bdays.map(u => `🥳 *${u.bdayName || '?'}*${!u.bdayMsgs?.length ? ' ⚠️ (no msg)' : ''}`).join('\n');
      return reply(`🎉 *Today's Birthdays:*\n\n${txt}\n\n> 🤖 *AA MD Bot*`);
    }

    // ── .bday — status + help ────────────────────────────────────────────────
    const userData = db_.users.get(senderJid) || {};
    const bday     = userData.birthday;
    const msgCount = userData.bdayMsgs?.length || 0;
    const ready    = bday && msgCount > 0;

    return reply(
      `🎂 *Birthday Tracker*\n\n` +
      (bday
        ? `📅 *Your birthday:* ${bday.day} ${MN[bday.month]}\n` +
          `💬 *Wish messages:* ${msgCount}\n` +
          `🤖 *Status:* ${ready ? '✅ Active — will wish at midnight' : '⚠️ Inactive — add a wish message first'}`
        : `📅 *Birthday:* not saved`) +
      `\n\n━━━━━━━━━━━━━━━━━━━━━\n` +
      `*.bday set 15 Aug*                    — save your birthday\n` +
      `*.bday set 923xxxxxxx 15 Aug*         — save someone else's birthday\n` +
      `*.bday addmsg <text>*                 — add a wish message for yourself\n` +
      `*.bday addmsgfor <number> <text>*     — add a wish message for someone else\n` +
      `*.bday msgs*                          — view your wish messages\n` +
      `*.bday delmsg <num>*                  — delete a wish message\n` +
      `*.bday list*                          — view all saved birthdays\n` +
      `*.bday today*                         — who has a birthday today?\n` +
      `*.bday del*                           — remove your birthday\n\n` +
      `> 🤖 *AA MD Bot*`
    );
  },
};
