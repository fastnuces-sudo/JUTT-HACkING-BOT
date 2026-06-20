export default {
  command: 'delsudo',
  alias: ['removesudo'],
  description: 'Remove a sudo user (owner only)',
  category: 'owner',
  ownerOnly: true,
  async execute({ reply, args, msg, db }) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const targets = mentions.length ? mentions.map(j => j.split('@')[0]) : args;
    if (!targets.length) return reply('❌ Usage: .delsudo @user or .delsudo number');
    const settings = db.settings.get();
    let sudo = settings.sudo || [];
    const removed = [];
    for (const t of targets) {
      const num = t.split('@')[0].replace(/[^0-9]/g, '');
      if (sudo.includes(num)) { sudo = sudo.filter(s => s !== num); removed.push(num); }
    }
    db.settings.setValue('sudo', sudo);
    reply(`✅ *Sudo Updated*\n\n➖ Removed: ${removed.map(n => `+${n}`).join(', ') || 'none found'}\n👑 Remaining Sudo: ${sudo.length}`);
  },
};
