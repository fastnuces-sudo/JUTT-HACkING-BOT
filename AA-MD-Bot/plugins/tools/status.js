import { getAllSessions } from '../../lib/sessionManager.js';
import { plugins, categories } from '../../lib/pluginLoader.js';
import { db } from '../../lib/database.js';
import { formatDuration } from '../../lib/helper.js';

const startTime = Date.now();

export default {
  command: 'status',
  alias: ['botstatus', 'stats'],
  description: 'Show detailed bot status',
  category: 'tools',
  async execute({ reply }) {
    const sessions = getAllSessions();
    const connected = sessions.filter(s => s.connected).length;
    const users = Object.keys(db.users.all()).length;
    const groups = Object.keys(db.groups.all()).length;
    const settings = db.settings.get();
    const cats = categories;
    reply(`📊 *AA MD Bot Status*\n\n🤖 *Bot:*\n├ Name: AA MD Bot v3.0.0\n├ Status: ${settings.maintenanceMode ? '🔧 Maintenance' : '✅ Online'}\n├ Uptime: ${formatDuration(Date.now() - startTime)}\n└ Prefix: ${(settings.prefix || ['.']).join(', ')}\n\n📱 *Sessions:*\n├ Total: ${sessions.length}\n└ Connected: ${connected}\n\n📦 *Plugins:*\n├ Total: ${plugins.size}\n└ Categories: ${cats.size}\n\n📋 *Database:*\n├ Users: ${users}\n└ Groups: ${groups}\n\n👑 *Owners:* ${settings.owners?.length || 0}\n👮 *Sudo:* ${settings.sudo?.length || 0}`);
  },
};
