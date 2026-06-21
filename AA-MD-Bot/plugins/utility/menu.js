import { plugins } from '../../lib/pluginLoader.js';
import config from '../../config.js';
import { db } from '../../lib/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const CAT_EMOJI = {
  islamic: '☪️', general: '📋', download: '⬇️', media: '🎬',
  search: '🔍', fun: '🎮', utility: '🔧', tools: '🛠️',
  group: '👥', admin: '🛡️', economy: '💰', level: '⭐',
  owner: '👑', support: '📞', misc: '📌',
};

const CAT_ORDER = {
  islamic: 0, download: 1, media: 2, search: 3, fun: 4,
  utility: 5, tools: 6, economy: 7, level: 8, group: 9,
  admin: 10, owner: 90,
};

const SKIP_CATS   = new Set(['settings', 'ai']);
const OWNER_CATS  = new Set(['owner']);
const SUMMARY_CATS= new Set(['islamic']);

const WATERMARK = `\n\n> 🌐 *https://aa-mods.vercel.app/*\n> 🤖 *Powered by AA MD Bot*\n> 👨‍💻 *Developed by Ahsan Ali Wadani*`;

function getGreeting() {
  const h = new Date().getUTCHours() + 5; // PKT = UTC+5
  if (h < 12) return '🌅 *Assalamualaikum!*';
  if (h < 17) return '☀️ *Assalamualaikum!*';
  if (h < 20) return '🌆 *Assalamualaikum!*';
  return '🌙 *Assalamualaikum!*';
}

export default {
  command: 'menu',
  alias: ['help', 'commands', 'cmds'],
  description: 'Show all available commands',
  category: 'utility',
  usage: '.menu | .menu <category>',

  async execute({ sock, jid, msg, isOwner, args, senderJid }) {
    const settings  = db.settings.get();
    const pushName  = msg.pushName || 'User';
    const pref      = (settings.prefix ?? config.prefix)[0] ?? '.';
    const mode      = (settings.botMode ?? config.botMode ?? 'public').toUpperCase();
    const isSuperOwnerUser = senderJid?.split('@')[0]?.split(':')[0] === config.superOwner;
    const role = isSuperOwnerUser ? '👑 Super Owner' : isOwner ? '🔑 Owner' : '👤 User';

    const upSec = Math.floor(process.uptime());
    const upH   = Math.floor(upSec / 3600);
    const upM   = Math.floor((upSec % 3600) / 60);
    const upS   = upSec % 60;
    const uptime = upH > 0 ? `${upH}h ${upM}m` : upM > 0 ? `${upM}m ${upS}s` : `${upS}s`;
    const usedMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    // Deduplicate & categorise
    const seen = new Set();
    const categories = {};
    for (const plugin of plugins.values()) {
      const fileKey = plugin.file || plugin.command;
      if (seen.has(fileKey)) continue;
      seen.add(fileKey);
      const cat   = (plugin.category || 'general').toLowerCase();
      const cmds  = [].concat(plugin.command);
      const alias = [].concat(plugin.alias || []);
      const main  = cmds[0];
      const short = alias.find(a => a.length <= 5) || alias[0] || null;
      const desc  = (plugin.description || '').slice(0, 40);
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push({ main, short, desc, superOnly: plugin.superOwnerOnly });
    }
    const totalCmds = seen.size;
    const ctx = getCtx();

    // ── Category-specific view ────────────────────────────
    if (args[0]) {
      const cat  = args[0].toLowerCase();
      const cmds = categories[cat];
      if (!cmds) {
        const list = Object.keys(categories)
          .filter(c => !SKIP_CATS.has(c))
          .sort((a,b) => (CAT_ORDER[a]??50)-(CAT_ORDER[b]??50))
          .map(c => `  ${CAT_EMOJI[c]||'📌'} *${c}*  (${categories[c].length} cmds)`)
          .join('\n');
        const txt = `❌ *"${cat}"* category not found.\n\n📦 *Available Categories:*\n\n${list}${WATERMARK}`;
        const payload = { text: txt };
        if (ctx) payload.contextInfo = ctx;
        return sock.sendMessage(jid, payload, { quoted: msg });
      }
      const emoji = CAT_EMOJI[cat] || '📌';
      let text = `╔══════════════════════════════╗\n`;
      text    += `║  ${emoji} *${cat.toUpperCase()} COMMANDS*\n`;
      text    += `╚══════════════════════════════╝\n\n`;
      for (const { main, short, desc, superOnly } of cmds) {
        if (superOnly && !isSuperOwnerUser) continue;
        const label = short ? `*${pref}${main}* | *${pref}${short}*` : `*${pref}${main}*`;
        const lock  = superOnly ? ' 🔐' : '';
        text += `▸ ${label}${lock}\n`;
        if (desc) text += `  ╰ _${desc}_\n`;
      }
      text += `\n> 💡 *${pref}menu* — Back to full menu`;
      text += WATERMARK;
      const payload = { text };
      if (ctx) payload.contextInfo = ctx;
      return sock.sendMessage(jid, payload, { quoted: msg });
    }

    // ── Full Menu ─────────────────────────────────────────
    const greeting = isSuperOwnerUser
      ? `🌟 *Assalamualaikum, Ahsan Bhai!*\n👑 _Super Owner — Full Access_`
      : isOwner
        ? `🔑 *Assalamualaikum, Owner!*\n_Bot control access active_`
        : `${getGreeting()}\n✨ *${pushName}*, welcome to AA MD Bot!`;

    let menu = '';
    menu += `╔══════════════════════════════════╗\n`;
    menu += `║   🤖  *A A   M D   B O T*        ║\n`;
    menu += `║   👨‍💻  Ahsan Ali Wadani | AA Mods  ║\n`;
    menu += `║   🌐  aa-mods.vercel.app          ║\n`;
    menu += `╚══════════════════════════════════╝\n\n`;

    menu += `${greeting}\n\n`;

    menu += `┌─────────────────────────────────\n`;
    menu += `│  📊 *BOT STATUS*\n`;
    menu += `├─────────────────────────────────\n`;
    menu += `│  🟢 Status    :  *Online ✓*\n`;
    menu += `│  ⏱️  Uptime    :  *${uptime}*\n`;
    menu += `│  💾 RAM       :  *${usedMB} MB*\n`;
    menu += `│  📦 Commands  :  *${totalCmds}+*\n`;
    menu += `│  🔑 Prefix    :  *${pref}*\n`;
    menu += `│  🔀 Mode      :  *${mode}*\n`;
    menu += `│  🎭 Role      :  *${role}*\n`;
    menu += `└─────────────────────────────────\n\n`;

    const sorted = Object.entries(categories).sort(([a],[b]) =>
      (CAT_ORDER[a]??50) - (CAT_ORDER[b]??50) || a.localeCompare(b)
    );

    menu += `┌─────────────────────────────────\n`;
    menu += `│  📚 *COMMAND CATEGORIES*\n`;
    menu += `├─────────────────────────────────\n`;

    for (const [cat, cmds] of sorted) {
      if (SKIP_CATS.has(cat)) continue;
      if (OWNER_CATS.has(cat) && !isOwner) continue;

      const emoji = CAT_EMOJI[cat] || '📌';
      const visibleCmds = cmds.filter(c => !c.superOnly || isSuperOwnerUser);
      if (!visibleCmds.length) continue;

      if (SUMMARY_CATS.has(cat)) {
        menu += `│\n│  ${emoji} *ISLAMIC*  (${visibleCmds.length})\n`;
        menu += `│    ▸ *${pref}islamicmenu* — Full Islamic panel\n`;
        menu += `│    _Duas • Zikr • Hadith • Kalimas • Adhkar_\n`;
        continue;
      }

      menu += `│\n│  ${emoji} *${cat.toUpperCase()}*  (${visibleCmds.length})\n`;
      for (const { main, short, desc } of visibleCmds.slice(0, 8)) {
        const label = short ? `*${pref}${main}*/*${pref}${short}*` : `*${pref}${main}*`;
        const d = desc ? ` — _${desc.slice(0,28)}_` : '';
        menu += `│    ▸ ${label}${d}\n`;
      }
      if (visibleCmds.length > 8) {
        menu += `│    _...and ${visibleCmds.length - 8} more → *${pref}menu ${cat}*_\n`;
      }
    }
    menu += `└─────────────────────────────────\n\n`;

    if (isOwner) {
      menu += `┌─────────────────────────────────\n`;
      menu += `│  ⚙️  *OWNER SETTINGS*\n`;
      menu += `├─────────────────────────────────\n`;
      menu += `│  ▸ *${pref}bs*          — Bot settings panel\n`;
      menu += `│  ▸ *${pref}mode*        — public / private\n`;
      menu += `│  ▸ *${pref}autoread*    — Blue ticks toggle\n`;
      menu += `│  ▸ *${pref}autoreact*   — Auto emoji react\n`;
      menu += `│  ▸ *${pref}anticall*    — Block incoming calls\n`;
      menu += `│  ▸ *${pref}antispam*    — Anti-spam filter\n`;
      menu += `│  ▸ *${pref}setprefix*   — Change prefix\n`;
      menu += `└─────────────────────────────────\n\n`;
    }

    if (isSuperOwnerUser) {
      menu += `┌─────────────────────────────────\n`;
      menu += `│  👑 *SUPER OWNER TOOLS* 🔐\n`;
      menu += `├─────────────────────────────────\n`;
      menu += `│  ▸ *${pref}smenu*       — Dev control panel\n`;
      menu += `│  ▸ *${pref}maintenance* — Lock bot\n`;
      menu += `│  ▸ *${pref}broadcast*   — Blast to all groups\n`;
      menu += `│  ▸ *${pref}eval*        — Run JS code\n`;
      menu += `│  ▸ *${pref}shell*       — Run shell cmd\n`;
      menu += `│  ▸ *${pref}restart*     — Reboot bot\n`;
      menu += `└─────────────────────────────────\n\n`;
    }

    menu += `> 💡 *${pref}menu <category>* — Detailed category view\n`;
    menu += `> 📢 *${pref}setnewsletter* — Enable View Channel button`;
    menu += WATERMARK;

    const banner = getBanner();
    const payload = banner
      ? { image: banner, caption: menu, mimetype: 'image/jpeg' }
      : { text: menu };
    if (ctx) payload.contextInfo = ctx;

    try {
      await sock.sendMessage(jid, payload, { quoted: msg });
    } catch {
      await sock.sendMessage(jid, { text: menu, ...(ctx ? { contextInfo: ctx } : {}) }, { quoted: msg });
    }
  },
};
