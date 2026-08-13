import crypto from 'crypto';

// ============================================
// AA MD Bot - Password Generator
// Commands: .password .genpass .passwd
// Generates cryptographically strong passwords
// ============================================

export default {
  command: 'password',
  alias: ['genpass', 'passwd', 'passgen'],
  description: 'Generate a strong random password',
  category: 'tools',

  async execute({ args, reply, prefix }) {
    const len     = Math.min(Math.max(parseInt(args[0]) || 16, 6), 64);
    const noSym   = (args[1] || '').toLowerCase() === 'nosym';
    const upper   = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower   = 'abcdefghijklmnopqrstuvwxyz';
    const digits  = '0123456789';
    const syms    = '!@#$%^&*()-_=+[]{}|;:,.<>?';
    const charset = upper + lower + digits + (noSym ? '' : syms);

    // Guarantee each requested character class and use a cryptographically secure
    // Fisher-Yates shuffle (Math.random is not suitable for passwords).
    const pick = chars => chars[crypto.randomInt(chars.length)];
    const pwd = [pick(upper), pick(lower), pick(digits), ...(noSym ? [] : [pick(syms)])];
    while (pwd.length < len) pwd.push(pick(charset));
    for (let i = pwd.length - 1; i > 0; i--) {
      const j = crypto.randomInt(i + 1);
      [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
    }
    const generated = pwd.join('');

    const strength = len >= 24 ? '🟢 *Very Strong*' : len >= 16 ? '🟡 *Strong*' : len >= 10 ? '🟠 *Moderate*' : '🔴 *Weak*';
    const entropy  = Math.floor(len * Math.log2(charset.length));

    reply(
      `🔐 *Password Generator*\n\n` +
      `\`\`\`${generated}\`\`\`\n\n` +
      `📏 Length: *${len}*\n` +
      `💪 Strength: ${strength}\n` +
      `🔢 Entropy: ~${entropy} bits\n\n` +
      `💡 *Tips:*\n` +
      `• ${prefix}password 20 — 20-char password\n` +
      `• ${prefix}password 12 nosym — no symbols\n\n` +
      `> 🔐 *AA MD Bot*`
    );
  },
};
