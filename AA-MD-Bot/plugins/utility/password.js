import crypto from 'crypto';

export default {
  command: 'password',
  alias: ['pass', 'genpass'],
  description: 'Generate a secure random password',
  category: 'utility',
  async execute({ reply, args }) {
    const length = Math.min(Math.max(parseInt(args[0]) || 16, 4), 64);
    const includeSymbols = !args.includes('--no-symbols');
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' + (includeSymbols ? '!@#$%^&*()_+-=[]{}|;:,.<>?' : '');
    let password = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      password += chars[bytes[i] % chars.length];
    }
    reply(`🔐 *Password Generator*\n\n🔑 Password: \`${password}\`\n📏 Length: *${length}*\n🛡️ Strength: *${length >= 16 ? 'Strong' : length >= 10 ? 'Medium' : 'Weak'}*\n\n⚠️ Keep this password safe!`);
  },
};
