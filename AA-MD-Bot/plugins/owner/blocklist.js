// AA MD Bot - Show / Manage Bot Block List
export default {
  command: 'blocklist',
  alias: ['listblock', 'blocked', 'getblocklist'],
  description: 'Show the bot\'s blocked numbers list',
  category: 'owner',
  ownerOnly: true,

  async execute({ sock, msg, jid, reply, react }) {
    await react('⏳');
    try {
      const list = await sock.fetchBlocklist();

      if (!list?.length) {
        await react('✅');
        return reply('📋 *Block List*\n\nNo numbers are currently blocked.\n\n> 🤖 *AA MD Bot*');
      }

      const formatted = list.map((jid, i) => `${i + 1}. +${jid.replace('@s.whatsapp.net', '')}`).join('\n');

      await react('✅');
      await reply(
        `🚫 *Block List* (${list.length} number${list.length !== 1 ? 's' : ''})\n\n` +
        `${formatted}\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    } catch (err) {
      await react('❌');
      await reply(`❌ Failed to fetch block list: ${err.message}`);
    }
  },
};
