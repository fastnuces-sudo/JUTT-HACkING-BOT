// ============================================
// AA MD Bot - Member Report System
// Developer: Ahsan Ali | AA Mods
// .report @user <reason>  — group member kisi ko report kare
// .reports                — pending reports dekho (admin only)
// .clearreports           — sab reports clear karo (admin only)
// ============================================

// In-memory report store per group:  groupJid → [ { reporter, target, reason, time } ]
const reportStore = new Map();

function getReports(gJid) {
  if (!reportStore.has(gJid)) reportStore.set(gJid, []);
  return reportStore.get(gJid);
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

export default [
  // ── .report @user reason ──────────────────────────────────────────────────
  {
    command: 'report',
    alias: ['reportuser', 'flag'],
    description: 'Kisi member ko admins ke paas report karo',
    category: 'admin',
    groupOnly: true,
    adminOnly: false,

    async execute({ sock, jid, msg, reply, args, senderJid, text }) {
      const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

      if (!mentions.length) {
        return reply(
          `📢 *Member Report System*\n\n` +
          `Kisi bhi member ko admin ke paas report karo.\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `*Usage:*\n` +
          `▸ *.report @user <reason>*\n\n` +
          `*Example:*\n` +
          `▸ *.report @ali Spam kar raha hai*\n` +
          `▸ *.report @user Links bhej raha hai*\n\n` +
          `> 🤖 *AA MD Bot*`
        );
      }

      const target = mentions[0];
      const targetNum = target.split('@')[0];
      const reporterNum = senderJid.split('@')[0];

      // Extract reason (text after mention)
      const reason = text.replace(/@\d+/g, '').trim() || 'No reason given';

      // Prevent self-report
      if (target === senderJid) {
        return reply(`❌ Apne aap ko report nahi kar sakte.\n\n> 🤖 *AA MD Bot*`);
      }

      // Anti-spam: same reporter can't report same user twice in 5 min
      const reports = getReports(jid);
      const recentDupe = reports.find(r =>
        r.reporter === senderJid && r.target === target &&
        Date.now() - r.time < 5 * 60 * 1000
      );
      if (recentDupe) {
        return reply(`⚠️ Tum ne @${targetNum} ko abhi 5 minutes pehle report kiya hai. Thodi der baad try karo.\n\n> 🤖 *AA MD Bot*`, { mentions: [target] });
      }

      // Save report
      const reportEntry = { reporter: senderJid, target, reason, time: Date.now() };
      reports.push(reportEntry);

      // Fetch admins to notify
      let admins = [];
      try {
        const meta = await sock.groupMetadata(jid);
        admins = meta.participants.filter(p => p.admin).map(p => p.id);
      } catch {}

      const totalReports = reports.filter(r => r.target === target).length;
      const adminMentions = admins.map(a => `@${a.split('@')[0]}`).join(' ');

      // 1. Confirm to reporter
      await reply(
        `✅ *Report Submit Ho Gaya!*\n\n` +
        `👤 Reported: @${targetNum}\n` +
        `📝 Reason: _${reason}_\n` +
        `🔢 Total reports against this user: *${totalReports}*\n\n` +
        `Admins ko notify kar diya gaya hai.\n\n> 🤖 *AA MD Bot*`,
        { mentions: [target] }
      );

      // 2. Notify admins in group
      if (admins.length) {
        await sock.sendMessage(jid, {
          text:
            `🚨 *NEW REPORT*\n\n` +
            `👮 Admins: ${adminMentions}\n\n` +
            `🔴 *Reported User:* @${targetNum}\n` +
            `👤 *Reporter:* @${reporterNum}\n` +
            `📝 *Reason:* ${reason}\n` +
            `🔢 *Total Reports:* ${totalReports}\n\n` +
            `Use *.reports* to see all pending reports.\n\n> 🤖 *AA MD Bot*`,
          mentions: [...admins, target, senderJid],
        });
      }
    },
  },

  // ── .reports — admin dekhe pending reports ────────────────────────────────
  {
    command: 'reports',
    alias: ['viewreports', 'allreports'],
    description: 'Sab pending reports dekho (admins only)',
    category: 'admin',
    groupOnly: true,
    adminOnly: true,

    async execute({ jid, reply }) {
      const reports = getReports(jid);
      if (!reports.length) {
        return reply(`📋 *Koi pending report nahi.*\n\n> 🤖 *AA MD Bot*`);
      }

      // Group by target
      const byTarget = {};
      for (const r of reports) {
        if (!byTarget[r.target]) byTarget[r.target] = [];
        byTarget[r.target].push(r);
      }

      let txt = `📋 *Group Reports (${reports.length} total)*\n\n`;
      for (const [target, rList] of Object.entries(byTarget)) {
        txt += `👤 *@${target.split('@')[0]}* — ${rList.length} report(s)\n`;
        for (const r of rList.slice(0, 3)) {
          txt += `   • _${r.reason}_ (${timeAgo(r.time)})\n`;
        }
        if (rList.length > 3) txt += `   _...aur ${rList.length - 3} aur_\n`;
        txt += '\n';
      }

      txt += `Use *.clearreports* to clear all.\n\n> 🤖 *AA MD Bot*`;
      return reply(txt);
    },
  },

  // ── .clearreports — admin clear kare ─────────────────────────────────────
  {
    command: 'clearreports',
    alias: ['delreports', 'resetreports'],
    description: 'Sab reports clear karo (admins only)',
    category: 'admin',
    groupOnly: true,
    adminOnly: true,

    async execute({ jid, reply }) {
      const reports = getReports(jid);
      const count = reports.length;
      if (!count) return reply(`📋 *Pehle se koi report nahi.*\n\n> 🤖 *AA MD Bot*`);
      reportStore.set(jid, []);
      return reply(`✅ *${count} report(s) clear ho gaye.*\n\n> 🤖 *AA MD Bot*`);
    },
  },
];
