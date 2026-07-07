// ============================================
// AA MD Bot - Menu
// Clean, duplicate-free, role-aware menu
// Owner-control commands hidden from public
// ============================================

import { plugins } from '../../lib/pluginLoader.js';
import config from '../../config.js';
import { db } from '../../lib/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Banner ────────────────────────────────────────────────────────────────────
const BANNER_PATHS = [
  path.join(__dirname, '../../banner.jpeg'),
  path.join(__dirname, '../../banner.jpg'),
];
function getBanner() {
  for (const p of BANNER_PATHS) {
    try { if (fs.existsSync(p)) return fs.readFileSync(p); } catch {}
  }
  return null;
}

// ── Newsletter context ────────────────────────────────────────────────────────
function getCtx() {
  const jid = global._AA_NEWSLETTER_JID;
  if (!jid) return null;
  return {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: jid,
      newsletterName: global._AA_NEWSLETTER_NAME || 'AA MD Bot',
      serverMessageId: Math.floor(Math.random() * 99999) + 1,
    },
  };
}

// ── Config ────────────────────────────────────────────────────────────────────
const FOOTER = `\n> 🌐 *https://aa-mods.vercel.app/*\n> 🤖 *AA MD Bot*  •  👨‍💻 *Ahsan Ali Wadani*`;

// Categories to skip entirely in public menu
const SKIP = new Set(['owner', 'settings', 'ai']);
// GB commands that are owner-only (personal bot settings)
const GB_OWNER_CMDS = new Set(['afk','alwaysonline','autoread','autoreply','flood','ghost','onlinealert','typing','autoreact','anticall','antispam']);
// Tools commands that are owner-only
const TOOLS_OWNER_CMDS = new Set(['backup','dbstats','logs','reload','speedtest','system','memory']);

// Category display config: emoji, display name, max commands shown
const CAT_CFG = {
  download:  { e: '⬇️',  n: 'DOWNLOADS',     max: 10 },
  search:    { e: '🔍',  n: 'SEARCH & AI',    max: 10 },
  media:     { e: '🎨',  n: 'MEDIA',          max: 10 },
  fun:       { e: '🎮',  n: 'FUN & GAMES',    max: 12 },
  economy:   { e: '💰',  n: 'ECONOMY',        max: 8  },
  level:     { e: '⭐',  n: 'LEVEL & XP',     max: 5  },
  group:     { e: '👥',  n: 'GROUP',          max: 10 },
  admin:     { e: '🛡️', n: 'GROUP ADMIN',    max: 10 },
  tools:     { e: '🔧',  n: 'TOOLS',          max: 8  },
  utility:   { e: '🛠️', n: 'UTILITY',        max: 10 },
  gb:        { e: '📱',  n: 'GB FEATURES',    max: 6  },
  islamic:   { e: '☪️',  n: 'ISLAMIC',        max: 0  }, // summary only
  general:   { e: '📋',  n: 'GENERAL',        max: 8  },
};
const CAT_ORDER = ['download','search','media','fun','economy','level','group','admin','tools','utility','gb','islamic'];

// ── Greeting ──────────────────────────────────────────────────────────────────
function greet() {
  const h = new Date().getUTCHours() + 5; // PKT offset
  if (h < 6 || h >= 20) return '🌙 Assalamualaikum';
  if (h < 12) return '🌅 Assalamualaikum';
  if (h < 17) return '☀️  Assalamualaikum';
  return '🌆 Assalamualaikum';
}

// ── Build the plugin list deduplicated and role-filtered ──────────────────────
function buildCategoryMap(isOwner, isSuperOwnerUser) {
  const seen = new Set();     // by command name (main command)
  const catMap = {};

  for (const plugin of plugins.values()) {
    const mainCmd = Array.isArray(plugin.command) ? plugin.command[0] : plugin.command;
    if (!mainCmd) continue;
    if (seen.has(mainCmd)) continue;
    seen.add(mainCmd);

    const cat = (plugin.category || 'general').toLowerCase();
    if (SKIP.has(cat)) continue;

    // Skip superOwner-only commands for non-superOwner users
    if (plugin.superOwnerOnly && !isSuperOwnerUser) continue;

    // Skip ownerOnly commands in GB and Tools for non-owners — they belong in owner section
    if (!isOwner) {
      if (plugin.ownerOnly) continue; // don't show any ownerOnly cmd in public menu
      if (cat === 'gb' && GB_OWNER_CMDS.has(mainCmd)) continue;
      if (cat === 'tools' && TOOLS_OWNER_CMDS.has(mainCmd)) continue;
    }

    if (!catMap[cat]) catMap[cat] = [];
    catMap[cat].push({
      cmd: mainCmd,
      desc: (plugin.description || '').slice(0, 38),
      ownerOnly: !!plugin.ownerOnly,
      superOnly: !!plugin.superOwnerOnly,
    });
  }

  return catMap;
}

// ── Render a category box ─────────────────────────────────────────────────────
function renderCat(emoji, label, cmds, pref, max) {
  const shown = max > 0 ? cmds.slice(0, max) : cmds;
  const more  = cmds.length - shown.length;

  let box = `\n╭── ${emoji}  *${label}*  (${cmds.length})\n`;
  for (const { cmd, desc } of shown) {
    const d = desc ? `  _${desc}_` : '';
    box += `│  ▸ *${pref}${cmd}*${d}\n`;
  }
  if (more > 0) {
    box += `│  _+${more} more — *${pref}menu ${label.toLowerCase().replace(/ .*/,'')}*_\n`;
  }
  box += `╰${'─'.repeat(30)}\n`;
  return box;
}

// ── Single-category detail view ───────────────────────────────────────────────
function renderCatDetail(cat, cmds, pref, isSuperOwnerUser) {
  const cfg = CAT_CFG[cat] || { e: '📌', n: cat.toUpperCase() };
  let text = `╔════════════════════════════════╗\n`;
  text    += `║  ${cfg.e}  *${cfg.n} COMMANDS*\n`;
  text    += `╚════════════════════════════════╝\n`;
  for (const { cmd, desc, superOnly } of cmds) {
    if (superOnly && !isSuperOwnerUser) continue;
    text += `\n▸ *${pref}${cmd}*`;
    if (desc) text += `\n  ╰ _${desc}_`;
  }
  text += `\n\n> 💡 *${pref}menu* — back to main menu`;
  return text;
}

export default {
  command: 'menu',
  alias: ['help', 'commands', 'cmds'],
  description: 'Show all available commands',
  category: 'utility',
  usage: '.menu | .menu <category>',

  async execute({ sock, jid, msg, isOwner, args, senderJid }) {
    const settings = db.settings.get();
    const pushName = msg.pushName || 'User';
    const pref     = (settings.prefix ?? config.prefix)?.[0] ?? '.';
    const mode     = (settings.botMode ?? config.botMode ?? 'public').toUpperCase();
    const isSuperOwnerUser = senderJid?.split('@')[0]?.split(':')[0] === config.superOwner;
    const role = isSuperOwnerUser ? '👑 Super Owner' : isOwner ? '🔑 Owner' : '👤 User';

    const upSec = Math.floor(process.uptime());
    const upH   = Math.floor(upSec / 3600);
    const upM   = Math.floor((upSec % 3600) / 60);
    const uptime = upH > 0 ? `${upH}h ${upM}m` : `${upM}m ${upSec % 60}s`;
    const usedMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    const catMap    = buildCategoryMap(isOwner, isSuperOwnerUser);
    const totalCmds = Object.values(catMap).reduce((s, a) => s + a.length, 0);
    const ctx       = getCtx();

    // ── Single-category detail view ───────────────────────────────────────────
    if (args[0]) {
      const key = args[0].toLowerCase();
      // Try matching by keyword
      const matched = CAT_ORDER.find(c => c.startsWith(key)) || key;
      const cmds    = catMap[matched];

      if (!cmds?.length) {
        const list = CAT_ORDER
          .filter(c => catMap[c]?.length)
          .map(c => `  ${(CAT_CFG[c] || {}).e || '📌'} *${c}*  (${catMap[c].length})`)
          .join('\n');
        const payload = { text: `❌ Category *"${key}"* not found.\n\n📦 *Available:*\n${list}${FOOTER}` };
        if (ctx) payload.contextInfo = ctx;
        return sock.sendMessage(jid, payload, { quoted: msg });
      }

      const cfg  = CAT_CFG[matched] || { e: '📌', n: matched.toUpperCase() };
      let detail = renderCatDetail(matched, cmds, pref, isSuperOwnerUser);
      detail    += FOOTER;
      const payload = { text: detail };
      if (ctx) payload.contextInfo = ctx;
      return sock.sendMessage(jid, payload, { quoted: msg });
    }

    // ── Full menu ─────────────────────────────────────────────────────────────
    const greeting = isSuperOwnerUser
      ? `👑 *${greet()}, Ahsan Bhai!*\n_Super Owner — Full Access_`
      : isOwner
        ? `🔑 *${greet()}, Owner!*\n_Bot control active_`
        : `✨ *${greet()}, ${pushName}!*\n_Welcome to AA MD Bot_`;

    let menu = '';

    // ── Header ────────────────────────────────────────────────────────────────
    menu += `╔══════════════════════════════════╗\n`;
    menu += `║  🤖  *A A   M D   B O T*         ║\n`;
    menu += `║  👨‍💻  Ahsan Ali Wadani | AA Mods  ║\n`;
    menu += `╚══════════════════════════════════╝\n\n`;
    menu += `${greeting}\n`;

    // ── Status ────────────────────────────────────────────────────────────────
    menu += `\n╭── 📊  *STATUS*\n`;
    menu += `│  🟢 Online  •  ⏱️ ${uptime}  •  💾 ${usedMB}MB\n`;
    menu += `│  🔑 Prefix: *${pref}*   •  🔀 *${mode}*   •  🎭 ${role}\n`;
    menu += `│  📦 *${totalCmds}* commands available\n`;
    menu += `╰${'─'.repeat(30)}\n`;

    // ── Public categories ─────────────────────────────────────────────────────
    const orderedCats = [
      ...CAT_ORDER.filter(c => catMap[c]?.length),
      ...Object.keys(catMap).filter(c => !CAT_ORDER.includes(c) && catMap[c]?.length),
    ];

    for (const cat of orderedCats) {
      const cmds = catMap[cat];
      if (!cmds?.length) continue;

      const cfg = CAT_CFG[cat] || { e: '📌', n: cat.toUpperCase(), max: 8 };

      // Islamic — summary only
      if (cat === 'islamic') {
        menu += `\n╭── ☪️  *ISLAMIC*  (${cmds.length})\n`;
        menu += `│  ▸ *${pref}islamicmenu* — Full Islamic panel\n`;
        menu += `│  _Duas • Zikr • Hadith • Kalimas • Adhkar_\n`;
        menu += `╰${'─'.repeat(30)}\n`;
        continue;
      }

      menu += renderCat(cfg.e, cfg.n, cmds, pref, cfg.max || 8);
    }

    // ── Owner Quick-Access (only for owners) ───────────────────────────────
    if (isOwner) {
      menu += `\n╭── ⚙️  *OWNER TOOLS*\n`;
      menu += `│  ▸ *${pref}bs*           — Bot settings panel\n`;
      menu += `│  ▸ *${pref}mode*         — public / private\n`;
      menu += `│  ▸ *${pref}setprefix*    — Change command prefix\n`;
      menu += `│  ▸ *${pref}afk* <reason> — Go AFK\n`;
      menu += `│  ▸ *${pref}ghost*        — Appear offline\n`;
      menu += `│  ▸ *${pref}autoread*     — Auto blue ticks\n`;
      menu += `│  ▸ *${pref}anticall*     — Block calls\n`;
      menu += `│  ▸ *${pref}antiviewonce on/off* — Reveal view-once\n`;
      menu += `│  ▸ *${pref}avv*          — Manually reveal view-once\n`;
      if (isSuperOwnerUser) {
        menu += `│\n`;
        menu += `│  👑 *${pref}smenu* — Super Owner control panel\n`;
      }
      menu += `╰${'─'.repeat(30)}\n`;
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    menu += `\n> 💡 *${pref}menu <category>* — view full category\n`;
    menu += `> ☪️ *${pref}islamicmenu* — Islamic commands\n`;
    if (isOwner) menu += `> 📱 *${pref}gbmenu* — GB features panel\n`;
    menu += FOOTER;

    // Send with banner image if available
    const banner  = getBanner();
    const payload = banner
      ? { image: banner, caption: menu, mimetype: 'image/jpeg' }
      : { text: menu };
    if (ctx) payload.contextInfo = ctx;

    try {
      await sock.sendMessage(jid, payload, { quoted: msg });
    } catch {
      const fallback = { text: menu };
      if (ctx) fallback.contextInfo = ctx;
      await sock.sendMessage(jid, fallback, { quoted: msg });
    }
  },
};
