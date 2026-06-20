import axios from 'axios';

export default {
  command: 'joke',
  alias: ['jokes', 'j'],
  description: 'Get a random joke',
  category: 'fun',
  async execute({ reply }) {
    try {
      const res = await axios.get('https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,racist,sexist&type=twopart');
      const { setup, delivery } = res.data;
      reply(`😂 *Joke Time!*\n\n❓ ${setup}\n\n💬 ${delivery}`);
    } catch {
      const jokes = [
        { q: 'Why do programmers prefer dark mode?', a: 'Because light attracts bugs! 🐛' },
        { q: 'Why did the robot go on a diet?', a: 'Too many bytes! 💻' },
        { q: 'What do you call a fake noodle?', a: 'An impasta! 🍝' },
        { q: 'Why can\'t you trust an atom?', a: 'Because they make up everything! ⚛️' },
        { q: 'Why did the scarecrow win an award?', a: 'Because he was outstanding in his field! 🌾' },
      ];
      const j = jokes[Math.floor(Math.random() * jokes.length)];
      reply(`😂 *Joke Time!*\n\n❓ ${j.q}\n\n💬 ${j.a}`);
    }
  },
};
