import crypto from 'crypto';

export default {
  command: 'hash',
  alias: ['md5', 'sha256'],
  description: 'Hash text using MD5/SHA256/SHA512',
  category: 'utility',
  async execute({ reply, args, text }) {
    if (!text) return reply('❌ Usage: .hash [algorithm] [text]\nAlgorithms: md5, sha1, sha256, sha512');
    const algo = args[0]?.toLowerCase();
    const validAlgos = ['md5', 'sha1', 'sha256', 'sha512'];
    if (!validAlgos.includes(algo)) return reply(`❌ Valid algorithms: ${validAlgos.join(', ')}`);
    const input = args.slice(1).join(' ');
    if (!input) return reply('❌ Please provide text to hash');
    const hashed = crypto.createHash(algo).update(input).digest('hex');
    reply(`#️⃣ *Hash Generator*\n\n📝 Input: ${input}\n🔧 Algorithm: *${algo.toUpperCase()}*\n✅ Hash: \`${hashed}\``);
  },
};
