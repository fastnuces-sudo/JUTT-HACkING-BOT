export default {
  command: 'ship',
  alias: ['love', 'lovemeter'],
  description: 'Ship two people together',
  category: 'fun',
  async execute({ reply, args, msg }) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    let p1, p2;
    if (mentions.length >= 2) {
      p1 = `@${mentions[0].split('@')[0]}`;
      p2 = `@${mentions[1].split('@')[0]}`;
    } else if (args.length >= 2) {
      p1 = args[0];
      p2 = args[1];
    } else {
      return reply('❌ Usage: .ship @person1 @person2 or .ship Name1 Name2');
    }
    const score = Math.floor(Math.random() * 101);
    const bar = '█'.repeat(Math.floor(score / 10)) + '░'.repeat(10 - Math.floor(score / 10));
    const emoji = score >= 80 ? '💘' : score >= 60 ? '❤️' : score >= 40 ? '💕' : score >= 20 ? '💔' : '🚫';
    const comment = score >= 80 ? 'Perfect match! 🥰' : score >= 60 ? 'Great chemistry! 😍' : score >= 40 ? 'There\'s potential! 🤔' : score >= 20 ? 'Not looking good... 😬' : 'Run away! 😂';
    reply(`${emoji} *Love Calculator*\n\n${p1} ❤️ ${p2}\n\n[${bar}] ${score}%\n\n💬 ${comment}`, mentions.length >= 2 ? { mentions } : {});
  },
};
