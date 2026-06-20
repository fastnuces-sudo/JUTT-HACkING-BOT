import os from 'os';
import { formatBytes, formatDuration } from '../../lib/helper.js';
import config from '../../config.js';

export default {
  command: 'info',
  alias: ['botinfo', 'about'],
  description: 'Show bot information',
  category: 'utility',
  async execute({ reply, sock }) {
    const mem = process.memoryUsage();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    reply(`🤖 *Bot Information*\n\n📛 Name: *${config.botName}*\n👨‍💻 Developer: *${config.developer}*\n🏢 Brand: *${config.brand}*\n🔖 Version: *${config.version}*\n\n🖥️ *System*\n├ OS: *${os.type()} ${os.release()}*\n├ Platform: *${process.platform}*\n├ Node.js: *${process.version}*\n├ RAM Used: *${formatBytes(usedMem)} / ${formatBytes(totalMem)}*\n├ Heap: *${formatBytes(mem.heapUsed)} / ${formatBytes(mem.heapTotal)}*\n└ CPU: *${os.cpus()[0]?.model || 'Unknown'}*`);
  },
};
