import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');

export default {
  command: 'restart',
  alias: ['reboot'],
  description: 'Restart the bot',
  category: 'owner',
  ownerOnly: true,
  superOwnerOnly: true,

  async execute({ reply }) {
    await reply(
      `🔄 *Restarting AA MD Bot...*\n\n` +
      `⏳ Will be back in ~10 seconds.\n\n` +
      `> 🤖 *AA MD Bot*`
    );

    // Wait for reply to be delivered, then spawn a fresh process and exit
    setTimeout(() => {
      try {
        // Spawn a new bot process detached so it outlives the current one
        const child = spawn('node', ['index.js'], {
          cwd: ROOT,
          detached: true,
          stdio: 'ignore',
          env: { ...process.env },
        });
        child.unref();
      } catch {}

      // Exit current process — Replit workflow will also restart automatically
      process.exit(0);
    }, 2500);
  },
};
