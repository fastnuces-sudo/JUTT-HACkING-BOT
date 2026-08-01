export default {
  command: 'calc',
  alias: ['math', 'calculate'],
  description: 'Calculate a math expression',
  category: 'utility',
  async execute({ reply, text }) {
    if (!text) return reply('❌ Usage: .calc [expression]\nExample: .calc 5 * 8 + 2');
    try {
      const safe = text.replace(/[^0-9+\-*/().%^ ]/g, '');
      if (!safe.trim()) return reply('❌ Invalid expression');
      const result = Function(`"use strict"; return (${safe})`)();
      if (typeof result !== 'number' || isNaN(result)) return reply('❌ Invalid result');
      reply(`🧮 *Calculator*\n\n📝 Expression: \`${safe}\`\n✅ Result: *${result}*`);
    } catch {
      reply('❌ Invalid math expression');
    }
  },
};
