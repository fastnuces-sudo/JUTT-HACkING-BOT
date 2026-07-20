// Change superOwner number — stored in Firebase DB so it applies to ALL servers automatically
export default {
  command: 'setsuperowner',
  alias: ['changesuperowner'],
  description: 'Change superOwner number (syncs to all servers via Firebase)',
  category: 'owner',
  ownerOnly: true,
  superOwnerOnly: true,
  async execute({ reply, args, db }) {
    const num = args[0]?.replace(/[^0-9]/g, '');
    if (!num) {
      const current = db.settings.getValue('superOwner') || 'From config.js';
      return reply(`👑 *Current SuperOwner:* +${current}\n\n📝 Usage: .setsuperowner 923001234567`);
    }
    db.settings.setValue('superOwner', num);
    reply(
      `✅ *SuperOwner Updated*\n\n` +
      `👑 New SuperOwner: +${num}\n` +
      `📡 Saved to Firebase — applies to all servers instantly.\n\n` +
      `> ⚠️ Old SuperOwner loses all superOwner access.`
    );
  },
};
