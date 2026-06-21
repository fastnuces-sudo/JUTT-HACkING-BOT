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
  islamic: '☪️', general: '📋', download: '📥', media: '🎬',
  search: '🔍', fun: '🎉', utility: '🔧', tools: '🛠️',
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

const DIV  = '─────────────────────────────────';
const SDIV = '─────────────────────';

const WATERMARK = `\n\n> 🌐 https://aa-mods.vercel.app/\n> 🤖 *Powered by AA MD Bot*\n> 👨‍💻 *Developed by Ahsan Ali Wadani*`;

export default {
  command: 'menu',
  alias: ['help', 'commands', 'cmds'],
  description: 'Show all available commands',
  category: 'utility',
  usage: '.menu | .menu <category>',

  async execute({ sock, jid, msg, isOwner, isSudo, args, senderJid }) {
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
      const desc  = (plugin.description || '').slice(0, 35);
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
          .map(c => `  ${CAT_EMOJI[c]||'📌'} *${c}* (${categories[c].length})`)
          .join('\n');
        const payload = { text: `❌ Category *${cat}* not found.\n\n📦 *Available categories:*\n${list}${WATERMARK}` };
        if (ctx) payload.contextInfo = ctx;
        return sock.sendMessage(jid, payload, { quoted: msg });
      }
      const emoji = CAT_EMOJI[cat] || '📌';
      let text = `${emoji} *${cat.toUpperCase()} COMMANDS*\n${DIV}\n\n`;
      for (const { main, short, desc, superOnly } of cmds) {
        if (superOnly && !isSuperOwnerUser) continue;
        const label = short ? `*${pref}${main}* / *${pref}${short}*` : `*${pref}${main}*`;
        const lock  = superOnly ? ' 🔐' : '';
        text += `▸ ${label}${lock}${desc ? `\n  ╰ _${desc}_` : ''}\n`;
      }
      text += `\n${DIV}`;
      text += WATERMARK;
      const payload = { text };
      if (ctx) payload.contextInfo = ctx;
      return sock.sendMessage(jid, payload, { quoted: msg });
    }

    // ── Full Menu ─────────────────────────────────────────
    const greeting = isSuperOwnerUser
      ? `🌟 *Assalamualaikum, Ahsan Bhai!*\n👑 _Super Owner access active_`
      : isOwner
        ? `🔑 *Assalamualaikum, Owner!* Welcome Back`
        : `✨ *Assalamualaikum, ${pushName}!*`;

    let menu = `🤖 *AA MD BOT*  v${config.version}\n`;
    menu    += `👨‍💻 *Ahsan Ali Wadani* | AA Mods\n`;
    menu    += `${DIV}\n\n`;
    menu    += `${greeting}\n\n`;

    menu += `📊 *BOT STATUS*\n${SDIV}\n`;
    menu += `🟢 Status   : *Online*\n`;
    menu += `⏱️  Uptime   : *${uptime}*\n`;
    menu += `💾 RAM      : *${usedMB} MB*\n`;
    menu += `📦 Commands : *${totalCmds}+*\n`;
    menu += `🔑 Prefix   : *${pref}*\n`;
    menu += `🔀 Mode     : *${mode}*\n`;
    menu += `🎭 Role     : *${role}*\n`;

    const sorted = Object.entries(categories).sort(([a],[b]) =>
      (CAT_ORDER[a]??50) - (CAT_ORDER[b]??50) || a.localeCompare(b)
    );

    for (const [cat, cmds] of sorted) {
      if (SKIP_CATS.has(cat)) continue;
      if (OWNER_CATS.has(cat) && !isOwner) continue;

      const emoji = CAT_EMOJI[cat] || '📌';
      const visibleCmds = cmds.filter(c => !c.superOnly || isSuperOwnerUser);
      if (!visibleCmds.length) continue;

      if (SUMMARY_CATS.has(cat)) {
        menu += `\n${SDIV}\n${emoji} *ISLAMIC* (${visibleCmds.length})\n`;
        menu += `  ▸ *${pref}islamicmenu* — Full Islamic panel\n`;
        menu += `  _Duas • Zikr • Hadith • Kalimas • Adhkar_\n`;
        continue;
      }

      menu += `\n${SDIV}\n${emoji} *${cat.toUpperCase()}* (${visibleCmds.length})\n`;
      for (const { main, short, desc, superOnly } of visibleCmds) {
        const label = short ? `*${pref}${main}*/*${pref}${short}*` : `*${pref}${main}*`;
        menu += `  ▸ ${label}${desc ? ` — _${desc.slice(0,28)}_` : ''}\n`;
      }
    }

    if (isOwner) {
      menu += `\n${SDIV}\n⚙️ *SETTINGS*\n`;
      menu += `  ▸ *${pref}bs* — Full bot settings panel\n`;
      menu += `  ▸ *${pref}mode* public/private\n`;
      menu += `  ▸ *${pref}anticall* on/off\n`;
      menu += `  ▸ *${pref}antispam* on/off\n`;
      menu += `  ▸ *${pref}setprefix* <symbol>\n`;
    }

    if (isSuperOwnerUser) {
      menu += `\n${SDIV}\n👑 *SUPER OWNER TOOLS* 🔐\n`;
      menu += `  ▸ *${pref}smenu* — Full dev control panel\n`;
      menu += `  ▸ *${pref}maintenance* on/off\n`;
      menu += `  ▸ *${pref}broadcast* [msg]\n`;
      menu += `  ▸ *${pref}eval* [code]\n`;
      menu += `  ▸ *${pref}shell* [cmd]\n`;
      menu += `  ▸ *${pref}restart* — Reboot bot\n`;
    }

    menu += `\n${DIV}\n`;
    menu += `💡 *${pref}menu <category>* — Category detail\n`;
    menu += `💡 *${pref}smenu* — Super owner panel`;
    menu += WATERMARK;

    const banner = getBanner();
    const payload = banner
      ? { image: banner, caption: menu, mimetype: 'image/jpeg' }
      : { text: menu };
    if (ctx) payload.contextInfo = ctx;

    try {
      await sock.sendMessage(jid, payload, { quoted: msg });
    } catch {
      await sock.sendMessage(jid, { text: menu }, { quoted: msg });
    }
  },
};
