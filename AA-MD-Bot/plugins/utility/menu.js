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

// Banner image - look in bot root first, then artifact public
const BANNER_PATHS = [
  path.join(__dirname, '../../banner.jpeg'),
  path.join(__dirname, '../../banner.jpg'),
  path.join(__dirname, '../../assets/banner.jpg'),
  path.join(__dirname, '../../assets/banner.jpeg'),
];

function getBanner() {
  for (const p of BANNER_PATHS) {
    try { if (fs.existsSync(p)) return fs.readFileSync(p); } catch {}
  }
  return null;
}

const CHANNEL_URL = 'https://whatsapp.com/channel/0029Vb8Yk2LL2AU78HliE617';
const CHANNEL_NAME = 'AA MD Bot';

// Build the "View Channel" contextInfo — uses newsletter JID if set, else externalAdReply
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
  islamic: '☪️', general: '📋', ai: '🤖', download: '📥',
  media: '🎬', search: '🔍', fun: '🎉', utility: '🔧',
  tools: '🛠️', group: '👥', admin: '🛡️', settings: '⚙️',
  owner: '👑', support: '📞', economy: '💰', level: '⭐', misc: '📌',
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
    const settings = db.settings.get();
    const pushName = msg.pushName || 'User';
    const pref     = (settings.prefix ?? config.prefix)[0] ?? '.';
    const mode     = (settings.botMode ?? config.botMode ?? 'public').toUpperCase();
    const role     = isOwner ? '👑 Owner' : '👤 User';

    const upSec = Math.floor(process.uptime());
    const upH   = Math.floor(upSec / 3600);
    const upM   = Math.floor((upSec % 3600) / 60);
    const upS   = upSec % 60;
    const uptime = upH > 0
      ? `${upH}h ${upM}m ${upS}s`
      : upM > 0 ? `${upM}m ${upS}s` : `${upS}s`;

    const usedMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

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
      const main   = cmds[0];
      const short  = aliases.find(a => a.length <= 4) || aliases[0] || null;
      const desc   = (plugin.description || '').slice(0, 32);
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push({ main, short, desc });
    }
    const totalCmds = seen.size;

    const contextInfo = getCtx();

    // ── Category-specific view (.menu download) ──────────
    if (args[0]) {
      const cat  = args[0].toLowerCase();
      const cmds = categories[cat];
      if (!cmds) {
        return sock.sendMessage(jid,
          { text: `❌ Category *${cat}* not found.\n\nAvailable:\n${Object.keys(categories).map(c => `${catEmoji[c]||'📌'} ${c}`).join('\n')}`, contextInfo },
          { quoted: msg }
        );
      }
      const emoji = catEmoji[cat] || '📌';
      let text = `╔══════════════════════════════╗\n`;
      text    += `║  ${emoji} *${cat.toUpperCase()} COMMANDS*\n`;
      text    += `╚══════════════════════════════╝\n\n`;
      for (const { main, short, desc } of cmds) {
        const label = short
          ? `${pref}${main} / ${pref}${short}`
          : `${pref}${main}`;
        text += `▸ *${label}*${desc ? `\n  ╰ ${desc}` : ''}\n`;
      }
      text += `\n📢 ${CHANNEL_URL}`;
      return sock.sendMessage(jid, { text, contextInfo }, { quoted: msg });
    }

    // ── Full Menu ─────────────────────────────────────────
    const greeting = isOwner
      ? `🌟 *Assalamualaikum Ahsan Bhai!* 🌟`
      : `✨ *Assalamualaikum ${pushName}!* ✨`;

    // Header
    let menu = `╔══════════════════════════════╗\n`;
    menu    += `║   🤖  *AA MD Bot*  •  v3.0   ║\n`;
    menu    += `║   👨‍💻 *Ahsan Ali | AA Mods*  ║\n`;
    menu    += `╚══════════════════════════════╝\n\n`;
    menu    += `${greeting}\n\n`;

    // Bot Status
    menu += `┌─────── 📊 *BOT STATUS* ───────┐\n`;
    menu += `│ 🟢 Status   : Online\n`;
    menu += `│ ⏱️ Uptime   : ${uptime}\n`;
    menu += `│ 💾 RAM      : ${usedMB} MB\n`;
    menu += `│ 📦 Commands : ${totalCmds}+\n`;
    menu += `│ 🔑 Prefix   : ${pref}\n`;
    menu += `│ 🤖 Mode     : ${mode}\n`;
    menu += `│ 👤 Role     : ${role}\n`;
    menu += `└───────────────────────────────┘\n`;

    // Sort and build categories
    const sorted = Object.entries(categories).sort(([a], [b]) =>
      (CAT_ORDER[a] ?? 50) - (CAT_ORDER[b] ?? 50) || a.localeCompare(b)
    );

    for (const [cat, cmds] of sorted) {
      if (SKIP_CATS.has(cat)) continue;
      if (OWNER_CATS.has(cat) && !isOwner) continue;

      const emoji = catEmoji[cat] || '📌';
      menu += `\n╔═══ ${emoji} *${cat.toUpperCase()}* (${cmds.length}) ═══\n`;
      for (const { main, short, desc } of cmds) {
        const label = short
          ? `*${pref}${main}* / *${pref}${short}*`
          : `*${pref}${main}*`;
        menu += `│ ▸ ${label}${desc ? ` — ${desc}` : ''}\n`;
      }
    }

    // Owner quick settings
    if (isOwner) {
      menu += `\n╔═══ ⚙️ *QUICK SETTINGS* ═══\n`;
      menu += `│ ▸ *${pref}mode* public/private\n`;
      menu += `│ ▸ *${pref}anticall* on/off\n`;
      menu += `│ ▸ *${pref}antidelete* on/off\n`;
      menu += `│ ▸ *${pref}antiviewonce* on/off\n`;
      menu += `│ ▸ *${pref}statusview* on/off\n`;
      menu += `│ ▸ *${pref}statusreact* on/off\n`;
      menu += `│ ▸ *${pref}autostatus* on/off\n`;
      menu += `│ ▸ *${pref}setprefix* <symbol>\n`;
      menu += `│ ▸ *${pref}setnewsletter* <jid>\n`;
    }

    // Footer
    menu += `\n╚══════════════════════════════╝\n`;
    menu += `📢 *Join our WhatsApp Channel*\n`;
    menu += `${CHANNEL_URL}\n`;
    menu += `╚══════════════════════════════╝`;

    // Send with banner image + contextInfo (View Channel button)
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
