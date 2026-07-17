// ============================================
// AA MD Bot - Productivity Tools
// In-memory storage (resets on restart)
// Commands: .habit .goal .journal .pomodoro
//   .todo .note2 .countdown
// ============================================

// In-memory stores (keyed by senderJid)
const habits   = new Map();
const goals    = new Map();
const journals = new Map();
const todos    = new Map();

export default {
  command: 'habit',
  alias: [
    'habittracker','goal','goals','setgoal',
    'journal','diary','pomodoro','focus',
    'todo','task','tasks','countdown2','eventcountdown',
  ],
  description: 'Productivity — habits, goals, journal, pomodoro, todo list',
  category: 'tools',

  async execute({ command, args, senderJid, reply, prefix }) {
    const key = senderJid;
    const sub = (args[0] || '').toLowerCase();
    const rest = args.slice(1).join(' ').trim();

    // ── pomodoro / focus ───────────────────────────────
    if (['pomodoro','focus'].includes(command)) {
      const mins = parseInt(args[0]) || 25;
      if (mins < 1 || mins > 120) return reply(`*Usage:* ${prefix}pomodoro <minutes (1-120)>\n${prefix}pomodoro 25`);
      reply(
        `🍅 *Pomodoro Timer Started!*\n\n` +
        `⏱️ Focus time: *${mins} minutes*\n` +
        `☕ Break: 5 minutes after\n\n` +
        `Stay focused — no distractions! 🚫📱`
      );
      setTimeout(() => {
        reply(
          `🍅 *Pomodoro Complete!*\n\n` +
          `Great work! Take a 5-minute break ☕\n` +
          `You earned it! 🎉\n\n` +
          `Use ${prefix}pomodoro again when ready.`
        );
      }, mins * 60 * 1000);
      return;
    }

    // ── habit tracker ──────────────────────────────────
    if (['habit','habittracker'].includes(command)) {
      if (!habits.has(key)) habits.set(key, []);
      const list = habits.get(key);

      if (sub === 'add') {
        if (!rest) return reply(`*Usage:* ${prefix}habit add <habit name>`);
        list.push({ name: rest, streak: 0, lastDone: null });
        return reply(`✅ Habit added: _"${rest}"_\n\nUse ${prefix}habit done <number> to check in.`);
      }
      if (sub === 'done') {
        const idx = parseInt(args[1]) - 1;
        if (!list[idx]) return reply(`❌ Invalid habit number. Use ${prefix}habit to see your list.`);
        const h = list[idx], today = new Date().toDateString();
        if (h.lastDone === today) return reply(`✅ Already checked in today for: _${h.name}_`);
        h.streak++; h.lastDone = today;
        return reply(`🔥 *${h.name}*\nStreak: *${h.streak} day${h.streak > 1 ? 's' : ''}!* 🔥\n\nKeep it up!`);
      }
      if (sub === 'del') {
        const idx = parseInt(args[1]) - 1;
        if (!list[idx]) return reply(`❌ Invalid number.`);
        const [removed] = list.splice(idx, 1);
        return reply(`✅ Removed: _${removed.name}_`);
      }
      if (sub === 'clear') { habits.set(key, []); return reply(`✅ All habits cleared.`); }
      if (!list.length) return reply(
        `📋 *Habit Tracker*\n\nNo habits yet!\n\n*Commands:*\n` +
        `• ${prefix}habit add <name>\n• ${prefix}habit done <number>\n• ${prefix}habit del <number>\n• ${prefix}habit clear`
      );
      const today = new Date().toDateString();
      return reply(
        `📋 *Your Habits*\n\n` +
        list.map((h,i) => `${h.lastDone===today?'✅':'⬜'} ${i+1}. *${h.name}* — 🔥 ${h.streak} day streak`).join('\n') +
        `\n\n${prefix}habit done <number> to check in`
      );
    }

    // ── goals ──────────────────────────────────────────
    if (['goal','goals','setgoal'].includes(command)) {
      if (!goals.has(key)) goals.set(key, []);
      const list = goals.get(key);

      if (sub === 'add') {
        if (!rest) return reply(`*Usage:* ${prefix}goal add <your goal>`);
        list.push({ text: rest, done: false, date: new Date().toLocaleDateString() });
        return reply(`🎯 Goal added: _"${rest}"_`);
      }
      if (sub === 'done') {
        const idx = parseInt(args[1]) - 1;
        if (!list[idx]) return reply(`❌ Invalid number.`);
        list[idx].done = true;
        return reply(`🎉 Goal completed: _${list[idx].text}_\n\nCongratulations! 🏆`);
      }
      if (sub === 'del') {
        const idx = parseInt(args[1]) - 1;
        if (!list[idx]) return reply(`❌ Invalid number.`);
        list.splice(idx, 1);
        return reply(`✅ Goal removed.`);
      }
      if (sub === 'clear') { goals.set(key, []); return reply(`✅ All goals cleared.`); }
      if (!list.length) return reply(
        `🎯 *Goal Tracker*\n\nNo goals set yet!\n\n` +
        `• ${prefix}goal add <your goal>\n• ${prefix}goal done <number>\n• ${prefix}goal del <number>`
      );
      return reply(
        `🎯 *Your Goals*\n\n` +
        list.map((g,i) => `${g.done?'✅':'⬜'} ${i+1}. ${g.text} _(${g.date})_`).join('\n') +
        `\n\n${prefix}goal done <number> to complete`
      );
    }

    // ── journal / diary ────────────────────────────────
    if (['journal','diary'].includes(command)) {
      if (!journals.has(key)) journals.set(key, []);
      const list = journals.get(key);

      if (sub === 'write') {
        if (!rest) return reply(`*Usage:* ${prefix}journal write <your entry>`);
        list.push({ text: rest, date: new Date().toLocaleString() });
        return reply(`📝 Journal entry saved! (${list.length} total)\n\n_"${rest.slice(0,80)}"_`);
      }
      if (sub === 'read') {
        if (!list.length) return reply(`📔 No journal entries yet.\n\n${prefix}journal write <entry>`);
        return reply(`📔 *Recent Journal*\n\n${list.slice(-5).map(e => `📅 _${e.date}_\n${e.text}`).join('\n\n')}`);
      }
      if (sub === 'clear') { journals.set(key, []); return reply(`✅ Journal cleared.`); }
      return reply(
        `📔 *Journal*\n\n` +
        `• ${prefix}journal write <entry>\n` +
        `• ${prefix}journal read\n` +
        `• ${prefix}journal clear\n\n` +
        `Entries: *${list.length}*`
      );
    }

    // ── todo / task ────────────────────────────────────
    if (['todo','task','tasks'].includes(command)) {
      if (!todos.has(key)) todos.set(key, []);
      const list = todos.get(key);

      if (sub === 'add') {
        if (!rest) return reply(`*Usage:* ${prefix}todo add <task>`);
        list.push({ text: rest, done: false });
        return reply(`✅ Task added: _"${rest}"_`);
      }
      if (sub === 'done') {
        const idx = parseInt(args[1]) - 1;
        if (!list[idx]) return reply(`❌ Invalid number.`);
        list[idx].done = true;
        return reply(`✅ Task done: _${list[idx].text}_`);
      }
      if (sub === 'del') {
        const idx = parseInt(args[1]) - 1;
        if (!list[idx]) return reply(`❌ Invalid number.`);
        list.splice(idx, 1);
        return reply(`✅ Task removed.`);
      }
      if (sub === 'clear') { todos.set(key, []); return reply(`✅ Todo list cleared.`); }
      if (!list.length) return reply(
        `📋 *Todo List*\n\nEmpty!\n\n• ${prefix}todo add <task>\n• ${prefix}todo done <number>\n• ${prefix}todo del <number>`
      );
      const pending = list.filter(t => !t.done).length;
      return reply(
        `📋 *Todo List* (${pending} pending)\n\n` +
        list.map((t,i) => `${t.done?'✅':'⬜'} ${i+1}. ${t.text}`).join('\n') +
        `\n\n${prefix}todo done <number>  •  ${prefix}todo del <number>`
      );
    }

    // ── countdown ──────────────────────────────────────
    if (['countdown2','eventcountdown'].includes(command)) {
      const now  = new Date();
      const year = now.getFullYear();
      const events = {
        newyear:   { name: 'New Year',          date: new Date(year+1, 0, 1) },
        christmas: { name: 'Christmas',          date: new Date(year, 11, 25) },
        valentine: { name: "Valentine's Day",    date: new Date(year, 1, 14) },
        halloween: { name: 'Halloween',          date: new Date(year, 9, 31) },
        eid:       { name: 'Eid (approx)',       date: new Date(year, 3, 10) },
      };
      const key2 = (args[0]||'').toLowerCase();
      if (!key2) return reply(
        `🎉 *Event Countdown*\n\n*Events:* newyear, christmas, valentine, halloween, eid\n\n${prefix}countdown2 christmas`
      );
      const ev = events[key2];
      if (!ev) return reply(`❌ Unknown event.\n*Try:* newyear, christmas, valentine, halloween, eid`);
      if (ev.date < now) ev.date.setFullYear(ev.date.getFullYear() + 1);
      const days = Math.ceil((ev.date - now) / 86400000);
      return reply(`🎉 *${ev.name}*\n\n📅 ${ev.date.toDateString()}\n⏳ *${days} days* remaining!\n\n> 🎉 *AA MD Bot*`);
    }

    reply(
      `⚡ *Productivity Tools*\n\n` +
      `🍅 *Pomodoro:* ${prefix}pomodoro 25\n\n` +
      `📋 *Habit Tracker:*\n` +
      `• ${prefix}habit add / done / del / clear\n\n` +
      `🎯 *Goals:*\n` +
      `• ${prefix}goal add / done / del / clear\n\n` +
      `📔 *Journal:*\n` +
      `• ${prefix}journal write / read / clear\n\n` +
      `✅ *Todo List:*\n` +
      `• ${prefix}todo add / done / del / clear\n\n` +
      `🎉 *Countdown:* ${prefix}countdown2 christmas\n\n` +
      `> ⚡ *AA MD Bot*`
    );
  },
};
