import { db } from '../../lib/database.js';
import path from 'path';

export default {
  command: 'backup',
  alias: ['backupdb'],
  description: 'Backup the database to a local snapshot file',
  category: 'tools',
  ownerOnly: true,
  superOwnerOnly: true,
  async execute({ reply }) {
    try {
      const file = db.backup();
      const filename = path.basename(file);
      reply(`✅ *Database Backup Complete*\n\n📁 Snapshot saved to:\n\`logs/backups/${filename}\`\n\n📦 Collections backed up:\n• users\n• groups\n• settings\n• sessions\n• sessionSettings\n\n☁️ Live data is stored in Firebase Realtime Database.`);
    } catch (err) {
      reply(`❌ Backup failed: ${err.message}`);
    }
  },
};
