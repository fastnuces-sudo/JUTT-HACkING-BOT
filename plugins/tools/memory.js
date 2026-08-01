import os from 'os';
import { formatBytes } from '../../lib/helper.js';

export default {
  command: 'memory',
  alias: ['ram', 'mem'],
  description: 'Show memory usage details',
  category: 'tools',
  async execute({ reply }) {
    const mem = process.memoryUsage();
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const pct = ((used / total) * 100).toFixed(1);
    const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
    reply(`💾 *Memory Usage*\n\n[${bar}] ${pct}%\n\n🖥️ System:\n├ Total: ${formatBytes(total)}\n├ Used: ${formatBytes(used)}\n└ Free: ${formatBytes(free)}\n\n🤖 Process:\n├ Heap Used: ${formatBytes(mem.heapUsed)}\n├ Heap Total: ${formatBytes(mem.heapTotal)}\n├ RSS: ${formatBytes(mem.rss)}\n└ External: ${formatBytes(mem.external)}`);
  },
};
