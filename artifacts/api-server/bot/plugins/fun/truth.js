const truths = [
  'What is the most embarrassing thing you\'ve ever done?',
  'Have you ever lied to your best friend? About what?',
  'What is your biggest fear?',
  'Have you ever cheated on a test?',
  'What is the most childish thing you still do?',
  'Who was your first crush?',
  'What is the worst thing you\'ve ever said to someone?',
  'Have you ever stolen something?',
  'What is your most annoying habit?',
  'What is the weirdest dream you\'ve ever had?',
  'Have you ever blamed someone else for something you did?',
  'What is your biggest regret?',
  'Have you ever snooped through someone\'s phone?',
  'What is the most embarrassing thing in your search history?',
  'Have you ever ghosted someone?',
];

export default {
  command: 'truth',
  alias: ['t'],
  description: 'Get a random truth question',
  category: 'fun',
  async execute({ reply }) {
    const q = truths[Math.floor(Math.random() * truths.length)];
    reply(`🤔 *Truth or Dare — TRUTH*\n\n❓ ${q}`);
  },
};
