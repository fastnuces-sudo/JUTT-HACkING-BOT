const questions = [
  ['Be able to fly', 'Be invisible'],
  ['Lose all your money', 'Lose all your memories'],
  ['Never use social media again', 'Never watch TV again'],
  ['Be 10 years older', 'Be 10 years younger'],
  ['Live without music', 'Live without movies'],
  ['Have super strength', 'Have super speed'],
  ['Be famous', 'Be rich but unknown'],
  ['Only eat sweet food', 'Only eat salty food'],
  ['Speak every language', 'Play every instrument'],
  ['Time travel to the past', 'Travel to the future'],
];

export default {
  command: 'wyr',
  alias: ['wouldyourather'],
  description: 'Would you rather game',
  category: 'fun',
  async execute({ reply }) {
    const [a, b] = questions[Math.floor(Math.random() * questions.length)];
    reply(`🤔 *Would You Rather?*\n\n🅰️ ${a}\n\n OR\n\n🅱️ ${b}\n\nReply A or B!`);
  },
};
