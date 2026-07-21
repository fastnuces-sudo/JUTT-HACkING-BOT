// ============================================
// AA MD Bot - Birthday Auto-Wish System
// Developer: Ahsan Ali | AA Mods
// Exactly midnight wish • custom messages • multi-msg
// ============================================

import { db } from '../../lib/database.js';

// ── Constants ────────────────────────────────────────────────────────────────
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
  const wm = str.match(/^(\d{1,2})\s+([a-z]+)$/) || str.match(/^([a-z]+)\s+(\d{1,2})$/);
  if (wm) {
    const [,a,b] = wm;
    const day   = parseInt(/^\d+$/.test(a) ? a : b);
    const month = MONTHS[/^\d+$/.test(a) ? b : a];
    if (month && day >= 1 && day <= 31) return { day, month };
  }
  const nm = str.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (nm) {
    const a = parseInt(nm[1]), b = parseInt(nm[2]);
    if (a > 12) return { day: a, month: b };
    if (b > 12) return { day: b, month: a };
    return { day: a, month: b };
  }
  return null;
}

// ── Midnight Scheduler ───────────────────────────────────────────────────────
let _wishedToday = new Set();

async function runBirthdayWishes(getSessions) {
  _wishedToday = new Set(); // reset daily
  const today = new Date();
  const d = today.getDate(), m = today.getMonth() + 1;

  const allUsers = db.users.all();
  for (const [userJid, userData] of Object.entries(allUsers)) {
    const bday = userData?.birthday;
    if (!bday || bday.day !== d || bday.month !== m) continue;

    const msgs = userData.bdayMsgs;
    if (!msgs?.length) continue; // no message set by user — skip

    const wishKey = `${userJid}`;
    if (_wishedToday.has(wishKey)) continue;
    _wishedToday.add(wishKey);

    const sessionId = userData.bdaySessionId || 'default';
    const sMap      = getSessions();
    const sock      = sMap instanceof Map ? sMap.get(sessionId) : sMap[sessionId];
    if (!sock) continue;

    // Pick random message from user's list
    const wishText = msgs[Math.floor(Math.random() * msgs.length)];
    const targetJid = userData.bdayGroup || userJid;
    const mention   = userData.bdayGroup ? [userJid] : [];
    const numStr    = userJid.split('@')[0];

    try {
      await sock.sendMessage(targetJid, {
        text: `🎂🎉 *Happy Birthday @${numStr}!*\n\n${wishText}\n\n> 🤖 *AA MD Bot*`,
        mentions: mention,
      });
    } catch {}
  }
}

export function startBirthdayScheduler(getSessions) {
  function scheduleNext() {
    const now      = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 500); // exact 12:00:00 AM
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
  description: 'Birthday save karo — bot exactly midnight pe auto-wish karega',
  category: 'utility',

  async execute({ sock, jid, msg, reply, args, senderJid, isGroupMsg, db: db_ }) {
    const sub     = (args[0] || '').toLowerCase();
    const rest    = args.slice(1).join(' ').trim();
    const userData = db_.users.get(senderJid) || {};

    // ── .bday set <date> ─────────────────────────────────────────────────────
    if (sub === 'set') {
      if (!rest) return reply(`❌ Date batao.\nMisaal: *.bday set 15 Aug*\n\n> 🤖 *AA MD Bot*`);
      const parsed = parseDate(rest);
      if (!parsed) return reply(`❌ Date format galat hai.\nMisaal: *15 Aug* ya *15/8*\n\n> 🤖 *AA MD Bot*`);

      db_.users.set(senderJid, {
        birthday:       parsed,
        bdayGroup:      isGroupMsg ? jid  : null,
        bdaySessionId:  sock.sessionId    || 'default',
        bdayName:       msg.pushName      || senderJid.split('@')[0],
      });

      const hasMsgs = userData.bdayMsgs?.length > 0;
      return reply(
        `🎂 *Birthday Save Ho Gayi!*\n\n` +
        `📅 *Tarikh:* ${parsed.day} ${MN[parsed.month]}\n` +
        `📍 *Wish jayegi:* ${isGroupMsg ? 'Is group mein' : 'Tumhare DM mein'}\n\n` +
        (hasMsgs
          ? `✅ Wish message pehle se set hai!\n`
          : `⚠️ *Wish message abhi set nahi!*\nBot wish NAHI karega jab tak message set na karo:\n*.bday addmsg Happy Birthday bhai! 🎂*\n`) +
        `\n> 🤖 *AA MD Bot*`
      );
    }

    // ── .bday addmsg <text> ──────────────────────────────────────────────────
    if (sub === 'addmsg') {
      if (!rest) return reply(`❌ Message likho.\nMisaal: *.bday addmsg Happy Birthday! 🎂*\n\n> 🤖 *AA MD Bot*`);
      const existing = userData.bdayMsgs || [];
      if (existing.length >= 10) return reply(`❌ Max 10 messages allowed.\n*.bday delmsg <number>* se pehle koi delete karo.\n\n> 🤖 *AA MD Bot*`);
      const updated = [...existing, rest];
      db_.users.set(senderJid, { bdayMsgs: updated });
      return reply(`✅ *Message #${updated.length} save ho gaya!*\n\n_"${rest}"_\n\nAb ${updated.length} message(s) set hain. Bot randomly ek bhejega.\n\n> 🤖 *AA MD Bot*`);
    }

    // ── .bday delmsg <num> ───────────────────────────────────────────────────
    if (sub === 'delmsg') {
      const idx = parseInt(rest) - 1;
      const existing = userData.bdayMsgs || [];
      if (isNaN(idx) || idx < 0 || idx >= existing.length) {
        return reply(`❌ Sahi number do (1-${existing.length}).\n*.bday msgs* se list dekho.\n\n> 🤖 *AA MD Bot*`);
      }
      existing.splice(idx, 1);
      db_.users.set(senderJid, { bdayMsgs: existing });
      return reply(`✅ *Message delete ho gaya.*\nAb ${existing.length} message(s) baki hain.\n\n> 🤖 *AA MD Bot*`);
    }

    // ── .bday msgs ───────────────────────────────────────────────────────────
    if (sub === 'msgs') {
      const msgs = userData.bdayMsgs || [];
      if (!msgs.length) return reply(`📭 Koi wish message set nahi.\n*.bday addmsg <text>* se add karo.\n\n> 🤖 *AA MD Bot*`);
      const list = msgs.map((m,i) => `*${i+1}.* ${m}`).join('\n');
      return reply(`🎂 *Tumhare Wish Messages (${msgs.length}):*\n\n${list}\n\n> 🤖 *AA MD Bot*`);
    }

    // ── .bday del ────────────────────────────────────────────────────────────
    if (sub === 'del') {
      db_.users.set(senderJid, { birthday: null, bdayMsgs: [], bdayGroup: null });
      return reply(`🗑️ *Birthday delete ho gayi.*\n\n> 🤖 *AA MD Bot*`);
    }

    // ── .bday list ───────────────────────────────────────────────────────────
    if (sub === 'list') {
      const allU = db.users.all();
      const entries = [];
      for (const [, u] of Object.entries(allU)) {
        const b = u?.birthday;
        if (!b) continue;
        if (isGroupMsg && u.bdayGroup !== jid) continue;
        entries.push({ name: u.bdayName || '?', day: b.day, month: b.month, hasMsgs: (u.bdayMsgs?.length || 0) > 0 });
      }
      if (!entries.length) return reply(`📭 Koi birthday save nahi.\n\n> 🤖 *AA MD Bot*`);
      entries.sort((a,b) => a.month - b.month || a.day - b.day);
      const today = new Date();
      const txt = entries.map(e => {
        const isToday = e.day === today.getDate() && e.month === today.getMonth()+1;
        return `${isToday ? '🥳' : '🎂'} *${e.name}* — ${e.day} ${MN[e.month]}${!e.hasMsgs ? ' ⚠️' : ''}${isToday ? ' ← *TODAY!* 🎉' : ''}`;
      }).join('\n');
      return reply(`🎂 *Birthday List (${entries.length}):*\n\n${txt}\n\n⚠️ = wish message set nahi\n\n> 🤖 *AA MD Bot*`);
    }

    // ── .bday today ──────────────────────────────────────────────────────────
    if (sub === 'today') {
      const today = new Date();
      const d = today.getDate(), m = today.getMonth()+1;
      const allU = db.users.all();
      const bdays = Object.values(allU).filter(u => u?.birthday?.day === d && u?.birthday?.month === m);
      if (!bdays.length) return reply(`🎂 Aaj kisi ka birthday nahi.\n\n> 🤖 *AA MD Bot*`);
      const txt = bdays.map(u => `🥳 *${u.bdayName || '?'}*${!u.bdayMsgs?.length ? ' ⚠️ (no msg)' : ''}`).join('\n');
      return reply(`🎉 *Aaj Birthday Hai:*\n\n${txt}\n\n> 🤖 *AA MD Bot*`);
    }

    // ── .bday — status + help ────────────────────────────────────────────────
    const bday     = userData.birthday;
    const msgCount = userData.bdayMsgs?.length || 0;
    const ready    = bday && msgCount > 0;

    return reply(
      `🎂 *Birthday Tracker*\n\n` +
      (bday
        ? `📅 *Tumhari birthday:* ${bday.day} ${MN[bday.month]}\n` +
          `💬 *Wish messages:* ${msgCount}\n` +
          `🤖 *Status:* ${ready ? '✅ Active — midnight pe wish jayegi' : '⚠️ Inactive — wish message add karo'}`
        : `📅 *Birthday:* save nahi`) +
      `\n\n━━━━━━━━━━━━━━━━━━━━━\n` +
      `*.bday set 15 Aug*       — date save karo\n` +
      `*.bday addmsg <text>*    — wish message add karo ✨\n` +
      `*.bday msgs*             — messages dekho\n` +
      `*.bday delmsg <num>*     — message delete karo\n` +
      `*.bday list*             — sab ki birthdays\n` +
      `*.bday today*            — aaj kaun?\n` +
      `*.bday del*              — apni birthday hatao\n\n` +
      `> 🤖 *AA MD Bot*`
    );
  },
};
