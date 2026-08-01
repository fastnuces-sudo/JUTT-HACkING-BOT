import { formatDuration } from '../../lib/helper.js';
import os from 'os';

const startTime = Date.now();

export default {
  command: 'uptime',
  alias: ['runtime'],
  description: 'Show bot uptime',
  category: 'utility',
  async execute({ reply }) {
    const uptime = Date.now() - startTime;
    const sysUptime = os.uptime() * 1000;
    reply(`⏱️ *Bot Uptime*\n\n🤖 Bot: *${formatDuration(uptime)}*\n🖥️ System: *${formatDuration(sysUptime)}*`);
  },
};
