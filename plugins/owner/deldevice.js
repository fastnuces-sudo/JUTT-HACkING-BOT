import { deleteSession, getAllSessions } from '../../lib/sessionManager.js';

export default {
  command: 'deldevice',
  alias: ['delsession', 'removesession'],
  description: 'Delete a WhatsApp session',
  category: 'owner',
  ownerOnly: true,
  superOwnerOnly: true,
  async execute({ reply, args }) {
    const sessionId = args[0];
    if (!sessionId) {
      const sessions = getAllSessions();
      return reply(`❌ Usage: .deldevice [session_id]\n\n📱 Active sessions:\n${sessions.map(s => `• ${s.id}`).join('\n')}`);
    }
    if (sessionId === 'default') return reply('❌ Cannot delete the default session.');
    try {
      await deleteSession(sessionId);
      reply(`✅ Session *${sessionId}* has been deleted successfully.`);
    } catch (err) {
      reply('❌ Failed to delete session. Please try again in a few seconds.');
    }
  },
};
