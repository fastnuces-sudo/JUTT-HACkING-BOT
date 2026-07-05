// ============================================
// AA MD Bot - Coin Flip
// Simple heads or tails game
// ============================================

export default {
  command: 'coinflip',
  alias: ['coin', 'toss', 'headstails'],
  description: 'Flip a coin — heads or tails',
  category: 'fun',

  async execute({ text, reply, react }) {
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    const emoji  = result === 'Heads' ? '🌟' : '🔵';

    if (text?.trim()) {
      // Guess mode
      const guess = text.trim().toLowerCase();
      const isHeads = guess.startsWith('h');
      const isTails = guess.startsWith('t');

      if (!isHeads && !isTails) {
        return reply(`❓ Usage:\n*.flip heads* or *.flip tails*\nOr just *.flip* to flip without guessing`);
      }

      const guessedResult = isHeads ? 'Heads' : 'Tails';
      const won = guessedResult === result;

      await react(won ? '🎉' : '😢');
      return reply(
        `🪙 *Coin Flip*\n\n` +
        `${emoji} *Result: ${result}!*\n\n` +
        `Your guess: *${guessedResult}*\n` +
        `${won ? '🎉 *You won!*' : '😢 *Better luck next time!*'}\n\n` +
        `> 🪙 *AA MD Bot*`
      );
    }

    await react(emoji);
    reply(
      `🪙 *Coin Flip*\n\n` +
      `${emoji} *${result}!*\n\n` +
      `💡 Tip: *.flip heads* to guess!\n\n` +
      `> 🪙 *AA MD Bot*`
    );
  },
};
