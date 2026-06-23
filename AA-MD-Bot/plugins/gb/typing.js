// ============================================
// AA MD Bot - Fake Typing / Recording (GB Feature)
// Simulate typing or recording presence
// ============================================

export default {
  command: 'typing',
  alias: ['faketype', 'recording', 'fakerecord', 'presence'],
  category: 'gb',
  description: 'Simulate typing or recording presence in a chat',
  usage: '.typing <seconds>  |  .recording <seconds>',
  ownerOnly: true,

  async execute({ reply, react, args, sock, jid, msg, command }) {
    const seconds = Math.min(parseInt(args[0]) || 5, 30); // max 30s
    const isRecording = command === 'recording' || command === 'fakerecord';
    const presenceType = isRecording ? 'recording' : 'composing';
    const label = isRecording ? '🎙️ Recording' : '⌨️ Typing';

    try {
      await sock.sendPresenceUpdate(presenceType, jid);
      await react('✅');
      await reply(`${label} presence sent for *${seconds}s* in this chat.`);

      setTimeout(async () => {
        try { await sock.sendPresenceUpdate('paused', jid); } catch {}
      }, seconds * 1000);
    } catch (err) {
      await react('❌');
      reply(`❌ Failed: ${err.message?.slice(0, 60)}`);
    }
  },
};
