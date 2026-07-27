import { saveNow } from '../../lib/database.js';

export default {
  command: 'addowner',
  alias: ['addsudo', 'addop'],
  description: 'Add a bot owner',
  category: 'owner',
  ownerOnly: true,
  superOwnerOnly: true,
  async execute({ reply, args, msg, db }) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const targets = mentions.length ? mentions.map(j => j.split('@')[0]) : args;
    if (!targets.length) return reply('❌ Usage: .addowner @user\nor .addowner 923001234567');
    const settings = db.settings.get();
    const owners = settings.owners || [];
    const added = [];
    for (const t of targets) {
      const num = t.replace(/[^0-9]/g, '');
      if (num && !owners.includes(num)) { owners.push(num); added.push(num); }
    }
    db.settings.setValue('owners', owners);
    await saveNow('settings');
    reply(`✅ *Owner Added!*\n\n👑 +${added.join(', +')} added as owner\n👑 Total Owners: ${owners.length}\n\nThey now have full bot access.`);
  },
};
