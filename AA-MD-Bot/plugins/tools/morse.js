// ============================================
// AA MD Bot - Morse Code
// Developer: Ahsan Ali | AA Mods
// ============================================

const ENCODE = {
  a:'.-',b:'-...',c:'-.-.',d:'-..',e:'.',f:'..-.',g:'--.',h:'....',i:'..',
  j:'.---',k:'-.-',l:'.-..',m:'--',n:'-.',o:'---',p:'.--.',q:'--.-',r:'.-.',
  s:'...',t:'-',u:'..-',v:'...-',w:'.--',x:'-..-',y:'-.--',z:'--..',
  '0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....',
  '6':'-....','7':'--...','8':'---..','9':'----.','.':'.-.-.-',',':'--..--',
  '?':'..--..','/':'-..-.','-':'-....-','(':'-.--.',')':'-.--.-',' ':'/',
};

const DECODE = Object.fromEntries(Object.entries(ENCODE).map(([k, v]) => [v, k]));

function toMorse(text) {
  return text.toLowerCase().split('').map(c => ENCODE[c] ?? '').filter(Boolean).join(' ');
}

function fromMorse(code) {
  return code.split(' / ').map(word =>
    word.split(' ').map(c => DECODE[c] ?? '?').join('')
  ).join(' ');
}

export default {
  command: 'morse',
  alias: ['morseencode', 'morsecode'],
  description: 'Encode/decode Morse code. .morse encode <text> or .morse decode <code>',
  category: 'tools',

  async execute({ args, text, reply, react }) {
    const sub  = (args[0] || '').toLowerCase();
    const input = args.slice(1).join(' ').trim() || '';

    if (!input) {
      return reply(
        `📡 *Morse Code*\n\n` +
        `📋 *Usage:*\n` +
        `• *.morse encode Hello* — text → morse\n` +
        `• *.morse decode .... . .-.. .-.. ---* — morse → text\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    await react('📡');

    if (sub === 'encode' || sub === 'e') {
      const result = toMorse(input);
      return reply(`📡 *Morse Encoded*\n\n*Input:* ${input}\n*Output:* \`${result}\`\n\n> 🤖 *AA MD Bot*`);
    }

    if (sub === 'decode' || sub === 'd') {
      const result = fromMorse(input);
      return reply(`📡 *Morse Decoded*\n\n*Input:* \`${input}\`\n*Output:* ${result}\n\n> 🤖 *AA MD Bot*`);
    }

    // Default: auto-detect (if input has .- characters, decode; else encode)
    const isMorse = /^[.\- /]+$/.test(input.trim());
    if (isMorse) {
      const result = fromMorse(sub + (input ? ' ' + input : ''));
      return reply(`📡 *Morse Decoded*\n\n*Output:* ${result}\n\n> 🤖 *AA MD Bot*`);
    }
    const result = toMorse(sub + (input ? ' ' + input : ''));
    return reply(`📡 *Morse Encoded*\n\n*Input:* ${sub + ' ' + input}\n*Output:* \`${result}\`\n\n> 🤖 *AA MD Bot*`);
  },
};
