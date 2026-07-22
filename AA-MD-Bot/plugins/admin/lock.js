export default {
  command: 'lock',
  alias: ['close', 'lockgroup'],
  description: 'Lock group — only admins can send messages',
  category: 'admin',
  groupOnly: true,
  adminOnly: true,
  async execute({ sock, jid, msg, reply }) {
    try {
      await sock.groupSettingUpdate(jid, 'announcement');
      reply('🔒 *Group locked.*\nOnly admins can send messages now.');
    } catch {
      reply('❌ Failed to lock group. Make sure I am an admin.');
    }
  },
};
