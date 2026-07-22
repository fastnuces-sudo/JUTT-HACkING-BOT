export default {
  command: 'pin',
  alias: ['pinmsg'],
  description: 'Pin a message in group (reply to message)',
  category: 'admin',
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, jid, msg, reply, args }) {
    const ctxInfo  = msg.message?.extendedTextMessage?.contextInfo;
    const stanzaId = ctxInfo?.stanzaId;
    if (!stanzaId) return reply('❌ Reply to a message to pin it.\nUsage: .pin (reply to msg)\nOptional duration: .pin 24h | .pin 7d | .pin 30d');

    // Duration parsing
    let duration = 0;
    const d = (args[0] || '').toLowerCase();
    if (d === '24h') duration = 86400;
    else if (d === '7d') duration = 604800;
    else if (d === '30d') duration = 2592000;

    const targetKey = {
      remoteJid:   jid,
      fromMe:      !ctxInfo?.participant,
      id:          stanzaId,
      participant: ctxInfo?.participant || undefined,
    };

    try {
      await sock.sendMessage(jid, { pin: { type: 1, time: duration }, key: targetKey });
      reply(`📌 *Message pinned!*${duration ? `\nDuration: ${args[0]}` : '\nDuration: forever'}`);
    } catch {
      reply('❌ Failed to pin. Make sure I am an admin.');
    }
  },
};
