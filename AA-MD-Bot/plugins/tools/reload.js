import { reloadPlugins, plugins } from '../../lib/pluginLoader.js';

export default {
  command: 'reload',
  alias: ['reloadplugins', 'refreshplugins'],
  description: 'Reload all bot plugins',
  category: 'tools',
  ownerOnly: true,
  superOwnerOnly: true,
  async execute({ reply }) {
    await reply('⏳ Reloading plugins...');
    try {
      const count = await reloadPlugins();
      reply(`✅ *Plugins Reloaded!*\n\n📦 Total loaded: *${count}* plugins\n\nAll commands are now refreshed!`);
    } catch (err) {
      reply('❌ Reload failed. Please try again in a few seconds.');
    }
  },
};
