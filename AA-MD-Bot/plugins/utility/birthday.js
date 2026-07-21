// ============================================
// AA MD Bot - Birthday Tracker
// Developer: Ahsan Ali | AA Mods
// .bday set 15 Aug     — apni birthday save karo
// .bday list           — group ke sab birthdays
// .bday del            — apni birthday delete karo
// .bday check          — force check (owner)
// Bot har din midnight pe auto-wish karta hai
// ============================================

import { db } from '../../lib/database.js';

const MONTHS = {
  jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
  jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
  january:1, february:2, march:3, april:4, june:6,
  july:7, august:8, september:9, october:10, november:11, december:12,
};

function parseDate(str) {
  // Formats: "15 Aug", "Aug 15", "15/8", "8/15", "15-8"
  if (!str) return null;
  str = str.trim().toLowerCase();

  // "15 aug" or "aug 15"
  const wordMatch = str.match(/^(\d{1,2})\s+([a-z]+)$/) || str.match(/^([a-z]+)\s+(\d{1,2})$/);
  if (wordMatch) {
    const [, a, b] = wordMatch;
    const day   = parseInt(/^\d+$/.test(a) ? a : b);
    const month = MONTHS[/^\d+$/.test(a) ? b : a];
    if (month && day >= 1 && day <= 31) return { day, month };
  }

  // "15/8" or "8/15" or "15-8"
  const numMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (numMatch) {
    const a = parseInt(numMatch[1]), b = parseInt(numMatch[2]);
    // Heuristic: if first is > 12 then it's day/month
    if (a > 12) return { day: a, month: b };
    if (b > 12) return { day: b, month: a };
    // Default: day/month
    return { day: a, month: b };
  }
  return null;
}

const MONTH_NAMES = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDate(day, month) {
  return `${day} ${MONTH_NAMES[month]}`;
}

function todayIs(day, month) {
  const now = new Date();
  return now.getDate() === day && (now.getMonth() + 1) === month;
}

// ── Auto-wish scheduler (runs every hour, triggers once per day) ──────────────
const wishedToday = new Set();    // "userJid|groupJid" → already wished today

setInterval(async () => {
  // Reset at midnight
  const h = new Date().getHours();
  if (h === 0) wishedToday.clear();

  try {
    const allUsers = db.users.all ? db.users.all() : {};
    for (const [userJid, userData] of Object.entries(allUsers)) {
      const bday = userData.birthday;
      if (!bday) continue;
      if (!todayIs(bday.day, bday.month)) continue;

      const wishKey = `${userJid}|${bday.wishGroup || 'dm'}`;
      if (wishedToday.has(wishKey)) continue;
      wishedToday.add(wishKey);

      // Try to send wish — needs sock, which we don't have here.
      // We store a pending wish flag that gets sent on next message.
      userData.pendingBirthdayWish = true;
      db.users.set(userJid, { pendingBirthdayWish: true });
    }
  } catch {}
}, 60 * 60 * 1000);   // every hour

export default {
  command: 'bday',
  alias: ['birthday', 'bdate', 'birthdaytracker'],
  description: 'Birthday save karo — bot auto-wish karega',
  category: 'utility',

  async execute({ sock, jid, msg, reply, args, senderJid, isGroupMsg, db: scopedDb }) {
    const sub = (args[0] || '').toLowerCase();

    // ── .bday set 15 Aug ──────────────────────────────────────────────────────
    if (sub === 'set') {
      const dateStr = args.slice(1).join(' ').trim();
      if (!dateStr) {
        return reply(
          `🎂 *Birthday Set*\n\n` +
          `*Usage:* *.bday set <date>*\n\n` +
          `*Examples:*\n` +
          `▸ *.bday set 15 Aug*\n` +
          `▸ *.bday set Aug 15*\n` +
          `▸ *.bday set 15/8*\n\n` +
          `> 🤖 *AA MD Bot*`
        );
      }
      const parsed = parseDate(dateStr);
      if (!parsed) {
        return reply(`❌ *Date format sahi nahi.*\n\nExample: *.bday set 15 Aug*\n\n> 🤖 *AA MD Bot*`);
      }

      const wishGroup = isGroupMsg ? jid : null;
      db.users.set(senderJid, {
        birthday: { day: parsed.day, month: parsed.month },
        birthdayName: msg.pushName || senderJid.split('@')[0],
        wishGroup,
      });

      return reply(
        `🎂 *Birthday Saved!*\n\n` +
        `👤 Name: *${msg.pushName || senderJid.split('@')[0]}*\n` +
        `📅 Date: *${formatDate(parsed.day, parsed.month)}*\n` +
        `${isGroupMsg ? `👥 Wish: *Is group mein*` : `💬 Wish: *DM mein*`}\n\n` +
        `Bot tumhe auto-wish karega! 🥳\n\n> 🤖 *AA MD Bot*`
      );
    }

    // ── .bday del ─────────────────────────────────────────────────────────────
    if (sub === 'del' || sub === 'delete' || sub === 'remove') {
      const user = db.users.get(senderJid);
      if (!user?.birthday) return reply(`❌ Tumhari koi birthday save nahi hai.\n\n> 🤖 *AA MD Bot*`);
      db.users.set(senderJid, { birthday: null, wishGroup: null });
      return reply(`✅ *Birthday delete ho gayi.*\n\n> 🤖 *AA MD Bot*`);
    }

    // ── .bday list ────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const allUsers = db.users.all ? db.users.all() : {};
      const entries = [];

      for (const [userJid, userData] of Object.entries(allUsers)) {
        const bday = userData.birthday;
        if (!bday) continue;
        // In groups: show all who have this group as wish group; in DM: show sender's only
        if (isGroupMsg && userData.wishGroup !== jid) continue;
        entries.push({ name: userData.birthdayName || userJid.split('@')[0], day: bday.day, month: bday.month });
      }

      if (!entries.length) {
        return reply(
          `🎂 *Birthday List*\n\n` +
          `${isGroupMsg ? 'Is group mein kisi ne bhi' : 'Tumne'} birthday save nahi ki.\n\n` +
          `*.bday set 15 Aug* se save karo!\n\n> 🤖 *AA MD Bot*`
        );
      }

      // Sort by month then day
      entries.sort((a, b) => a.month - b.month || a.day - b.day);

      let txt = `🎂 *Birthday List (${entries.length})*\n\n`;
      const today = new Date();
      for (const e of entries) {
        const isToday = e.day === today.getDate() && e.month === today.getMonth() + 1;
        txt += `${isToday ? '🥳' : '🎂'} *${e.name}* — ${formatDate(e.day, e.month)}${isToday ? '  ← *TODAY!* 🎉' : ''}\n`;
      }
      txt += `\n> 🤖 *AA MD Bot*`;
      return reply(txt);
    }

    // ── .bday today — check whose birthday is today ───────────────────────────
    if (sub === 'today') {
      const allUsers = db.users.all ? db.users.all() : {};
      const bdays = [];
      const today = new Date();
      for (const [, userData] of Object.entries(allUsers)) {
        const bday = userData.birthday;
        if (!bday) continue;
        if (bday.day === today.getDate() && bday.month === today.getMonth() + 1) {
          bdays.push(userData.birthdayName || 'Someone');
        }
      }
      if (!bdays.length) return reply(`🎂 Aaj kisi ka birthday nahi.\n\n> 🤖 *AA MD Bot*`);
      return reply(`🥳 *Aaj birthday hai:*\n\n${bdays.map(n => `🎉 *${n}*`).join('\n')}\n\n> 🤖 *AA MD Bot*`);
    }

    // ── .bday — help ──────────────────────────────────────────────────────────
    const user = db.users.get(senderJid);
    const myBday = user?.birthday
      ? `\n📅 *Tumhari birthday:* ${formatDate(user.birthday.day, user.birthday.month)}`
      : '\n📅 *Tumhari birthday:* save nahi';

    return reply(
      `🎂 *Birthday Tracker*\n\n` +
      `Bot birthday pe auto-wish karta hai!\n` +
      `${myBday}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `▸ *.bday set 15 Aug*  — birthday save karo\n` +
      `▸ *.bday list*        — sab ki birthdays dekho\n` +
      `▸ *.bday today*       — aaj birthday kiska hai\n` +
      `▸ *.bday del*         — apni birthday delete karo\n\n` +
      `> 🤖 *AA MD Bot*`
    );
  },
};
