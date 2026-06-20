// ============================================
// AA MD Bot - Menu Plugin
// Developer: Ahsan Ali | AA Mods
// ============================================

import { getCategories, plugins } from '../../lib/pluginLoader.js';
import config from '../../config.js';
import { db } from '../../lib/database.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BANNER_PATH = path.join(__dirname, '../../assets/banner.jpg');

const catEmoji = {
  general:  '📋', islamic:  '☪️', ai:       '🤖',
  download: '📥', media:    '🎬', search:   '🔍',
  fun:      '🎉', utility:  '🔧', tools:    '🛠️',
  group:    '👥', admin:    '🛡️', settings: '⚙️',
  owner:    '👑', support:  '📞', economy:  '💰',
  level:    '⭐', misc:     '📌',
};

const CAT_ORDER = {
  islamic: 0, general: 1, ai: 2, download: 3, media: 4,
  search: 5, fun: 6, utility: 7, tools: 8, economy: 9,
  level: 10, group: 11, admin: 12, settings: 13, owner: 90, support: 99,
};

const SKIP_CATS  = new Set(['settings']);
const OWNER_CATS = new Set(['owner']);

export default {
  command: 'menu',
  alias: ['help', 'commands', 'cmds'],
  description: 'Show all available commands',
  category: 'utility',
  usage: '.menu',

  async execute({ sock, jid, msg, isOwner, args }) {
    const settings  = db.settings.get();
    const pushName  = msg.pushName || 'User';
    const pref      = (settings.prefix ?? config.prefix)[0] ?? '.';
    const altPref   = (config.altPrefixes || []).join('  ');
    const mode      = (settings.botMode ?? config.botMode ?? 'public').toUpperCase();
    const role      = isOwner ? 'Owner 👑' : 'User';

    const upSec = Math.floor(process.uptime());
    const upH   = Math.floor(upSec / 3600);
    const upM   = Math.floor((upSec % 3600) / 60);
    const upS   = upSec % 60;
    const uptime = upH > 0
      ? `${upH}h ${upM}m ${upS}s`
      : upM > 0 ? `${upM}m ${upS}s` : `${upS}s`;

    const usedMB  = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    const totalMB = Math.round(os.totalmem() / 1024 / 1024);

    // Deduplicate & categorise plugins
    const seen       = new Set();
    const categories = {};
    for (const plugin of plugins.values()) {
      const fileKey = plugin.file || plugin.command;
      if (seen.has(fileKey)) continue;
      seen.add(fileKey);
      const cat  = (plugin.category || 'general').toLowerCase();
      const cmds = [].concat(plugin.command);
      const aliases = [].concat(plugin.alias || []);
      const main  = cmds[0];
      const short = aliases.find(a => a.length <= 4) || aliases[0] || null;
      const desc  = (plugin.description || '').slice(0, 35);
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push({ main, short, desc });
    }
    const totalCmds = seen.size;

    // Category-specific view
    if (args[0]) {
      const cat  = args[0].toLowerCase();
      const cmds = categories[cat];
      if (!cmds) return sock.sendMessage(jid,
        { text: `❌ Category *${cat}* not found.\n\nAvailable: ${Object.keys(categories).join(', ')}` },
        { quoted: msg }
      );
      let text = `${catEmoji[cat] || '📁'} *${cat.toUpperCase()} COMMANDS*\n━━━━━━━━━━━━━━━━━━\n`;
      for (const { main, short, desc } of cmds) {
        const label = short ? `*${pref}${main}* / *${pref}${short}*` : `*${pref}${main}*`;
        text += `  ${label}${desc ? ` — ${desc}` : ''}\n`;
      }
      text += `\n🌐 ${config.channelLink || 'https://aa-mods.vercel.app/'}`;
      return sock.sendMessage(jid, { text }, { quoted: msg });
    }

    // Full menu
    const greeting = isOwner
      ? `👋 *Assalamualaikum Owner!*`
      : `👋 *Assalamualaikum ${pushName}!*`;

    let menu =
      `${greeting}\n\n` +
      `━━━━━━ 📊 *Bot Status* ━━━━━━\n` +
      `🟢 Status    : Online\n` +
      `⏱️ Uptime    : ${uptime}\n` +
      `💾 RAM       : ${usedMB} MB / ${totalMB} MB\n` +
      `📦 Commands  : ${totalCmds}+\n` +
      `🔑 Prefix    : ${pref}${altPref ? `  |  Alt: ${altPref}` : ''}\n` +
      `🤖 Mode      : ${mode}\n` +
      `👑 Role      : ${role}\n`;

    const sorted = Object.entries(categories).sort(([a], [b]) =>
      (CAT_ORDER[a] ?? 50) - (CAT_ORDER[b] ?? 50) || a.localeCompare(b)
    );

    for (const [cat, cmds] of sorted) {
      if (SKIP_CATS.has(cat)) continue;
      if (OWNER_CATS.has(cat) && !isOwner) continue;
      const emoji = catEmoji[cat] || '📌';
      menu += `\n━━━━━━━━━━━━━━━━━━\n`;
      menu += `${emoji} *${cat.toUpperCase()}*\n`;
      for (const { main, short, desc } of cmds) {
        const label = short ? `*${pref}${main}* / *${pref}${short}*` : `*${pref}${main}*`;
        menu += `  ${label}${desc ? ` — ${desc}` : ''}\n`;
      }
    }

    // Quick settings (owner only)
    if (isOwner) {
      menu +=
        `\n━━━━━━━━━━━━━━━━━━\n` +
        `⚙️ *QUICK SETTINGS*\n` +
        `  *${pref}mode* public/private\n` +
        `  *${pref}anticall* on/off\n` +
        `  *${pref}antidelete* on/off\n` +
        `  *${pref}antiviewonce* on/off\n` +
        `  *${pref}statusview* on/off\n` +
        `  *${pref}statusreact* on/off\n` +
        `  *${pref}autostatus* on/off\n` +
        `  *${pref}setprefix* <symbol>\n` +
        `  *${pref}setnewsletter* <jid>\n`;
    }

    menu += `\n━━━━━━━━━━━━━━━━━━\n`;
    menu += `🌐 ${config.channelLink || 'https://aa-mods.vercel.app/'}`;

    try {
      if (fs.existsSync(BANNER_PATH)) {
        await sock.sendMessage(jid, {
          image: fs.readFileSync(BANNER_PATH),
          caption: menu,
          mimetype: 'image/jpeg',
        }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: menu }, { quoted: msg });
      }
    } catch {
      await sock.sendMessage(jid, { text: menu }, { quoted: msg });
    }
  },
};
