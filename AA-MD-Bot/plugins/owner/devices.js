import { getAllSessions } from '../../lib/sessionManager.js';
import { formatDuration } from '../../lib/helper.js';
import { db } from '../../lib/database.js';

export default {
  command: 'devices',
  alias: ['sessions', 'allsessions'],
  description: 'Show all connected WhatsApp sessions across all servers',
  category: 'owner',
  ownerOnly: true,
  superOwnerOnly: true,
  async execute({ reply }) {
    // db.sessions.all() = Firebase (shared across ALL servers)
    const dbSessions = db.sessions.all();
    const dbIds = Object.keys(dbSessions);

    if (!dbIds.length) return reply('📱 No sessions found in database.');

    // Local live sessions — to mark which ones are alive on THIS server
    const liveSessions = getAllSessions();
    const liveMap = new Map(liveSessions.map(s => [s.id, s]));

    const thisServer = process.env.SERVER_ID
      || process.env.RAILWAY_SERVICE_NAME
      || process.env.RAILWAY_REPLICA_ID
      || 'server-1';

    let text = `📱 *All Sessions — All Servers (${dbIds.length})*\n`;
    text += `🖥️ *This server:* ${thisServer}\n\n`;

    dbIds.forEach((id, i) => {
      const d = dbSessions[id] || {};
      const live = liveMap.get(id);

      const status = live
        ? (live.connected ? '🟢 Live' : '🔄 Reconnecting')
        : '⚫ Offline';

      const uptime = d.connectedAt
        ? formatDuration(Date.now() - d.connectedAt)
        : 'Unknown';

      const server = d.server || 'unknown';
      const phone = d.jid?.split('@')[0]?.split(':')[0] || id;
      const name = d.name || 'Unknown';

      text += `*${i + 1}. ${id}*\n`;
      text += `   📞 Phone: +${phone}\n`;
      text += `   👤 Name: ${name}\n`;
      text += `   🖥️ Server: ${server}\n`;
      text += `   ${status}\n`;
      text += `   ⏱️ Connected: ${uptime} ago\n\n`;
    });

    text += `━━━━━━━━━━━━━━━\n`;
    text += `🟢 Live = active on THIS server\n`;
    text += `⚫ Offline = on another server or disconnected`;

    reply(text);
  },
};
