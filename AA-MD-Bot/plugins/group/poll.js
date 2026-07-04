export default {
  command: 'poll',
  alias: ['vote', 'survey'],
  description: 'Create a poll in the group',
  category: 'group',
  groupOnly: true,
  async execute({ sock, jid, msg, reply, text }) {
    if (!text) return reply('❌ Usage: .poll [question] | option1 | option2 | ...\nExample: .poll Favourite color? | Red | Blue | Green');
    const parts = text.split('|').map(s => s.trim());
    if (parts.length < 3) return reply('❌ Need at least 2 options\nFormat: .poll [question] | option1 | option2');
    const question = parts[0];
    const options = parts.slice(1, 13);
    try {
      await sock.sendMessage(jid, {
        poll: {
          name: question,
          values: options,
          selectableCount: 1,
        },
      }, { quoted: msg });
    } catch (err) {
      reply('❌ Poll failed. Please try again in a few seconds.');
    }
  },
};
