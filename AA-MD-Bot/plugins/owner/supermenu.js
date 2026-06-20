import config from '../../config.js';

export default {
  command: 'smenu',
  alias: ['supermenu', 'devmenu', 'adminpanel'],
  description: 'Super Owner developer control panel',
  category: 'owner',
  ownerOnly: true,
  superOwnerOnly: true,

  async execute({ reply }) {
    const p = '.';
    const num = `+${config.superOwner}`;

    const text =
      `╔══════════════════════════════╗\n` +
      `║  👑 *SUPER OWNER PANEL*      ║\n` +
      `║  🔐 Dev: ${num}  ║\n` +
      `╚══════════════════════════════╝\n\n` +

      `⚡ *BOT CONTROL*\n` +
      `▸ *${p}mode* public/private — Bot access mode\n` +
      `▸ *${p}maintenance* on/off — Maintenance lock\n` +
      `▸ *${p}restart* — Reboot the bot\n` +
      `▸ *${p}broadcast* [msg] — Blast to all groups\n\n` +

      `👑 *OWNER MANAGEMENT*\n` +
      `▸ *${p}addowner* @num — Grant owner access\n` +
      `▸ *${p}delowner* @num — Revoke owner access\n` +
      `▸ *${p}setowner* @num — Set as full owner\n` +
      `▸ *${p}banuser* ban @num — Ban a user\n` +
      `▸ *${p}banuser* unban @num — Unban a user\n\n` +

      `📢 *CHANNEL / NEWSLETTER*\n` +
      `▸ *${p}setnewsletter* <jid> [name]\n` +
      `  ╰ Adds "View channel" lid to all replies\n\n` +

      `💻 *DEVELOPER TOOLS*\n` +
      `▸ *${p}eval* [js code] — Run JavaScript\n` +
      `▸ *${p}shell* [cmd] — Run shell command\n` +
      `▸ *${p}reload* — Hot-reload all plugins\n\n` +

      `📱 *SESSION MANAGEMENT*\n` +
      `▸ *${p}devices* — List all sessions\n` +
      `▸ *${p}adddevice* — Add new session\n` +
      `▸ *${p}deldevice* [id] — Remove a session\n\n` +

      `⚙️ *SETTINGS*\n` +
      `▸ *${p}setprefix* [char] — Change prefix\n` +
      `▸ *${p}bs* — Full bot settings panel\n\n` +

      `🌐 https://aa-mods.vercel.app/\n` +
      `👨‍💻 *Developed by Ahsan Ali Wadani*`;

    return reply(text);
  },
};
