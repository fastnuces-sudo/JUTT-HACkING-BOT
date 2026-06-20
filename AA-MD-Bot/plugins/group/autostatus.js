// ============================================
// AA MD Bot - Auto Status Saver Plugin
// Developer: Ahsan Ali | AA Mods
// Toggle status auto-save & forwarding to owner DM
// ============================================

export default {
  command: 'autostatus',
  alias: ['stvsave', 'statussave', 'statusview', 'statusreact'],
  description: 'Auto save & forward status updates to owner DM',
  category: 'owner',
  ownerOnly: true,
  usage: '.autostatus on/off',

  async execute({ reply, args, command, db, config }) {
    const toggle = args[0]?.toLowerCase();
    const cmd = command.toLowerCase();

    // Handle statusview and statusreact sub-commands
    if (cmd === 'statusview') {
      const cur = db.settings.getValue('autoStatusView') ?? config.autoStatusView ?? true;
      if (!toggle || !['on', 'off'].includes(toggle)) {
        return reply(`👁️ *Auto Status View* is *${cur ? 'ON ✅' : 'OFF ❌'}*\n\nUsage: *.statusview on/off*\nWhen ON, the bot silently views all contact statuses.`);
      }
      const val = toggle === 'on';
      db.settings.setValue('autoStatusView', val);
      return reply(`👁️ Auto Status View is now *${val ? 'ON ✅' : 'OFF ❌'}*`);
    }

    if (cmd === 'statusreact') {
      const cur = db.settings.getValue('autoStatusReact') ?? config.autoStatusReact ?? true;
      const emoji = db.settings.getValue('statusEmoji') ?? config.statusEmoji ?? '❤️';
      if (!toggle || !['on', 'off'].includes(toggle)) {
        return reply(`${emoji} *Auto Status React* is *${cur ? 'ON ✅' : 'OFF ❌'}*\n\nReacts to statuses with: ${emoji}\nUsage: *.statusreact on/off*`);
      }
      const val = toggle === 'on';
      db.settings.setValue('autoStatusReact', val);
      return reply(`${emoji} Auto Status React is now *${val ? 'ON ✅' : 'OFF ❌'}*`);
    }

    // Main autostatus command
    const current = db.settings.getValue('autoStatus') ?? false;
    const viewOn  = db.settings.getValue('autoStatusView')  ?? config.autoStatusView  ?? true;
    const reactOn = db.settings.getValue('autoStatusReact') ?? config.autoStatusReact ?? true;
    const emoji   = db.settings.getValue('statusEmoji')     ?? config.statusEmoji     ?? '❤️';

    if (!toggle || !['on', 'off'].includes(toggle)) {
      return reply(
        `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `  📸  *AUTO STATUS SAVER*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💾 *Save & Forward:* ${current  ? '✅ ON' : '❌ OFF'}\n` +
        `👁️ *Auto View:*      ${viewOn   ? '✅ ON' : '❌ OFF'}\n` +
        `${emoji} *Auto React:*     ${reactOn  ? '✅ ON' : '❌ OFF'}\n\n` +
        `━━━━━━ *Commands* ━━━━━━\n` +
        `*.autostatus on/off*   — Toggle status saving\n` +
        `*.statusview on/off*   — View statuses silently\n` +
        `*.statusreact on/off* — React to statuses\n\n` +
        `💡 When ON, every contact's status is forwarded to your own DM.`
      );
    }

    const value = toggle === 'on';
    db.settings.setValue('autoStatus', value);
    return reply(
      `📸 *Auto Status Saver* is now *${value ? 'ON ✅' : 'OFF ❌'}*\n\n` +
      (value
        ? `All status updates from your contacts will be forwarded to your DM automatically.`
        : `Status forwarding disabled.`)
    );
  },
};
