// ============================================
// AA MD Bot - Bot Status (externalAdReply card)
// ============================================
import config from '../../config.js';

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

export default {
  command: 'test2',
  alias: ['botstatus', 'status2'],
  description: 'Check if bot is active (shows a nice card)',
  category: 'fun',

  async execute({ sock, msg, jid, react, reply }) {
    // Fetch thumbnail with a 5s timeout so it never blocks the response
    const botPic = config.botPic || config.BOT_PIC || '';
    let thumbBuf;
    if (botPic) {
      try {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 5000);
        const res = await fetch(botPic, { signal: ac.signal });
        clearTimeout(timer);
        thumbBuf = Buffer.from(await res.arrayBuffer());
      } catch { /* no thumbnail — skip */ }
    }

    const uptime = formatUptime(process.uptime());
    const botName = config.botName || 'AA MD Bot';
    const version = config.version ? `v${config.version}` : '';
    const ping = Date.now() - (msg.messageTimestamp ? msg.messageTimestamp * 1000 : Date.now());
    const pingText = Number.isFinite(ping) && ping >= 0 ? `${ping}ms` : 'instant';

    const statusText =
      `╔═══════════════════╗\n` +
      `   ✅ *BOT IS ACTIVE*\n` +
      `╚═══════════════════╝\n\n` +
      `🤖 *${botName}* ${version} is up, running smoothly and ready to help you right now!\n\n` +
      `⚡ *Response speed:* ${pingText}\n` +
      `⏱️ *Uptime:* ${uptime}\n` +
      `📶 *Connection:* Stable\n\n` +
      `Type *.menu* anytime to see everything I can do. 💚`;

    await sock.sendMessage(jid, {
      text: statusText,
      contextInfo: {
        externalAdReply: {
          title: `${botName} • Online & Ready`,
          body: 'Multi-Device WhatsApp Bot • Always Online',
          sourceUrl: 'https://whatsapp.com/channel/0029Vb8Yk2LL2AU78HliE617',
          showAdAttribution: true,
          ...(thumbBuf?.length ? { thumbnail: thumbBuf } : {}),
          mediaType: 1,
        },
      },
    }, { quoted: msg });

    await react('✅');
  },
};
