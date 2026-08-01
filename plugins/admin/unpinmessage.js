export default {
  command: 'unpin',
  alias: ['unpinmsg'],
  description: 'Unpin a message in group (reply to message)',
  category: 'admin',
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, jid, msg, reply }) {
    const ctxInfo  = msg.message?.extendedTextMessage?.contextInfo;
    const stanzaId = ctxInfo?.stanzaId;
    if (!stanzaId) return reply('❌ Reply to the pinned message to unpin it.');

    const targetKey = {
      remoteJid:   jid,
      fromMe:      !ctxInfo?.participant,
      id:          stanzaId,
      participant: ctxInfo?.participant || undefined,
    };

    try {
      await sock.sendMessage(jid, { pin: { type: 2, time: 0 }, key: targetKey });
      reply('📌 *Message unpinned.*');
    } catch {
      reply('❌ Failed to unpin. Make sure I am an admin.');
    }
  },
};
