import { saveNow } from '../../lib/database.js';

export default {
  command: 'delowner',
  alias: ['delsudo', 'delop', 'removeowner'],
  description: 'Remove a bot owner',
  category: 'owner',
  ownerOnly: true,
  superOwnerOnly: true,
  async execute({ reply, args, msg, db }) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const targets = mentions.length ? mentions.map(j => j.split('@')[0]) : args;
    if (!targets.length) return reply('❌ Usage: .delowner @user\nor .delowner 923001234567');
    const settings = db.settings.get();
    let owners = settings.owners || [];
    const removed = [];
    for (const t of targets) {
      const num = t.replace(/[^0-9]/g, '');
      if (num && owners.includes(num)) { owners = owners.filter(o => o !== num); removed.push(num); }
    }
    db.settings.setValue('owners', owners);
    await saveNow('settings');
    reply(`✅ *Owner Removed!*\n\n👑 Removed: +${removed.join(', +')||'none found'}\n👑 Remaining Owners: ${owners.length}`);
  },
};
