import { createSession } from '../../lib/sessionManager.js';

export default {
  command: 'adddevice',
  alias: ['newsession', 'addsession'],
  description: 'Add a new WhatsApp session',
  category: 'owner',
  ownerOnly: true,
  async execute({ reply, args }) {
    const sessionId = args[0] || `device_${Date.now()}`;
    if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) return reply('❌ Session ID must be alphanumeric with _ or - only.');
    try {
      await reply(`📱 *Creating session:* ${sessionId}\n\n⏳ Scan the QR code that appears in the console/terminal.`);
      await createSession(sessionId);
    } catch (err) {
      reply('❌ Failed to create session. Please try again in a few seconds.');
    }
  },
};
