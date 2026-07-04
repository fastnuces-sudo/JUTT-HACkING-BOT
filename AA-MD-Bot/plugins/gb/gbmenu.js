export default {
  command: 'gbmenu',
  alias: ['gb', 'gbfeatures', 'gbwhatsapp'],
  category: 'gb',
  description: 'GB WhatsApp-like features menu',
  usage: '.gbmenu',

  async execute({ reply, sock, jid, msg, prefix, db }) {
    const p = prefix || '.';
    const W = `\n\n> 🌐 https://aa-mods.vercel.app/\n> 🤖 *Powered by AA MD Bot*\n> 👨‍💻 *Developed by Ahsan Ali Wadani*`;

    const menu =
      `╔══════════════════════════════════╗\n` +
      `║  📱  *GB WHATSAPP FEATURES*      ║\n` +
      `║       AA MD Bot  v3.0            ║\n` +
      `╚══════════════════════════════════╝\n\n` +
      `GB WhatsApp jaise features seedha\nbot ke zariye use karo!\n\n` +

      `╭─── 👻  *PRIVACY & STEALTH*\n` +
      `│  ▸ *${p}ghost on/off*\n` +
      `│     Offline dikhao jabke bot active\n` +
      `│\n` +
      `│  ▸ *${p}alwaysonline on/off*\n` +
      `│     Hamesha online dikhao\n` +
      `│\n` +
      `│  ▸ *${p}privacy*\n` +
      `│     Last seen, profile pic, blue ticks\n` +
      `│     control karo\n` +
      `│\n` +
      `│  ▸ *${p}privacy lockdown*\n` +
      `│     Sab kuch hide karo ek command se\n` +
      `│\n` +
      `│  ▸ *${p}privacy bluetick on/off*\n` +
      `│     Blue ticks on/off karo\n` +
      `│\n` +
      `│  ▸ *${p}anticall on/off*\n` +
      `│     Incoming calls block karo\n` +
      `╰${'─'.repeat(34)}\n\n` +

      `╭─── 🔓  *VIEW-ONCE & DELETE*\n` +
      `│  ▸ *${p}antiviewonce on/off*\n` +
      `│     View-once photos/videos auto-reveal\n` +
      `│     + apni "You" chat mein forward\n` +
      `│\n` +
      `│  ▸ *${p}reveal* (view-once ko reply karo)\n` +
      `│     Manually reveal → "You" private chat\n` +
      `│\n` +
      `│  ▸ *${p}voword <keyword>*  🆕\n` +
      `│     Secret keyword set karo. Jab bhi koi\n` +
      `│     view-once aaye, sirf woh keyword type\n` +
      `│     karo reply mein — bot silently "You"\n` +
      `│     chat mein reveal karke bhej dega\n` +
      `│     Example: *${p}voword show*\n` +
      `│  ▸ *${p}voword off* — keyword band karo\n` +
      `│\n` +
      `│  ▸ *${p}antidelete on/off*\n` +
      `│     Delete hone wale msgs recover karo\n` +
      `│     (DM + Groups dono mein kaam karta)\n` +
      `╰${'─'.repeat(34)}\n\n` +

      `╭─── 💾  *SAVE & DOWNLOAD*\n` +
      `│  ▸ *${p}statussave* (status forward karo)\n` +
      `│     Kisi ka bhi status save karo\n` +
      `│\n` +
      `│  ▸ *${p}pp <number>*\n` +
      `│     Kisi ka bhi full profile pic dekho\n` +
      `│     Example: ${p}pp 923001234567\n` +
      `╰${'─'.repeat(34)}\n\n` +

      `╭─── 🤖  *AUTO FEATURES*\n` +
      `│  ▸ *${p}autoreply <message>*\n` +
      `│     Busy hone par auto reply karo\n` +
      `│     Example: ${p}autoreply Main busy hoon\n` +
      `│\n` +
      `│  ▸ *${p}autoreply off*\n` +
      `│     Auto reply band karo\n` +
      `│\n` +
      `│  ▸ *${p}autoreply status*\n` +
      `│     Abhi ka auto reply message dekho\n` +
      `│\n` +
      `│  ▸ *${p}autoread on/off*\n` +
      `│     Sab msgs silently read karo\n` +
      `│\n` +
      `│  ▸ *${p}autostatusseen on/off*\n` +
      `│     Sab statuses auto dekho\n` +
      `╰${'─'.repeat(34)}\n\n` +

      `╭─── 📅  *MESSAGING TOOLS*\n` +
      `│  ▸ *${p}schedule 5m <message>*\n` +
      `│     Delay ke baad message bhejo\n` +
      `│     Example: ${p}schedule 10m Salam!\n` +
      `│\n` +
      `│  ▸ *${p}flood 5 <message>*\n` +
      `│     Message N baar bhejo 👑\n` +
      `│\n` +
      `│  ▸ *${p}typing <seconds>*\n` +
      `│     Fake typing dikhao\n` +
      `│\n` +
      `│  ▸ *${p}recording <seconds>*\n` +
      `│     Fake recording dikhao\n` +
      `│\n` +
      `│  ▸ *${p}broadcast <message>* 👑\n` +
      `│     Sab groups mein message bhejo\n` +
      `╰${'─'.repeat(34)}\n\n` +

      `╭─── 👁️  *TRACKING & ALERTS*\n` +
      `│  ▸ *${p}onlinealert <number>*\n` +
      `│     Jab koi online aaye, alert aaye\n` +
      `│     Example: ${p}onlinealert 923001234567\n` +
      `│\n` +
      `│  ▸ *${p}onlinealert list*\n` +
      `│     Track hone wale contacts dekho\n` +
      `│\n` +
      `│  ▸ *${p}onlinealert clear*\n` +
      `│     Sab alerts remove karo\n` +
      `╰${'─'.repeat(34)}\n\n` +

      `╭─── 🎭  *GROUP FEATURES*\n` +
      `│  ▸ *${p}antibot on/off*    — Doosre bots block\n` +
      `│  ▸ *${p}antilink on/off*   — Links block karo\n` +
      `│  ▸ *${p}antidelete on/off* — Delete recover karo\n` +
      `│  ▸ *${p}antiviewonce on/off*— View-once reveal\n` +
      `╰${'─'.repeat(34)}\n\n` +

      `> 👑 *Commands marked 👑 owner-only hain*\n` +
      `> 💡 *Koi bhi command type karo bina args ke — usage guide milega*` +
      W;

    return sock.sendMessage(jid, { text: menu }, { quoted: msg });
  },
};
