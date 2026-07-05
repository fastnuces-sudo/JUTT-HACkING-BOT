// ============================================
// AA MD Bot - Tic Tac Toe
// Developer: Ahsan Ali | AA Mods
// ============================================

const games = new Map();

function makeBoard() { return Array(9).fill(' '); }

function display(b) {
  const s = (i) => b[i] === 'X' ? '❌' : b[i] === 'O' ? '⭕' : (i+1).toString();
  return `${s(0)} │ ${s(1)} │ ${s(2)}\n──┼───┼──\n${s(3)} │ ${s(4)} │ ${s(5)}\n──┼───┼──\n${s(6)} │ ${s(7)} │ ${s(8)}`;
}

function checkWin(b, m) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  return lines.some(l => l.every(i => b[i] === m));
}

function aiMove(b) {
  // Try to win, block, else random
  const empty = b.map((v,i) => v===' ' ? i : null).filter(i => i !== null);
  for (const i of empty) { const t=[...b]; t[i]='O'; if (checkWin(t,'O')) return i; }
  for (const i of empty) { const t=[...b]; t[i]='X'; if (checkWin(t,'X')) return i; }
  if (b[4]===' ') return 4;
  const corners = [0,2,6,8].filter(i=>b[i]===' ');
  if (corners.length) return corners[Math.floor(Math.random()*corners.length)];
  return empty[Math.floor(Math.random()*empty.length)];
}

export default {
  command: 'tictactoe',
  alias: ['ttt', 'xo', 'xox'],
  description: 'Play Tic Tac Toe against the bot! .ttt to start, reply with 1-9 to move',
  category: 'fun',

  async execute({ jid, senderJid, args, reply, react }) {
    const input = (args[0] || '').trim();

    // Start new game
    if (!input || input === 'start' || input === 'new') {
      games.set(senderJid, { board: makeBoard(), active: true });
      await react('🎮');
      return reply(
        `🎮 *Tic Tac Toe*\n\n` +
        `You are ❌, bot is ⭕\n` +
        `Reply with a number (1-9) for your move:\n\n` +
        display(makeBoard()) +
        `\n\n💡 *.ttt <1-9>* to play, *.ttt quit* to stop\n\n> 🤖 *AA MD Bot*`
      );
    }

    // Quit
    if (input === 'quit' || input === 'stop') {
      games.delete(senderJid);
      return reply(`👋 *Game ended!*\n\n> 🤖 *AA MD Bot*`);
    }

    const game = games.get(senderJid);
    if (!game?.active) {
      return reply(`🎮 No active game! Start with *.ttt*\n\n> 🤖 *AA MD Bot*`);
    }

    const move = parseInt(input) - 1;
    if (isNaN(move) || move < 0 || move > 8) {
      return reply(`⚠️ Enter a number 1-9\n\n> 🤖 *AA MD Bot*`);
    }
    if (game.board[move] !== ' ') {
      return reply(`⚠️ That cell is taken! Choose another.\n\n> 🤖 *AA MD Bot*`);
    }

    // Player move
    game.board[move] = 'X';
    if (checkWin(game.board,'X')) {
      games.delete(senderJid);
      await react('🏆');
      return reply(`🏆 *You won! Congratulations!* 🎉\n\n${display(game.board)}\n\n> 🤖 *AA MD Bot*`);
    }
    if (game.board.every(c=>c!==' ')) {
      games.delete(senderJid);
      return reply(`🤝 *Draw! Good game!*\n\n${display(game.board)}\n\n> 🤖 *AA MD Bot*`);
    }

    // Bot move
    const ai = aiMove(game.board);
    game.board[ai] = 'O';
    if (checkWin(game.board,'O')) {
      games.delete(senderJid);
      await react('🤖');
      return reply(`🤖 *Bot wins!* Better luck next time!\n\n${display(game.board)}\n\n> 🤖 *AA MD Bot*`);
    }
    if (game.board.every(c=>c!==' ')) {
      games.delete(senderJid);
      return reply(`🤝 *Draw! Good game!*\n\n${display(game.board)}\n\n> 🤖 *AA MD Bot*`);
    }

    await react('🎯');
    return reply(`🎮 *Your turn!* (You: ❌ Bot: ⭕)\n\n${display(game.board)}\n\nReply with 1-9\n\n> 🤖 *AA MD Bot*`);
  },
};
