export default {
  command: 'restart',
  alias: ['reboot'],
  description: 'Restart the bot (owner only)',
  category: 'owner',
  ownerOnly: true,
  superOwnerOnly: true,
  async execute({ reply }) {
    await reply('🔄 Restarting AA MD Bot...\n\n⏳ Please wait a moment.');
    setTimeout(() => process.exit(0), 2000);
  },
};
