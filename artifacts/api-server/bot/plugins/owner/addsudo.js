export default {
  command: 'addsudo',
  alias: ['addowner'],
  description: 'Add a sudo user (owner only)',
  category: 'owner',
  ownerOnly: true,
  async execute({ reply, args, msg, db }) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const targets = mentions.length ? mentions.map(j => j.split('@')[0]) : args;
    if (!targets.length) return reply('❌ Usage: .addsudo @user or .addsudo number');
    const settings = db.settings.get();
    const sudo = settings.sudo || [];
    const added = [];
    for (const t of targets) {
      const num = t.split('@')[0].replace(/[^0-9]/g, '');
      if (!sudo.includes(num)) { sudo.push(num); added.push(num); }
    }
    db.settings.setValue('sudo', sudo);
    reply(`✅ *Sudo Users Updated*\n\n➕ Added: ${added.map(n => `+${n}`).join(', ') || 'none (already sudo)'}\n👑 Total Sudo: ${sudo.length}`);
  },
};
