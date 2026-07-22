export default {
  command: 'unlock',
  alias: ['open', 'unlockgroup'],
  description: 'Unlock group — everyone can send messages',
  category: 'admin',
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, jid, msg, reply }) {
    try {
      await sock.groupSettingUpdate(jid, 'not_announcement');
      reply('🔓 *Group unlocked.*\nEveryone can send messages now.');
    } catch {
      reply('❌ Failed to unlock group. Make sure I am an admin.');
    }
  },
};
