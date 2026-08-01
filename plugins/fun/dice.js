export default {
  command: 'dice',
  alias: ['roll', 'rolldice'],
  description: 'Roll dice',
  category: 'fun',
  async execute({ reply, args }) {
    const sides = Math.min(Math.max(parseInt(args[0]) || 6, 2), 100);
    const count = Math.min(Math.max(parseInt(args[1]) || 1, 1), 10);
    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
    const total = rolls.reduce((a, b) => a + b, 0);
    const diceEmojis = ['⚀','⚁','⚂','⚃','⚄','⚅'];
    const display = count === 1 && sides === 6 ? diceEmojis[rolls[0] - 1] : rolls.join(', ');
    reply(`🎲 *Dice Roll* (${count}d${sides})\n\n${display}\n\n${count > 1 ? `📊 Total: *${total}*\n📈 Average: *${(total/count).toFixed(1)}*` : `Result: *${rolls[0]}*`}`);
  },
};
