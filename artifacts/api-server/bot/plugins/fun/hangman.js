const words = ['elephant', 'javascript', 'whatsapp', 'developer', 'pakistan', 'programming', 'artificial', 'intelligence', 'technology', 'computer', 'keyboard', 'database', 'network', 'internet'];
const games = new Map();

export default {
  command: 'hangman',
  alias: ['hm'],
  description: 'Play hangman word guessing game',
  category: 'fun',
  async execute({ reply, senderJid, args, jid }) {
    const gameKey = `${jid}:${senderJid}`;
    if (args[0] === 'stop') {
      games.delete(gameKey);
      return reply('🛑 Hangman game stopped.');
    }
    if (!games.has(gameKey)) {
      const word = words[Math.floor(Math.random() * words.length)];
      games.set(gameKey, { word, guessed: [], wrong: 0, maxWrong: 6 });
      const game = games.get(gameKey);
      const display = word.split('').map(c => game.guessed.includes(c) ? c : '_').join(' ');
      return reply(`🎮 *Hangman Started!*\n\nWord: *${display}*\nLetters: ${word.length}\n\nGuess a letter with: .hangman [letter]\nStop: .hangman stop`);
    }
    const game = games.get(gameKey);
    const letter = args[0]?.toLowerCase();
    if (!letter || letter.length !== 1 || !/[a-z]/.test(letter)) {
      const display = game.word.split('').map(c => game.guessed.includes(c) ? c : '_').join(' ');
      return reply(`🎮 *Hangman*\n\n${display}\n❤️ Lives: ${game.maxWrong - game.wrong}/${game.maxWrong}\n❌ Wrong: ${game.guessed.filter(g => !game.word.includes(g)).join(', ') || 'none'}\n\nGuess: .hangman [letter]`);
    }
    if (game.guessed.includes(letter)) return reply(`⚠️ You already guessed *${letter}*!`);
    game.guessed.push(letter);
    if (!game.word.includes(letter)) game.wrong++;
    const display = game.word.split('').map(c => game.guessed.includes(c) ? c : '_').join(' ');
    const won = game.word.split('').every(c => game.guessed.includes(c));
    const lost = game.wrong >= game.maxWrong;
    if (won) { games.delete(gameKey); return reply(`🎉 *You WON!*\n\nWord: *${game.word}*`); }
    if (lost) { games.delete(gameKey); return reply(`💀 *Game Over!*\n\nWord was: *${game.word}*`); }
    reply(`🎮 *Hangman*\n\n${display}\n❤️ Lives: ${game.maxWrong - game.wrong}/${game.maxWrong}\n${game.word.includes(letter) ? `✅ "${letter}" is correct!` : `❌ "${letter}" is wrong!`}\n\nGuess: .hangman [letter]`);
  },
};
