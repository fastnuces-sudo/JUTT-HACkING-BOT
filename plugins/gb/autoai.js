// ============================================
// AA MD Bot - AutoAI (DM Auto Reply)
// .autoai on  — bot auto-replies to every DM with AI
// .autoai off — disable
// Per connected number, stored in sessionSettings
// ============================================

export default {
  command: 'autoai',
  alias: ['autobot', 'aimode', 'dmai'],
  description: 'Auto AI reply for every DM message',
  category: 'gb',

  async execute({ reply, react, args, sessionSettings, isOwner }) {
    if (!isOwner) {
      return reply('🔒 Only the bot owner can toggle AutoAI.\n\n> 🤖 *AA MD Bot*');
    }

    const sub = args[0]?.toLowerCase();
    const current = sessionSettings.eff('autoAI', false);

    if (!sub || sub === 'status') {
      return reply(
        `🤖 *AutoAI — DM Auto Reply*\n\n` +
        `Status: *${current ? 'ON ✅' : 'OFF ❌'}*\n\n` +
        `━━━━━━━━━━━━━━\n` +
        `*Commands:*\n` +
        `▸ *.autoai on*  — Auto-reply to every DM with AI\n` +
        `▸ *.autoai off* — Disable auto-reply\n\n` +
        `*How it works:*\n` +
        `• When ON, any plain DM (non-command) gets an AI reply\n` +
        `• AI remembers the last 10 exchanges per person\n` +
        `• Commands still work normally\n` +
        `• Works per connected number\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    if (sub === 'on') {
      if (current) return reply('✅ *AutoAI is already ON.*\n\n> 🤖 *AA MD Bot*');
      sessionSettings.set('autoAI', true);
      await react('✅');
      return reply(
        `✅ *AutoAI ENABLED!*\n\n` +
        `The bot will now auto-reply to all DMs using AI.\n` +
        `People can chat with it naturally — it remembers context.\n\n` +
        `Send *.autoai off* to disable.\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    if (sub === 'off') {
      if (!current) return reply('❌ *AutoAI is already OFF.*\n\n> 🤖 *AA MD Bot*');
      sessionSettings.set('autoAI', false);
      await react('✅');
      return reply('❌ *AutoAI DISABLED.*\n\nBot will no longer auto-reply to DMs.\n\n> 🤖 *AA MD Bot*');
    }

    return reply('❓ Use: *.autoai on / off / status*\n\n> 🤖 *AA MD Bot*');
  },
};
