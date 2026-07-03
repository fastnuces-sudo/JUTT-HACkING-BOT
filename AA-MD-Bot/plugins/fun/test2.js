// ============================================
// AA MD Bot - Bot Status (externalAdReply card)
// ============================================
import config from '../../config.js';

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

    await sock.sendMessage(jid, {
      text: '✅ *BOT IS CURRENTLY ACTIVE!*',
      contextInfo: {
        externalAdReply: {
          title: config.botName || 'AA MD Bot',
          body: 'Multi-Device WhatsApp Bot • Always Online',
          sourceUrl: 'https://whatsapp.com/channel/0029Vb5axis2v1IloX5BQD2c',
          showAdAttribution: true,
          ...(thumbBuf?.length ? { thumbnail: thumbBuf } : {}),
          mediaType: 1,
        },
      },
    }, { quoted: msg });

    await react('✅');
  },
};
