import { saveNow } from '../../lib/database.js';

export default {
  command: 'maintenance',
  alias: ['maintain'],
  description: 'Toggle bot maintenance mode',
  category: 'owner',
  ownerOnly: true,
  superOwnerOnly: true,
  async execute({ reply, args, db }) {
    const action = args[0]?.toLowerCase();
    if (action === 'on') {
      db.settings.setValue('maintenanceMode', true);
      await saveNow('settings');
      reply('🔧 *Maintenance Mode* is now *ON*.\nOnly sudo users can use the bot.');
    } else if (action === 'off') {
      db.settings.setValue('maintenanceMode', false);
      await saveNow('settings');
      reply('✅ *Maintenance Mode* is now *OFF*.\nAll users can use the bot again.');
    } else {
      const current = db.settings.getValue('maintenanceMode');
      reply(`🔧 *Maintenance Mode:* ${current ? '✅ ON' : '❌ OFF'}\n\nUsage: .maintenance on/off`);
    }
  },
};
