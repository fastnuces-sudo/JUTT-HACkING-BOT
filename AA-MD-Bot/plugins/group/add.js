export default {
  command: 'add',
  alias: ['addmember'],
  description: 'Add a member to the group',
  category: 'group',
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, jid, reply, args }) {
    if (!args[0]) return reply('❌ Usage: .add [number]\nExample: .add 923001234567');
    const number = args[0].replace(/[^0-9]/g, '');
    const targetJid = `${number}@s.whatsapp.net`;
    try {
      const result = await sock.groupParticipantsUpdate(jid, [targetJid], 'add');
      const status = result?.[0]?.status;
      if (status === '200') reply(`✅ +${number} has been added to the group!`);
      else if (status === '403') reply(`❌ +${number} has privacy settings that prevent adding.`);
      else if (status === '408') reply(`❌ +${number} is not on WhatsApp.`);
      else reply(`⚠️ Add result: ${status} for +${number}`);
    } catch (err) {
      reply('❌ Failed to add. Please try again in a few seconds.');
    }
  },
};
