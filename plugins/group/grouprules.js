export default {
  command: 'rules',
  alias: ['grouprules', 'setrules', 'delrules'],
  description: 'View or set group rules',
  category: 'group',
  groupOnly: true,
  async execute({ reply, jid, args, text, db, isAdmin, command }) {
    const group = db.groups.get(jid);

    // Delete rules
    if (command === 'delrules') {
      if (!isAdmin) return reply('⛔ Only admins can delete rules.');
      db.groups.set(jid, { rules: '' });
      return reply('🗑️ *Group rules deleted.*');
    }

    // Set rules
    if (command === 'setrules' || (text && isAdmin && args.length)) {
      if (!isAdmin) return reply('⛔ Only admins can set rules.');
      if (!text) return reply('❌ Usage: .setrules [your rules here]');
      db.groups.set(jid, { rules: text });
      return reply(`✅ *Group rules saved!*\n\nType .rules to view them.`);
    }

    // View rules
    if (!group.rules) {
      return reply('📋 *No rules set for this group.*\n\nAdmins can set rules with:\n*.setrules [rules here]*');
    }

    reply(`📋 *Group Rules*\n\n${group.rules}\n\n> 🤖 *AA MD Bot*`);
  },
};
