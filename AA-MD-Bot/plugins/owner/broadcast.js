import { getAllSessions } from '../../lib/sessionManager.js';
import { db } from '../../lib/database.js';
import config from '../../config.js';

function buildBroadcastMessage(message) {
  const botName = config.botName || 'AA MD Bot';
  const date = new Date().toLocaleString('en-US', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    `╭─────────────────────╮\n` +
    `      📢 *ANNOUNCEMENT*\n` +
    `╰─────────────────────╯\n\n` +
    `${message}\n\n` +
    `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n` +
    `🤖 *${botName}*\n` +
    `🕐 ${date}`
  );
}

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
    const finalText = buildBroadcastMessage(message);

    const ctx = {
      externalAdReply: {
        title: `${config.botName || 'AA MD Bot'} • Official Update`,
        body: 'Broadcast from the bot',
        sourceUrl: config.channelLink || undefined,
        showAdAttribution: true,
        mediaType: 1,
      },
    };

    let sentGroups = 0, failedGroups = 0;
    let sentDM = 0, failedDM = 0;

    try {
      if (toGroups) {
        const chats = await sock.groupFetchAllParticipating();
        for (const [jid] of Object.entries(chats)) {
          try {
            await sock.sendMessage(jid, { text: finalText, contextInfo: ctx });
            sentGroups++;
            await new Promise((r) => setTimeout(r, 600));
          } catch { failedGroups++; }
        }
      }

      if (toDM) {
        const users = db.users.all();
        const ownerJids = new Set((config.ownerNumber || []).map((n) => `${n}@s.whatsapp.net`));
        for (const jid of Object.keys(users)) {
          if (!jid.endsWith('@s.whatsapp.net')) continue;
          if (ownerJids.has(jid)) continue;
          try {
            await sock.sendMessage(jid, { text: finalText, contextInfo: ctx });
            sentDM++;
            await new Promise((r) => setTimeout(r, 600));
          } catch { failedDM++; }
        }
      }

      const summary =
        `✅ *Broadcast Complete*\n\n` +
        (toGroups ? `👥 Groups — ✅ ${sentGroups}  ❌ ${failedGroups}\n` : '') +
        (toDM ? `💬 DMs — ✅ ${sentDM}  ❌ ${failedDM}\n` : '') +
        `\n📨 Message delivered directly from the bot to every chat — recipients see it as a normal message in their chat, not from your personal number.`;

      reply(summary);
    } catch (err) {
      reply(`❌ Broadcast failed: ${err.message}`);
    }
  },
};
