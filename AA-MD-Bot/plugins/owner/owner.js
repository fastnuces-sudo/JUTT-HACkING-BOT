import config from '../../config.js';

export default {
  command: 'owner',
  alias: ['developer', 'dev', 'creator'],
  description: 'Show bot owner information',
  category: 'owner',
  async execute({ reply }) {
    reply(`👑 *Bot Owner Information*\n\n🤖 Bot: *${config.botName}*\n👨‍💻 Developer: *${config.developer}*\n🏢 Brand: *${config.brand}*\n🔖 Version: *${config.version}*\n\n📞 Contact the developer for support.\n\n💻 Powered by Baileys | Node.js ${process.version}`);
  },
};
