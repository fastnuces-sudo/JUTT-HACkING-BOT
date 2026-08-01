// ============================================
// Jutts Bot - Word Scramble Game
// Developer: Sajid Jutt | Jutts Mods
// ============================================

const WORDS = [
  'elephant','keyboard','mountain','freedom','science','hospital','library',
  'diamond','journey','horizon','pyramid','thunder','whisper','gallery','captain',
  'dolphin','mystery','explore','balance','harmony','penguin','lantern','machine',
  'crystal','blanket','kitchen','morning','trouble','fashion','network','plastic',
  'village','program','student','weather','stomach','justice','captain','chicken',
  'balloon','cabinet','comfort','dolphin','failure','general','harvest','imagine',
  'journal','kingdom','leopard','mission','neutral','officer','painter','quality',
  'respect','shelter','texture','uniform','victory','warrior','example','factory',
];

const sessions = new Map();

function scramble(word) {
  const arr = word.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const s = arr.join('');
  return s === word ? scramble(word) : s;
}

export default {
  command: 'wordscramble',
  alias: ['unscramble', 'ws', 'wordgame'],
  description: 'Unscramble the scrambled word! .ws to start, type the answer to guess',
  category: 'fun',

  async execute({ jid, senderJid, args, reply, react }) {
    const chatKey = jid || senderJid;
    const input   = (args[0] || '').toLowerCase().trim();

    // Check for existing game answer
    const existing = sessions.get(chatKey);
    if (existing && input && input !== 'new' && input !== 'hint' && input !== 'skip') {
      if (input === existing.word) {
        sessions.delete(chatKey);
        await react('🏆');
        return reply(`🏆 *Correct! Well done!*\n\n✅ The word was: *${existing.word}*\n\n🎮 Play again? *.ws*\n\n> 🤖 *Jutts Bot*`);
      }
      return reply(`❌ *Wrong!* Try again.\n\n🔀 Scrambled: *${existing.scrambled}*\n\n> 🤖 *Jutts Bot*`);
    }

    // Hint
    if (existing && input === 'hint') {
      const hint = existing.word.slice(0,2) + '*'.repeat(existing.word.length - 2);
      return reply(`💡 *Hint:* ${hint} (${existing.word.length} letters)\n\n🔀 Scrambled: *${existing.scrambled}*\n\n> 🤖 *Jutts Bot*`);
    }

    // Skip / reveal
    if (existing && input === 'skip') {
      sessions.delete(chatKey);
      return reply(`⏭️ *Skipped!*\n\n✅ The word was: *${existing.word}*\n\n> 🤖 *Jutts Bot*`);
    }

    // New game
    const word     = WORDS[Math.floor(Math.random() * WORDS.length)];
    const scrambled = scramble(word);
    sessions.set(chatKey, { word, scrambled, started: Date.now() });
    await react('🎮');
    return reply(
      `🎮 *Word Scramble!*\n\n` +
      `🔀 Unscramble this word:\n` +
      `*${scrambled.toUpperCase()}*\n\n` +
      `📝 ${word.length} letters\n\n` +
      `💡 *.ws hint* for a clue\n` +
      `⏭️ *.ws skip* to reveal\n\n` +
      `> 🤖 *Jutts Bot*`
    );
  },
};
