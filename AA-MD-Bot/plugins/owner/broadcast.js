import { getAllSessions } from '../../lib/sessionManager.js';

export default {
  command: 'broadcast',
  alias: ['bc', 'broadcastall'],
  description: 'Broadcast message to all groups/DMs',
  category: 'owner',
  ownerOnly: true,
  superOwnerOnly: true,
  async execute({ reply, sock, text, args }) {
    if (!text) return reply('❌ Usage: .broadcast [message]\nFlags: --groups (groups only), --dm (DMs only)');
    const toGroups = !args.includes('--dm');
    const toDM = !args.includes('--groups');
    const message = text.replace(/--\w+/g, '').trim();
    try {
      const chats = await sock.groupFetchAllParticipating();
      let sent = 0, failed = 0;
      for (const [jid] of Object.entries(chats)) {
        if (toGroups) {
          try {
            await sock.sendMessage(jid, { text: `📢 *[BROADCAST]*\n\n${message}` });
            sent++;
            await new Promise(r => setTimeout(r, 500));
          } catch { failed++; }
        }
      }
      reply(`✅ *Broadcast Complete*\n\n✅ Sent: ${sent}\n❌ Failed: ${failed}`);
    } catch (err) {
      reply(`❌ Broadcast failed: ${err.message}`);
    }
  },
};
