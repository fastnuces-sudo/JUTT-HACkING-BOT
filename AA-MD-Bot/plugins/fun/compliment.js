const compliments = [
  'You\'re smarter than Google!',
  'Your smile could stop traffic. 😊',
  'You have the best ideas!',
  'You make the world better just by being in it.',
  'You\'re more fun than a bubble wrap popping session!',
  'You\'re like sunshine on a rainy day.',
  'Your potential is limitless!',
  'You\'re the kind of friend everyone wishes they had.',
  'You make complicated things look easy.',
  'Your creativity is inspiring!',
  'You have an incredible talent for making people feel special.',
  'You\'re braver than you believe, smarter than you think.',
];

export default {
  command: 'compliment',
  alias: ['comp', 'flatter'],
  description: 'Send a compliment',
  category: 'fun',
  async execute({ reply, msg }) {
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const c = compliments[Math.floor(Math.random() * compliments.length)];
    if (mentions.length > 0) {
      reply(`💐 @${mentions[0].split('@')[0]} — ${c}`, { mentions });
    } else {
      reply(`💐 *Compliment*\n\n${c}`);
    }
  },
};
