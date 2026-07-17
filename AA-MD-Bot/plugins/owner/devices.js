import { getAllSessions, sessions } from '../../lib/sessionManager.js';
import { formatDuration } from '../../lib/helper.js';
import { db } from '../../lib/database.js';

export default {
  command: 'devices',
  alias: ['sessions', 'allsessions'],
  description: 'Show all connected WhatsApp sessions',
  category: 'owner',
  ownerOnly: true,
  superOwnerOnly: true,
  async execute({ reply }) {
    const allSessions = getAllSessions();
    if (!allSessions.length) return reply('📱 No active sessions found.');
    const dbSessions = db.sessions.all();
    let text = `📱 *Connected Sessions (${allSessions.length})*\n\n`;
    allSessions.forEach((s, i) => {
      const dbData = dbSessions[s.id] || {};
      const connectedAt = dbData.connectedAt ? formatDuration(Date.now() - dbData.connectedAt) : 'Unknown';
      text += `${i + 1}. *${s.id}*\n`;
      text += `   📞 JID: ${s.jid || 'Unknown'}\n`;
      text += `   👤 Name: ${s.name || 'Unknown'}\n`;
      text += `   🟢 Connected: ${s.connected ? 'Yes' : 'No'}\n`;
      text += `   ⏱️ Uptime: ${connectedAt}\n\n`;
    });
    reply(text);
  },
};
