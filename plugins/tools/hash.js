// ============================================
// AA MD Bot - Hash Generator
// Built-in Node crypto — no API needed
// Commands: .hash .md5 .sha1 .sha256 .sha512
// ============================================
import crypto from 'crypto';

export default {
  command: 'hash',
  alias: ['md5', 'sha1', 'sha256', 'sha512'],
  description: 'Generate MD5, SHA1, SHA256, SHA512 hashes of any text',
  category: 'tools',

  async execute({ command, text, args, reply, prefix }) {
    if (!text) return reply(
      `🔐 *Hash Generator*\n\n` +
      `*Usage:* ${prefix}hash <text>\n\n` +
      `*Specific algorithms:*\n` +
      `• ${prefix}md5 <text>\n` +
      `• ${prefix}sha1 <text>\n` +
      `• ${prefix}sha256 <text>\n` +
      `• ${prefix}sha512 <text>\n\n` +
      `*Example:* ${prefix}hash Hello World\n\n` +
      `> 🔐 *AA MD Bot*`
    );

    const algoMap = { md5: ['md5'], sha1: ['sha1'], sha256: ['sha256'], sha512: ['sha512'] };
    const algos = algoMap[command] || ['md5', 'sha1', 'sha256', 'sha512'];

    const results = algos.map(alg => {
      const h = crypto.createHash(alg).update(text).digest('hex');
      return `*${alg.toUpperCase()}:*\n\`\`\`${h}\`\`\``;
    });

    reply(
      `🔐 *Hash Generator*\n\n` +
      `📝 *Input:* \`${text.slice(0, 60)}${text.length > 60 ? '…' : ''}\`\n\n` +
      results.join('\n\n') +
      `\n\n> 🔐 *AA MD Bot*`
    );
  },
};
