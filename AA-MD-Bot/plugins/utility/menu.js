// ============================================
// AA MD Bot - Main Menu Plugin
// Developer: Ahsan Ali | AA Mods
// ============================================

import { plugins } from '../../lib/pluginLoader.js';
import config from '../../config.js';
import { db } from '../../lib/database.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BANNER_PATHS = [
  path.join(__dirname, '../../banner.jpeg'),
  path.join(__dirname, '../../banner.jpg'),
  path.join(__dirname, '../../assets/banner.jpg'),
];
function getBanner() {
  for (const p of BANNER_PATHS) {
    try { if (fs.existsSync(p)) return fs.readFileSync(p); } catch {}
  }
  return null;
}

const CHANNEL_URL  = 'https://whatsapp.com/channel/0029Vb8Yk2LL2AU78HliE617';
const CHANNEL_NAME = 'AA MD Bot';

function getCtx() {
  const newsletterJid = global._AA_NEWSLETTER_JID;
  if (newsletterJid) {
    return {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid,
        newsletterName: global._AA_NEWSLETTER_NAME || CHANNEL_NAME,
        serverMessageId: Math.floor(Math.random() * 99999) + 1,
      },
    };
  }
  const thumb = getBanner();
  return {
    forwardingScore: 999,
    isForwarded: true,
    externalAdReply: {
      title: CHANNEL_NAME,
      body: 'AA Mods • Tap to join our channel',
      mediaType: 1,
      renderLargerThumbnail: false,
      showAdAttribution: true,
      sourceUrl: CHANNEL_URL,
      ...(thumb ? { thumbnail: thumb } : {}),
    },
  };
}

const catEmoji = {
  islamic: '☪️', general: '📋', download: '📥',
  media: '🎬', search: '🔍', fun: '🎉', utility: '🔧',
  tools: '🛠️', group: '👥', admin: '🛡️', settings: '⚙️',
  owner: '👑', support: '📞', economy: '💰', level: '⭐', misc: '📌',
};

const CAT_ORDER = {
  islamic: 0, general: 1, download: 2, media: 3,
  search: 4, fun: 5, utility: 6, tools: 7, economy: 8,
  level: 9, group: 10, admin: 11, settings: 12, owner: 90, support: 99,
};

// Categories hidden from full menu (have their own sub-menu commands)
const SKIP_CATS  = new Set(['settings', 'ai']);
const OWNER_CATS = new Set(['owner']);

// Islamic shown only as a summary (has its own .islamicmenu)
const SUMMARY_CATS = new Set(['islamic']);

export default {
  command: 'menu',
  alias: ['help', 'commands', 'cmds'],
  description: 'Show all available commands',
  category: 'utility',
  usage: '.menu | .menu <category>',

  async execute({ sock, jid, msg, isOwner, args }) {
    const settings  = db.settings.get();
    const pushName  = msg.pushName || 'User';
    const pref      = (settings.prefix ?? config.prefix)[0] ?? '.';
    const mode      = (settings.botMode ?? config.botMode ?? 'public').toUpperCase();
    const role      = isOwner ? '👑 Owner' : '👤 User';

    const upSec = Math.floor(process.uptime());
    const upH   = Math.floor(upSec / 3600);
    const upM   = Math.floor((upSec % 3600) / 60);
    const upS   = upSec % 60;
    const uptime = upH > 0 ? `${upH}h ${upM}m` : upM > 0 ? `${upM}m ${upS}s` : `${upS}s`;
    const usedMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    // Deduplicate & categorise
    const seen       = new Set();
    const categories = {};
    for (const plugin of plugins.values()) {
      const fileKey = plugin.file || plugin.command;
      if (seen.has(fileKey)) continue;
      seen.add(fileKey);
      const cat     = (plugin.category || 'general').toLowerCase();
      const cmds    = [].concat(plugin.command);
      const aliases = [].concat(plugin.alias || []);
      const main    = cmds[0];
      const short   = aliases.find(a => a.length <= 4) || aliases[0] || null;
      const desc    = (plugin.description || '').slice(0, 32);
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push({ main, short, desc });
    }
    const totalCmds = seen.size;
    const contextInfo = getCtx();

    // ── Category-specific view ────────────────────────────
    if (args[0]) {
      const cat  = args[0].toLowerCase();
      const cmds = categories[cat];
      if (!cmds) {
        const list = Object.keys(categories).filter(c => !SKIP_CATS.has(c)).map(c => `${catEmoji[c] || '📌'} ${c}`).join('\n');
        return sock.sendMessage(jid,
          { text: `❌ Category *${cat}* not found.\n\n📦 *Available:*\n${list}`, contextInfo },
          { quoted: msg }
        );
      }
      const emoji = catEmoji[cat] || '📌';
      let text = `╔══════════════════════════════╗\n`;
      text    += `║  ${emoji} *${cat.toUpperCase()} COMMANDS*\n`;
      text    += `╚══════════════════════════════╝\n\n`;
      for (const { main, short, desc } of cmds) {
        const label = short ? `*${pref}${main}* / *${pref}${short}*` : `*${pref}${main}*`;
        text += `▸ ${label}${desc ? `\n  ╰ ${desc}` : ''}\n`;
      }
      text += `\n📢 ${CHANNEL_URL}`;
      return sock.sendMessage(jid, { text, contextInfo }, { quoted: msg });
    }

    // ── Full Menu ─────────────────────────────────────────
    const greeting = isOwner
      ? `🌟 *Assalamualaikum, Ahsan Bhai!* 🌟`
      : `✨ *Assalamualaikum, ${pushName}!* ✨`;

    let menu  = `╔══════════════════════════════╗\n`;
    menu     += `║   🤖 *AA MD Bot*  •  v3.0    ║\n`;
    menu     += `║  👨‍💻 *Ahsan Ali | AA Mods*   ║\n`;
    menu     += `╚══════════════════════════════╝\n\n`;
    menu     += `${greeting}\n\n`;

    menu += `┌───────── 📊 *BOT INFO* ─────────┐\n`;
    menu += `│ 🟢 Status    : *Online*\n`;
    menu += `│ ⏱️ Uptime    : *${uptime}*\n`;
    menu += `│ 💾 RAM       : *${usedMB} MB*\n`;
    menu += `│ 📦 Commands  : *${totalCmds}+*\n`;
    menu += `│ 🔑 Prefix    : *${pref}*\n`;
    menu += `│ 🤖 Mode      : *${mode}*\n`;
    menu += `│ ${role.split(' ')[0]} Role      : *${role}*\n`;
    menu += `└─────────────────────────────────┘\n`;

    const sorted = Object.entries(categories).sort(([a], [b]) =>
      (CAT_ORDER[a] ?? 50) - (CAT_ORDER[b] ?? 50) || a.localeCompare(b)
    );

    for (const [cat, cmds] of sorted) {
      if (SKIP_CATS.has(cat)) continue;
      if (OWNER_CATS.has(cat) && !isOwner) continue;

      const emoji = catEmoji[cat] || '📌';

      // Islamic: show short summary, refer to .islamicmenu
      if (SUMMARY_CATS.has(cat)) {
        menu += `\n╔═══ ${emoji} *ISLAMIC* (${cmds.length}) ═══\n`;
        menu += `│ ▸ *${pref}islamicmenu*  — Full Islamic menu\n`;
        menu += `│  Duas • Zikr • Hadith • Kalimas • Adhkar\n`;
        continue;
      }

      menu += `\n╔═══ ${emoji} *${cat.toUpperCase()}* (${cmds.length}) ═══\n`;
      for (const { main, short, desc } of cmds) {
        const label = short
          ? `*${pref}${main}* / *${pref}${short}*`
          : `*${pref}${main}*`;
        menu += `│ ▸ ${label}${desc ? ` — ${desc}` : ''}\n`;
      }
    }

    if (isOwner) {
      menu += `\n╔═══ ⚙️ *SETTINGS & OWNER* ═══\n`;
      menu += `│ ▸ *${pref}settings* / *${pref}bs*  — Bot settings panel\n`;
      menu += `│ ▸ *${pref}mode* public/private\n`;
      menu += `│ ▸ *${pref}anticall* on/off\n`;
      menu += `│ ▸ *${pref}antidelete* on/off\n`;
      menu += `│ ▸ *${pref}setprefix* <symbol>\n`;
      menu += `│ ▸ *${pref}setnewsletter* <jid>\n`;
    }

    menu += `\n╚══════════════════════════════╝\n`;
    menu += `📢 *Join: ${CHANNEL_URL}*\n`;
    menu += `💡 *${pref}menu <category>* for full category list`;

    const banner = getBanner();
    try {
      if (banner) {
        await sock.sendMessage(jid, {
          image: banner,
          caption: menu,
          mimetype: 'image/jpeg',
          contextInfo,
        }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: menu, contextInfo }, { quoted: msg });
      }
    } catch {
      await sock.sendMessage(jid, { text: menu, contextInfo }, { quoted: msg });
    }
  },
};
