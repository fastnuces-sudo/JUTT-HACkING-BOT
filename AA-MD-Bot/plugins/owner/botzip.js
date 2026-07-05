// ============================================
// AA MD Bot - Export Bot Source Code (ZIP)
// Owner-only: archives the entire bot folder
// ============================================

import { createRequire } from 'module';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const require  = createRequire(import.meta.url);
const archiver = require('archiver');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOT_ROOT  = path.join(__dirname, '../..');

// Patterns to exclude from the ZIP (security + noise)
const EXCLUDE_GLOBS = [
  'node_modules/**',
  '.git/**',
  'temp/**',
  // Auth / session credential folders — never include these
  'session/**',
  'sessions/**',
  'auth_info_baileys/**',
  '.baileys/**',
  // Secrets
  '.env',
  '.env.*',
  // Replit internals
  '.local/**',
  '.upm/**',
  '.cache/**',
];

export default {
  command: 'botzip',
  alias: ['exportbot', 'backupbot', 'zip'],
  description: 'Export the bot source code as a ZIP file',
  category: 'owner',
  ownerOnly: true,

  async execute({ reply, react, sock, jid, msg }) {
    await react('📦');
    await reply('📦 Zipping bot source code… please wait.');

    const outPath = path.join(BOT_ROOT, 'temp', `aa-md-bot-${Date.now()}.zip`);
    await fs.ensureDir(path.dirname(outPath));

    try {
      await new Promise((resolve, reject) => {
        const output  = fs.createWriteStream(outPath);
        const archive = archiver('zip', { zlib: { level: 6 } });

        output.on('close', resolve);
        archive.on('error', reject);
        archive.pipe(output);

        archive.glob('**/*', {
          cwd:    BOT_ROOT,
          ignore: EXCLUDE_GLOBS,
          dot:    false,
        });

        archive.finalize();
      });

      const stat   = await fs.stat(outPath);
      const sizeMB = (stat.size / 1024 / 1024).toFixed(2);

      await sock.sendMessage(jid, {
        document: fs.createReadStream(outPath),
        mimetype: 'application/zip',
        fileName: `AA-MD-Bot-Backup-${new Date().toISOString().slice(0, 10)}.zip`,
        caption:
          `📦 *Bot Export Complete*\n\n` +
          `📁 *Size:* ${sizeMB} MB\n` +
          `📅 *Date:* ${new Date().toLocaleDateString()}\n\n` +
          `⚠️ _Auth/session files are excluded for security._\n\n` +
          `> 📦 *AA MD Bot*`,
      }, { quoted: msg });

      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ ZIP failed: ${e.message}\n\n> 📦 *AA MD Bot*`);
    } finally {
      fs.remove(outPath).catch(() => {});
    }
  },
};
