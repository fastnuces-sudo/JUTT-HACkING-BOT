// ============================================
// AA MD Bot - Super Owner Panel (.smenu)
// Developer: Ahsan Ali | AA Mods
// Only accessible to the superOwner number
// ============================================

import config from '../../config.js';

export default {
  command: 'smenu',
  alias: ['supermenu', 'devmenu', 'adminpanel'],
  description: 'Super Owner developer control panel',
  category: 'owner',
  ownerOnly: true,
  superOwnerOnly: true,

  async execute({ reply }) {
    const p   = '.';
    const num = `+${config.superOwner}`;

    const text =
      `╔══════════════════════════════════╗\n` +
      `║  👑  *SUPER OWNER PANEL*         ║\n` +
      `║  🔐  Dev: ${num.padEnd(18)}║\n` +
      `╚══════════════════════════════════╝\n\n` +

      `⚡ *BOT CONTROL*\n` +
      `▸ *${p}mode* public/private   — Access mode\n` +
      `▸ *${p}maintenance* on/off    — Lock the bot\n` +
      `▸ *${p}restart*               — Reboot bot\n` +
      `▸ *${p}broadcast* [msg]       — Blast to all groups\n` +
      `▸ *${p}reload*                — Hot-reload all plugins\n` +
      `▸ *${p}setprefix* [char]      — Change prefix\n\n` +

      `🤖 *PERSONAL / GB*\n` +
      `▸ *${p}ghost* on/off          — Appear offline\n` +
      `▸ *${p}autoread* on/off       — Auto blue ticks\n` +
      `▸ *${p}autoreact* on/off      — Auto emoji react\n` +
      `▸ *${p}anticall* on/off       — Block incoming calls\n` +
      `▸ *${p}antispam* on/off       — Anti-spam filter\n` +
      `▸ *${p}afk* [reason]          — Go AFK (auto-reply)\n` +
      `▸ *${p}back*                  — Return from AFK\n\n` +

      `👑 *OWNER MANAGEMENT*\n` +
      `▸ *${p}addowner* @num         — Grant owner access\n` +
      `▸ *${p}delowner* @num         — Revoke owner access\n` +
      `▸ *${p}setowner* @num         — Set as full owner\n` +
      `▸ *${p}banuser* ban @num      — Ban a user\n` +
      `▸ *${p}banuser* unban @num    — Unban a user\n\n` +

      `👁️ *VIEW-ONCE REVEAL*\n` +
      `▸ *${p}antiviewonce* on/off   — Auto-reveal all view-once\n` +
      `▸ *${p}avv*                   — Reveal (reply to view-once)\n` +
      `   _💡 Reply with 4 same emojis (🔥🔥🔥🔥) to reveal_\n\n` +

      `💻 *DEVELOPER TOOLS*\n` +
      `▸ *${p}eval* [js code]        — Run JavaScript\n` +
      `▸ *${p}shell* [cmd]           — Run shell command\n` +
      `▸ *${p}bs*                    — Full settings panel\n\n` +

      `📱 *SESSION / DEVICES*\n` +
      `▸ *${p}devices*               — List all sessions\n` +
      `▸ *${p}adddevice* <number>    — Add new session\n` +
      `   _Send pairing code via WhatsApp — no console needed_\n` +
      `▸ *${p}deldevice* [id]        — Remove a session\n\n` +

      `📢 *CHANNEL / NEWSLETTER*\n` +
      `▸ *${p}setnewsletter* <jid> [name] — Set channel link\n` +
      `▸ *${p}followchannel*         — Manage auto-follow channels\n\n` +

      `🔧 *SYSTEM*\n` +
      `▸ *${p}system*                — System info\n` +
      `▸ *${p}dbstats*               — Database stats\n` +
      `▸ *${p}logs*                  — Recent logs\n` +
      `▸ *${p}backup*                — Backup database\n\n` +

      `> 🌐 https://aa-mods.vercel.app/\n` +
      `> 🤖 *Powered by AA MD Bot*  👨‍💻 *Ahsan Ali Wadani*`;

    return reply(text);
  },
};
