// ============================================
// AA MD Bot - Bot Settings Menu (Owner)
// Developer: Ahsan Ali | AA Mods
// ============================================

import config from '../../config.js';
import { db } from '../../lib/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHANNEL_URL  = 'https://whatsapp.com/channel/0029Vb8Yk2LL2AU78HliE617';
const CHANNEL_NAME = 'AA MD Bot';

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

export default {
  command: 'settings',
  alias: ['bs', 'botsettings', 'botset'],
  description: 'Show bot settings panel',
  category: 'utility',
  ownerOnly: true,
  usage: '.settings',

  async execute({ sock, jid, msg }) {
    const s    = db.settings.get();
    const pref = (s.prefix ?? config.prefix)[0] ?? '.';

    const on  = '🟢 ON ';
    const off = '🔴 OFF';

    const bool = (v, def = false) => (v ?? def) ? on : off;

    const menu =
      `╔══════════════════════════════╗\n` +
      `║   ⚙️  *BOT SETTINGS PANEL*    ║\n` +
      `║   👑 Owner Only Commands      ║\n` +
      `╚══════════════════════════════╝\n\n` +

      `┌─────── 📊 *CURRENT STATUS* ───────┐\n` +
      `│ 🤖 Mode        : *${(s.botMode ?? 'public').toUpperCase()}*\n` +
      `│ 🔑 Prefix      : *${pref}*\n` +
      `│ 📞 Anti-Call   : ${bool(s.antiCall)}\n` +
      `│ 🗑️ Anti-Delete : ${bool(s.antiDelete)}\n` +
      `│ 👁️ Anti-ViewOnce: ${bool(s.antiViewOnce)}\n` +
      `│ 📊 Status View : ${bool(s.statusView, config.autoStatusView)}\n` +
      `│ ❤️ Status React : ${bool(s.statusReact, config.autoStatusReact)}\n` +
      `│ 📤 Auto Status : ${bool(s.autoStatus, config.autoStatus)}\n` +
      `│ 🔧 Maintenance : ${bool(s.maintenanceMode)}\n` +
      `│ 🛡️ Anti-Spam   : ${bool(s.antiSpam, config.antiSpam)}\n` +
      `└───────────────────────────────┘\n\n` +

      `╔═══ 🔀 *BOT MODE* ═══\n` +
      `│ ▸ *${pref}mode public*  — everyone can use\n` +
      `│ ▸ *${pref}mode private* — only you (self-chat)\n\n` +

      `╔═══ 🛡️ *PROTECTION* ═══\n` +
      `│ ▸ *${pref}anticall* on/off\n` +
      `│ ▸ *${pref}antidelete* on/off\n` +
      `│ ▸ *${pref}antiviewonce* on/off\n` +
      `│ ▸ *${pref}antispam* on/off\n\n` +

      `╔═══ 📊 *STATUS* ═══\n` +
      `│ ▸ *${pref}statusview* on/off  — auto view\n` +
      `│ ▸ *${pref}statusreact* on/off — auto react\n` +
      `│ ▸ *${pref}autostatus* on/off  — post status\n\n` +

      `╔═══ ⚙️ *BOT CONFIG* ═══\n` +
      `│ ▸ *${pref}setprefix* <symbol>   — change prefix\n` +
      `│ ▸ *${pref}maintenance* on/off   — maintenance mode\n` +
      `│ ▸ *${pref}setnewsletter* <jid>  — View Channel button\n\n` +

      `╔═══ 👥 *USER MANAGEMENT* ═══\n` +
      `│ ▸ *${pref}ban* @user     — ban user\n` +
      `│ ▸ *${pref}unban* @user   — unban user\n` +
      `│ ▸ *${pref}block* @user   — block user\n` +
      `│ ▸ *${pref}broadcast* msg — broadcast\n\n` +

      `╔══════════════════════════════╝\n` +
      `📢 ${CHANNEL_URL}`;

    const banner = getBanner();
    const contextInfo = getCtx();
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
