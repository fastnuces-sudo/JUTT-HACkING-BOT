export default {
  command: 'ping',
  alias: ['speed'],
  description: 'Check bot response speed',
  category: 'utility',
  async execute({ reply, msg }) {
    const start = Date.now();
    await reply('🏓 Pinging...');
    const ms = Date.now() - start;
    reply(`🏓 *Pong!*\n⚡ Speed: *${ms}ms*`);
  },
};
