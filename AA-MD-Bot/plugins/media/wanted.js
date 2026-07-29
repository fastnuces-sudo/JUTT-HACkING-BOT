// AA MD Bot — Wanted Poster Canvacord Effect
// Puts someone's DP on a wanted poster

export default {
  command: 'wanted',
  alias: ['wantedposter'],
  description: 'Put someone\'s DP on a wanted poster (tag or reply)',
  category: 'media',

  async execute({ sock, msg, jid, react, reply, quoted, senderJid, config }) {
    await react('⌛');
    try {
      let canvacord = null;
      try { const cc = await import('canvacord'); canvacord = cc.default ?? cc; } catch {}
      if (!canvacord?.Canvacord?.wanted) throw new Error('canvacord not available on this server');

      const TAG = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const targetJid = quoted?.key?.participant || quoted?.key?.remoteJid || TAG[0] || senderJid;
      let img;
      try { img = await sock.profilePictureUrl(targetJid, 'image'); }
      catch { img = 'https://telegra.ph/file/9521e9ee2fdbd0d6f4f1c.jpg'; }

      const result = await canvacord.Canvacord.wanted(img);
      const botName = config?.botName || 'AA MD Bot';
      await sock.sendMessage(jid, {
        image: result,
        caption:
          `🤠 *Wanted Poster*\n\n> 🤖 *${botName}*`,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *Wanted effect failed.*\n${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
