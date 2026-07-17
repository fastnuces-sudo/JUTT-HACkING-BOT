import os from 'os';
import { formatBytes, formatDuration } from '../../lib/helper.js';

export default {
  command: 'system',
  alias: ['sysinfo', 'server'],
  description: 'Show system resource usage',
  category: 'tools',
  ownerOnly: true,
  superOwnerOnly: true,
  async execute({ reply }) {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPct = ((usedMem / totalMem) * 100).toFixed(1);
    const cpus = os.cpus();
    const uptime = os.uptime() * 1000;
    const procUptime = process.uptime() * 1000;
    const memUsage = process.memoryUsage();
    reply(`🖥️ *System Information*\n\n💻 *CPU*\n├ Model: ${cpus[0]?.model || 'Unknown'}\n├ Cores: ${cpus.length}\n└ Speed: ${cpus[0]?.speed || 0} MHz\n\n💾 *Memory*\n├ Used: ${formatBytes(usedMem)} (${memPct}%)\n├ Free: ${formatBytes(freeMem)}\n└ Total: ${formatBytes(totalMem)}\n\n🤖 *Process*\n├ Heap: ${formatBytes(memUsage.heapUsed)} / ${formatBytes(memUsage.heapTotal)}\n├ RSS: ${formatBytes(memUsage.rss)}\n└ Uptime: ${formatDuration(procUptime)}\n\n⏱️ *System Uptime:* ${formatDuration(uptime)}\n🖥️ *Platform:* ${os.type()} ${os.release()}\n📦 *Node.js:* ${process.version}`);
  },
};
