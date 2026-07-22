export default {
  command: 'members',
  alias: ['listmembers', 'memberlist', 'participants'],
  description: 'List all group members',
  category: 'group',
  groupOnly: true,
  async execute({ sock, jid, msg, reply }) {
    try {
      const meta    = await sock.groupMetadata(jid);
      const members = meta.participants;
      const admins  = members.filter(p => p.admin).length;

      const list = members.map((p, i) => {
        const num  = p.id.split('@')[0];
        const tag  = p.admin === 'superadmin' ? ' 👑' : p.admin === 'admin' ? ' 🛡️' : '';
        return `${i + 1}. @${num}${tag}`;
      }).join('\n');

      // Split if too long (>4000 chars)
      const header = `👥 *${meta.subject} — Members*\n\n`;
      const footer = `\n\n📊 *Total:* ${members.length} | 🛡️ Admins: ${admins}`;
      const full   = header + list + footer;

      if (full.length > 4000) {
        const chunks = [];
        let cur = header;
        for (const line of list.split('\n')) {
          if ((cur + line + '\n').length > 3800) {
            chunks.push(cur);
            cur = '';
          }
          cur += line + '\n';
        }
        if (cur) chunks.push(cur + footer);
        for (const chunk of chunks) {
          await sock.sendMessage(jid, { text: chunk, mentions: members.map(p => p.id) }, { quoted: msg });
        }
      } else {
        await sock.sendMessage(jid, { text: full, mentions: members.map(p => p.id) }, { quoted: msg });
      }
    } catch {
      reply('❌ Failed to fetch members. Try again.');
    }
  },
};
