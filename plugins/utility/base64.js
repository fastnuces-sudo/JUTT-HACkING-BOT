export default {
  command: 'base64',
  alias: ['b64'],
  description: 'Encode or decode base64',
  category: 'utility',
  async execute({ reply, args, text }) {
    if (!text) return reply('❌ Usage: .base64 encode/decode [text]');
    const action = args[0]?.toLowerCase();
    const input = args.slice(1).join(' ');
    if (!action || !input) return reply('❌ Usage: .base64 encode [text] or .base64 decode [text]');
    if (action === 'encode') {
      const encoded = Buffer.from(input).toString('base64');
      reply(`🔐 *Base64 Encode*\n\n📝 Input: ${input}\n✅ Encoded: \`${encoded}\``);
    } else if (action === 'decode') {
      try {
        const decoded = Buffer.from(input, 'base64').toString('utf8');
        reply(`🔓 *Base64 Decode*\n\n📝 Input: ${input}\n✅ Decoded: \`${decoded}\``);
      } catch {
        reply('❌ Invalid base64 string');
      }
    } else {
      reply('❌ Use: .base64 encode [text] or .base64 decode [text]');
    }
  },
};
