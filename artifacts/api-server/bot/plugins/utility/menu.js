import { getCategories, plugins } from '../../lib/pluginLoader.js';
import { getDate, getTime } from '../../lib/helper.js';
import config from '../../config.js';

export default {
  command: 'menu',
  alias: ['help', 'commands', 'cmds'],
  description: 'Show all available commands',
  category: 'utility',
  async execute({ reply, args, db, config: cfg }) {
    const cats = getCategories();
    const settings = db.settings.get();
    const prefix = (settings.prefix || cfg.prefix)[0];

    if (args[0]) {
      const cat = args[0].toLowerCase();
      const cmds = cats[cat];
      if (!cmds) {
        return reply(`❌ Category *${cat}* not found.\n\nAvailable: ${Object.keys(cats).join(', ')}`);
      }
      let text = `╔═══ 《 ${cat.toUpperCase()} 》 ═══\n`;
      cmds.forEach(cmd => {
        const p = plugins.get(cmd);
        text += `║ ${prefix}${cmd}${p?.alias ? ` (${[].concat(p.alias)[0]})` : ''}\n`;
        if (p?.description) text += `║   ↳ ${p.description}\n`;
      });
      text += `╚═══════════════════`;
      return reply(text);
    }

    let text = `╔══════════════════════════╗\n`;
    text += `║   🤖 *${cfg.botName}*   ║\n`;
    text += `║  Developer: ${cfg.developer.split(' ')[0]}   ║\n`;
    text += `║  Brand: ${cfg.brand}          ║\n`;
    text += `╚══════════════════════════╝\n\n`;
    text += `📅 *Date:* ${getDate()}\n`;
    text += `⏰ *Time:* ${getTime()}\n`;
    text += `🔧 *Prefix:* ${prefix}\n`;
    text += `📦 *Plugins:* ${plugins.size}\n\n`;

    for (const [cat, cmds] of Object.entries(cats)) {
      const emoji = {
        admin: '👮', owner: '👑', fun: '🎮', utility: '🔧',
        search: '🔍', download: '📥', media: '🎨', group: '👥',
        tools: '🛠️', economy: '💰', level: '⭐', misc: '📌',
      }[cat] || '📁';
      text += `${emoji} *${cat.toUpperCase()}* (${cmds.length})\n`;
      text += cmds.map(c => `  ➤ ${prefix}${c}`).join('\n') + '\n\n';
    }

    text += `\n💡 Use *${prefix}menu [category]* for detailed info`;
    reply(text);
  },
};
