import { db } from '../../lib/database.js';

export default {
  command: 'backup',
  alias: ['backupdb'],
  description: 'Backup the database',
  category: 'tools',
  ownerOnly: true,
  async execute({ reply }) {
    try {
      const backupDir = db.backup();
      reply(`✅ *Database Backup Complete*\n\n📁 Saved to: ${backupDir}\n\n📦 Files backed up:\n• users.json\n• groups.json\n• settings.json\n• sessions.json`);
    } catch (err) {
      reply('❌ Backup failed. Please try again in a few seconds.');
    }
  },
};
