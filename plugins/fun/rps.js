export default {
  command: 'rps',
  alias: ['rockpaperscissors'],
  description: 'Play rock, paper, scissors',
  category: 'fun',
  async execute({ reply, args }) {
    const choices = ['rock', 'paper', 'scissors'];
    const emojis = { rock: '🪨', paper: '📄', scissors: '✂️' };
    const userChoice = args[0]?.toLowerCase();
    if (!choices.includes(userChoice)) {
      return reply('❌ Usage: .rps rock/paper/scissors');
    }
    const botChoice = choices[Math.floor(Math.random() * 3)];
    let result;
    if (userChoice === botChoice) result = '🤝 It\'s a *draw*!';
    else if (
      (userChoice === 'rock' && botChoice === 'scissors') ||
      (userChoice === 'paper' && botChoice === 'rock') ||
      (userChoice === 'scissors' && botChoice === 'paper')
    ) result = '🎉 You *win*!';
    else result = '😅 You *lose*!';
    reply(`✂️ *Rock Paper Scissors*\n\n${emojis[userChoice]} You: *${userChoice}*\n🤖 Bot: ${emojis[botChoice]} *${botChoice}*\n\n${result}`);
  },
};
