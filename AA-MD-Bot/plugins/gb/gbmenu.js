// ============================================
// AA MD Bot - GB Features Menu
// ============================================

export default {
  command: 'gbmenu',
  alias: ['gb', 'gbfeatures', 'gbwhatsapp'],
  category: 'gb',
  description: 'GB WhatsApp-like features menu',
  usage: '.gbmenu',

  async execute({ reply, sock, jid, msg, isOwner }) {
    const W = `\n\n> 🌐 https://aa-mods.vercel.app/\n> 🤖 *Powered by AA MD Bot*\n> 👨‍💻 *Developed by Ahsan Ali Wadani*`;

    let menu =
      `╔══════════════════════════════════╗\n` +
      `║  📱  *GB WHATSAPP FEATURES*      ║\n` +
      `║       AA MD Bot  v3.0            ║\n` +
      `╚══════════════════════════════════╝\n\n` +
      `These commands bring popular GB WhatsApp\n` +
      `features directly into your bot.\n\n`;

    menu +=
      `╭─── 👻  *PRIVACY & STEALTH*\n` +
      `│  ▸ *.ghost on/off*     — Appear offline (invisible)\n` +
      `│  ▸ *.autoread on/off*  — Hide/show blue ticks\n` +
      `│  ▸ *.anticall on/off*  — Block incoming calls\n` +
      `╰${'─'.repeat(32)}\n`;

    menu +=
      `\n╭─── 💾  *SAVE & DOWNLOAD*\n` +
      `│  ▸ *.statussave*       — Save WA statuses\n` +
      `│  ▸ *.antiviewonce*     — Reveal view-once media\n` +
      `│  ▸ *.antidelete*       — Recover deleted msgs\n` +
      `│  ▸ *.pp <number>*      — View full profile pic\n` +
      `╰${'─'.repeat(32)}\n`;

    menu +=
      `\n╭─── 📅  *MESSAGING TOOLS*\n` +
      `│  ▸ *.schedule 5m text* — Send msg after delay\n` +
      `│  ▸ *.flood 5 text*     — Send msg N times 👑\n` +
      `│  ▸ *.broadcast msg*    — Message all groups 👑\n` +
      `╰${'─'.repeat(32)}\n`;

    menu +=
      `\n╭─── 👁️  *ALERTS & TRACKING*\n` +
      `│  ▸ *.onlinealert <num>* — Alert when someone online\n` +
      `│  ▸ *.oalert list*       — View tracked contacts\n` +
      `│  ▸ *.oalert clear*      — Clear all alerts\n` +
      `╰${'─'.repeat(32)}\n`;

    menu +=
      `\n╭─── 🎭  *GROUP FEATURES*\n` +
      `│  ▸ *.antidelete on/off* — Recover deleted messages\n` +
      `│  ▸ *.antibot on/off*    — Block other bots\n` +
      `│  ▸ *.antilink on/off*   — Block invite links\n` +
      `│  ▸ *.antiviewonce on/off*— Reveal view-once\n` +
      `╰${'─'.repeat(32)}\n`;

    menu += `\n> 👑 *Commands marked 👑 are owner-only*`;
    menu += W;

    return sock.sendMessage(jid, { text: menu }, { quoted: msg });
  },
};
