import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default {
  command: 'shell',
  alias: ['sh', '$'],
  description: 'Execute shell command (owner only)',
  category: 'owner',
  ownerOnly: true,
  superOwnerOnly: true,
  async execute({ reply, text }) {
    if (!text) return reply('❌ Usage: .shell [command]');
    try {
      const { stdout, stderr } = await execAsync(text, { timeout: 30000 });
      const output = stdout || stderr || 'No output';
      reply(`💻 *Shell Output*\n\n\`\`\`${output.substring(0, 3500)}\`\`\``);
    } catch (err) {
      reply(`❌ *Shell Error*\n\n\`\`\`${err.message.substring(0, 3000)}\`\`\``);
    }
  },
};
