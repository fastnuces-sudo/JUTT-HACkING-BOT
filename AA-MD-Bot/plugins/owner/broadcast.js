// AA MD Bot - Broadcast Message to All Groups
export default {
  command: 'broadcast',
  alias: ['bc', 'bcall', 'broadcastall'],
  description: 'Broadcast a message to all groups the bot is in',
  category: 'owner',
  ownerOnly: true,

  async execute({ text, sock, jid, reply, react, msg }) {
    if (!text) {
      return reply(
        `📢 *Broadcast*\n\n` +
        `*Usage:* .broadcast <message>\n\n` +
        `This will send your message to all groups the bot is in.\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    await react('⏳');

    let groups;
    try {
      groups = await sock.groupFetchAllParticipating();
    } catch (err) {
      await react('❌');
      return reply(`❌ Failed to fetch groups: ${err.message}`);
    }

    const groupJids = Object.keys(groups || {});
    if (!groupJids.length) {
      await react('❌');
      return reply('❌ Bot is not in any groups.');
    }

    await reply(`📢 Broadcasting to *${groupJids.length}* group(s)…`);

    let sent = 0, failed = 0;
    for (const g of groupJids) {
      try {
        await sock.sendMessage(g, {
          text: `📢 *Broadcast from AA MD Bot*\n\n${text}\n\n> 🤖 *AA MD Bot*`,
        });
        sent++;
        // Delay to avoid ban
        await new Promise(r => setTimeout(r, 1000));
      } catch {
        failed++;
      }
    }

    await react('✅');
    await reply(
      `✅ *Broadcast Complete*\n\n` +
      `• Sent: *${sent}*\n` +
      `• Failed: *${failed}*\n\n` +
      `> 🤖 *AA MD Bot*`
    );
  },
};
