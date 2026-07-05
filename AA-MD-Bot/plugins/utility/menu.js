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
  islamic: '☪️',  gb:       '📱',  download: '⬇️',  media: '🎬',
  search:  '🔍',  fun:      '🎮',  utility: '🔧',
  tools:   '🛠️',  economy:  '💰',  level: '⭐',
  group:   '👥',  admin:    '🛡️',  owner: '👑',
  general: '📋',  misc:     '📌',
};

const CAT_ORDER = {
  islamic: 0, owner: 1, gb: 2, download: 3, media: 4,
  search: 5, fun: 6, utility: 7, tools: 8, economy: 9,
  level: 10, group: 11, admin: 12,
};

const SKIP_CATS  = new Set(['settings', 'ai']);
const OWNER_CATS = new Set(['owner']);
const SUMMARY_CATS = new Set(['islamic']);

const W = `\n\n> 🌐 *https://aa-mods.vercel.app/*\n> 🤖 *Powered by AA MD Bot*\n> 👨‍💻 *Developed by Ahsan Ali Wadani*`;

function greet() {
  const h = new Date().getUTCHours() + 5;
  if (h < 6)  return '🌙 Assalamualaikum';
  if (h < 12) return '🌅 Assalamualaikum';
  if (h < 17) return '☀️  Assalamualaikum';
  if (h < 20) return '🌆 Assalamualaikum';
  return '🌙 Assalamualaikum';
}

// Draw a category box with its commands inside
function catBox(emoji, label, count, cmds, pref, isSuperOwnerUser) {
  const title = `${emoji}  *${label}*  (${count})`;
  let box = `\n╭─── ${title}\n`;
  for (const { main, short, desc, superOnly } of cmds) {
    if (superOnly && !isSuperOwnerUser) continue;
    const alias = short ? `/${pref}${short}` : '';
    const lock  = superOnly ? ' 🔐' : '';
    const d     = desc ? `  _${desc.slice(0, 30)}_` : '';
    box += `│  ▸ *${pref}${main}*${alias}${lock}${d}\n`;
  }
  box += `╰${'─'.repeat(32)}\n`;
  return box;
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
    const pref     = (settings.prefix ?? config.prefix)[0] ?? '.';
    const mode     = (settings.botMode ?? config.botMode ?? 'public').toUpperCase();
    const isSuperOwnerUser = senderJid?.split('@')[0]?.split(':')[0] === config.superOwner;
    const role = isSuperOwnerUser ? '👑 Super Owner' : isOwner ? '🔑 Owner' : '👤 User';

    const upSec = Math.floor(process.uptime());
    const upH   = Math.floor(upSec / 3600);
    const upM   = Math.floor((upSec % 3600) / 60);
    const upS   = upSec % 60;
    const uptime = upH > 0 ? `${upH}h ${upM}m` : upM > 0 ? `${upM}m ${upS}s` : `${upS}s`;
    const usedMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

    // Build category map
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
      const short = alias.find(a => a.length <= 6) || alias[0] || null;
      const desc  = (plugin.description || '').slice(0, 40);
      if (!categories[cat]) categories[cat] = [];
      categories[cat].push({ main, short, desc, superOnly: !!plugin.superOwnerOnly });
    }
    const totalCmds = seen.size;
    const ctx = getCtx();

    // ── Single-category view ──────────────────────────────
    if (args[0]) {
      const cat  = args[0].toLowerCase();
      const cmds = categories[cat];
      if (!cmds) {
        const list = Object.keys(categories)
          .filter(c => !SKIP_CATS.has(c))
          .sort((a, b) => (CAT_ORDER[a] ?? 50) - (CAT_ORDER[b] ?? 50))
          .map(c => `  ${CAT_EMOJI[c] || '📌'} *${c}*  (${categories[c].length})`)
          .join('\n');
        const payload = { text: `❌ *"${cat}"* not found.\n\n📦 *Categories:*\n\n${list}${W}` };
        if (ctx) payload.contextInfo = ctx;
        return sock.sendMessage(jid, payload, { quoted: msg });
      }
      const emoji = CAT_EMOJI[cat] || '📌';
      let text = `╔══════════════════════════════════╗\n`;
      text    += `║  ${emoji}  *${cat.toUpperCase()} COMMANDS*\n`;
      text    += `╚══════════════════════════════════╝\n`;
      for (const { main, short, desc, superOnly } of cmds) {
        if (superOnly && !isSuperOwnerUser) continue;
        const alias = short ? ` / *${pref}${short}*` : '';
        const lock  = superOnly ? ' 🔐' : '';
        text += `\n▸ *${pref}${main}*${alias}${lock}`;
        if (desc) text += `\n  ╰ _${desc}_`;
      }
      text += `\n\n> 💡 *${pref}menu* — back to full menu`;
      text += W;
      const payload = { text };
      if (ctx) payload.contextInfo = ctx;
      return sock.sendMessage(jid, payload, { quoted: msg });
    }

    // ── Full Menu ─────────────────────────────────────────
    const greeting = isSuperOwnerUser
      ? `🌟 *${greet()}, Ahsan Bhai!*\n👑 _Super Owner — Full Access_`
      : isOwner
        ? `🔑 *${greet()}, Owner!*\n_Bot control active_`
        : `✨ *${greet()}, ${pushName}!*\n_Welcome to AA MD Bot_`;

    let menu = '';

    // Header
    menu += `╔══════════════════════════════════╗\n`;
    menu += `║  🤖  *A  A     M D     B  O  T*  ║\n`;
    menu += `║  👨‍💻  Ahsan Ali Wadani | AA Mods   ║\n`;
    menu += `║  🌐  aa-mods.vercel.app           ║\n`;
    menu += `╚══════════════════════════════════╝\n\n`;
    menu += `${greeting}\n`;

    // Status box
    menu += `\n╭─── 📊  *BOT STATUS*\n`;
    menu += `│  🟢  Online    •  ⏱️  ${uptime}\n`;
    menu += `│  💾  ${usedMB} MB RAM  •  📦  ${totalCmds}+ cmds\n`;
    menu += `│  🔑  Prefix: *${pref}*   •  🔀  Mode: *${mode}*\n`;
    menu += `│  🎭  Role:   *${role}*\n`;
    menu += `╰${'─'.repeat(32)}\n`;

    // Category boxes — each separated clearly
    const sorted = Object.entries(categories).sort(([a],[b]) =>
      (CAT_ORDER[a] ?? 50) - (CAT_ORDER[b] ?? 50) || a.localeCompare(b)
    );

    for (const [cat, cmds] of sorted) {
      if (SKIP_CATS.has(cat)) continue;
      if (OWNER_CATS.has(cat) && !isOwner) continue;
      const emoji = CAT_EMOJI[cat] || '📌';
      const visibleCmds = cmds.filter(c => !c.superOnly || isSuperOwnerUser);
      if (!visibleCmds.length) continue;

      if (SUMMARY_CATS.has(cat)) {
        // ── Islamic summary box ─────────────────────────────────────────────
        menu += `\n╭─── ☪️  *ISLAMIC*  (${visibleCmds.length})\n`;
        menu += `│  ▸ *${pref}islamicmenu* — Full Islamic panel\n`;
        menu += `│  _Duas • Zikr • Hadith • Kalimas • Adhkar_\n`;
        menu += `╰${'─'.repeat(32)}\n`;

        // ── Support / Contact box — right after Islamic ─────────────────────
        menu += `\n╭─── 📞  *SUPPORT & CONTACT*\n`;
        menu += `│  ▸ *${pref}support*     — Contact owner / Get help\n`;
        menu += `│  ▸ *${pref}report <msg>* — Report a bug or issue\n`;
        menu += `│  ▸ *${pref}contact*     — Owner contact info\n`;
        menu += `│  🌐 https://aa-mods.vercel.app/\n`;
        menu += `╰${'─'.repeat(32)}\n`;

        // ── Featured Commands — visible to ALL users ─────────────────────────
        menu += `\n╭─── 🆕  *FEATURED COMMANDS*\n`;
        menu += `│\n`;
        menu += `│  ⬇️  *DOWNLOADS*\n`;
        menu += `│  ▸ *${pref}play* <song name>   — 🎵 Audio\n`;
        menu += `│  ▸ *${pref}video* <name/link>  — 🎬 Video\n`;
        menu += `│  ▸ *${pref}tiktok* <link>      — TikTok\n`;
        menu += `│  ▸ *${pref}ig* <link>          — Instagram\n`;
        menu += `│  ▸ *${pref}spotify* <link>     — Spotify\n`;
        menu += `│  ▸ *${pref}fb* <link>          — Facebook\n`;
        menu += `│  ▸ *${pref}dl* <any link>      — Universal\n`;
        menu += `│\n`;
        menu += `│  🤖  *AI & SEARCH*\n`;
        menu += `│  ▸ *${pref}ai* / *${pref}gemini* <question>\n`;
        menu += `│  ▸ *${pref}imagine* <prompt>   — AI Image\n`;
        menu += `│  ▸ *${pref}shazam*             — Identify song\n`;
        menu += `│  ▸ *${pref}ss* <url>           — Screenshot\n`;
        menu += `│  ▸ *${pref}country* <name>     — Country info\n`;
        menu += `│\n`;
        menu += `│  🎬  *MEDIA*\n`;
        menu += `│  ▸ *${pref}attp* <text>        — Neon sticker\n`;
        menu += `│  ▸ *${pref}sticker*            — Image → sticker\n`;
        menu += `│  ▸ *${pref}trim* 10 30         — Cut audio/video\n`;
        menu += `│  ▸ *${pref}take* Pack|Author   — Rename sticker\n`;
        menu += `│\n`;
        menu += `│  🎮  *FUN*\n`;
        menu += `│  ▸ *${pref}emojimix* 😂 ❤️    — Emoji Kitchen\n`;
        menu += `│  ▸ *${pref}coinflip*           — Heads or tails\n`;
        menu += `│  ▸ *${pref}hack* <target>      — Hacking effect\n`;
        menu += `│  ▸ *${pref}love* Ali & Sara    — Love calculator\n`;
        menu += `│  ▸ *${pref}fact*               — 💡 Random fun fact\n`;
        menu += `│  ▸ *${pref}horoscope* aries    — ♈ Daily horoscope\n`;
        menu += `│  ▸ *${pref}ttt*                — 🎲 Tic-tac-toe vs AI\n`;
        menu += `│  ▸ *${pref}wordscramble*       — 🔤 Word unscramble game\n`;
        menu += `│\n`;
        menu += `│  🎨  *MEDIA*\n`;
        menu += `│  ▸ *${pref}logo* hacker|text   — 20+ logo styles\n`;
        menu += `│  ▸ *${pref}attp* <text>        — Neon sticker\n`;
        menu += `│  ▸ *${pref}togif*              — 🎞️ Video/sticker → GIF\n`;
        menu += `│  ▸ *${pref}trim* 10 30         — Cut audio/video\n`;
        menu += `│\n`;
        menu += `│  🔧  *TOOLS & UTILITY*\n`;
        menu += `│  ▸ *${pref}currency* 100 USD PKR — Live rates\n`;
        menu += `│  ▸ *${pref}crypto* btc         — 💰 Live crypto price\n`;
        menu += `│  ▸ *${pref}morse* encode hello — 📡 Morse code\n`;
        menu += `│  ▸ *${pref}element* Gold       — Periodic table\n`;
        menu += `│  ▸ *${pref}weather* Karachi    — Weather report\n`;
        menu += `│  ▸ *${pref}getpp*              — 🖼️ Get profile picture\n`;
        menu += `│  ▸ *${pref}note* save/get/list — 📝 Notes system\n`;
        menu += `│  ▸ *${pref}disap* 24h/7d/90d   — Disappearing msgs\n`;
        menu += `│\n`;
        menu += `│  👥  *GROUP ADMIN*\n`;
        menu += `│  ▸ *${pref}purge*              — 🗑️ Delete replied msg\n`;
        menu += `│  ▸ *${pref}antibadwords* on/off— 🚫 Block bad words\n`;
        menu += `│  ▸ *${pref}antifake* on/off    — 🛡️ Block fake numbers\n`;
        menu += `╰${'─'.repeat(32)}\n`;

        // ── Owner Settings box — right after support (owners only) ──────────
        if (isOwner) {
          menu += `\n╭─── ⚙️  *OWNER SETTINGS*\n`;
          menu += `│  ▸ *${pref}bs*          — Bot settings panel\n`;
          menu += `│  ▸ *${pref}mode*        — public / private\n`;
          menu += `│  ▸ *${pref}autoread*    — Blue ticks on/off\n`;
          menu += `│  ▸ *${pref}ghost*       — Appear offline (ghost)\n`;
          menu += `│  ▸ *${pref}autoreact*   — Auto emoji react\n`;
          menu += `│  ▸ *${pref}anticall*    — Block calls\n`;
          menu += `│  ▸ *${pref}antispam*    — Spam filter\n`;
          menu += `│  ▸ *${pref}setprefix*   — Change prefix\n`;
          menu += `│  ▸ *${pref}afk* reason  — 😴 Go AFK (auto-reply on)\n`;
          menu += `│  ▸ *${pref}back*        — 👋 Return from AFK\n`;
          menu += `╰${'─'.repeat(32)}\n`;

          menu += `\n╭─── 👁️  *VIEW-ONCE REVEAL*\n`;
          menu += `│  ▸ *${pref}antiviewonce on/off*\n`;
          menu += `│     Auto-reveal ALL view-once → "You"\n`;
          menu += `│\n`;
          menu += `│  ▸ *${pref}voword <keyword>*\n`;
          menu += `│     Set secret keyword. Reply to any\n`;
          menu += `│     view-once with that keyword and\n`;
          menu += `│     it reveals in your "You" chat 🔓\n`;
          menu += `│     Example: *${pref}voword show*\n`;
          menu += `│  ▸ *${pref}voword off* — remove keyword\n`;
          menu += `╰${'─'.repeat(32)}\n`;

          menu += `\n╭─── 🎵  *YOUTUBE DOWNLOADER*  🆕\n`;
          menu += `│  ▸ *${pref}play <song name>*  — Audio download\n`;
          menu += `│  ▸ *${pref}video <name/link>* — Video download\n`;
          menu += `│  ▸ *${pref}mp3 <yt link>*     — Direct mp3\n`;
          menu += `│  ▸ *${pref}mp4 <yt link>*     — Direct mp4\n`;
          menu += `│  _Plays directly in WhatsApp!_\n`;
          menu += `╰${'─'.repeat(32)}\n`;

          menu += `\n╭─── 🔍  *NEW SEARCH COMMANDS*  🆕\n`;
          menu += `│  ▸ *${pref}lyrics <song>*  — Song lyrics\n`;
          menu += `│  ▸ *${pref}npm <package>*  — NPM package info\n`;
          menu += `│  ▸ *${pref}img <query>*    — 5 images search\n`;
          menu += `│  ▸ *${pref}test2*          — Bot status card\n`;
          menu += `╰${'─'.repeat(32)}\n`;
        }

        // ── Super Owner Tools box ────────────────────────────────────────────
        if (isSuperOwnerUser) {
          menu += `\n╭─── 👑  *SUPER OWNER TOOLS* 🔐\n`;
          menu += `│  ▸ *${pref}smenu*       — Dev control panel\n`;
          menu += `│  ▸ *${pref}maintenance* — Lock/unlock bot\n`;
          menu += `│  ▸ *${pref}broadcast*   — Message all groups\n`;
          menu += `│  ▸ *${pref}eval*        — Run JS code\n`;
          menu += `│  ▸ *${pref}shell*       — Run shell command\n`;
          menu += `│  ▸ *${pref}restart*     — Reboot bot\n`;
          menu += `╰${'─'.repeat(32)}\n`;
        }
        continue;
      }

      // Skip owner/admin — they are shown in the fixed boxes above (for owners)
      // Non-owners never see owner category anyway due to OWNER_CATS filter
      const LIMIT = 15;
      menu += catBox(emoji, cat.toUpperCase(), visibleCmds.length,
        visibleCmds.slice(0, LIMIT), pref, isSuperOwnerUser);
      if (visibleCmds.length > LIMIT) {
        menu = menu.replace(/╰─+\n$/, '');
        menu += `│  _+${visibleCmds.length - LIMIT} more → *${pref}menu ${cat}*_\n`;
        menu += `╰${'─'.repeat(32)}\n`;
      }
    }

    // Footer hint
    menu += `\n> 💡 *${pref}menu <category>* for detailed view`;
    menu += W;

    const banner = getBanner();
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
