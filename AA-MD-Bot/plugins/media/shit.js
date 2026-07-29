// AA MD Bot — Shit Canvacord Effect
// Puts someone's DP on a "shit" image

export default {
  command: 'shit',
  alias: [],
  description: 'Put someone\'s DP on a shit image (tag or reply)',
  category: 'media',

  async execute({ sock, msg, jid, react, reply, quoted, senderJid, config }) {
    await react('⌛');
    try {
      let canvacord = null;
      try { const cc = await import('canvacord'); canvacord = cc.default ?? cc; } catch {}
      if (!canvacord?.Canvacord?.shit) throw new Error('canvacord not available on this server');

      const TAG = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const targetJid = quoted?.key?.participant || quoted?.key?.remoteJid || TAG[0] || senderJid;
      let img;
      try { img = await sock.profilePictureUrl(targetJid, 'image'); }
      catch { img = 'https://telegra.ph/file/9521e9ee2fdbd0d6f4f1c.jpg'; }

      const result = await canvacord.Canvacord.shit(img);
      const botName = config?.botName || 'AA MD Bot';
      await sock.sendMessage(jid, {
        image: result,
        caption:
          `💩 *Shit Effect*\n\n> 🤖 *${botName}*`,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *Shit effect failed.*\n${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
