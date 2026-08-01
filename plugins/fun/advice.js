// AA MD Bot - Advice / Motivational Quotes
import axios from 'axios';

const LOCAL_ADVICE = [
  'Take breaks. Your brain needs rest to function well.',
  'Drink enough water today. Small habits lead to big changes.',
  'Before you speak, ask yourself: is it true, is it kind, is it necessary?',
  'Comparison is the thief of joy. Run your own race.',
  'You don\'t have to be great to start, but you have to start to be great.',
  'Treat yourself the way you would treat a good friend.',
  'Progress, not perfection, is the goal.',
  'The best investment you can make is in yourself.',
  'Do one thing every day that scares you — that\'s where growth lives.',
  'Forgiveness is not about the other person. It\'s about freeing yourself.',
  'Invest in experiences, not things — memories last longer.',
  'Say no to good things so you can say yes to great ones.',
  'Your energy is your most valuable resource. Protect it.',
  'Respond, don\'t react. There\'s a difference.',
  'Stop waiting for the perfect moment. Take the moment and make it perfect.',
];

export default {
  command: 'advice',
  alias: ['tip', 'motivate', 'inspire'],
  description: 'Get a random piece of advice or motivational quote',
  category: 'fun',

  async execute({ reply, react }) {
    await react('💡');
    let text;

    // 1. zenquotes.io (confirmed working)
    try {
      const res = await axios.get('https://zenquotes.io/api/random', {
        headers: { 'User-Agent': 'AA-MD-Bot/3.0' },
        timeout: 7000,
      });
      const q = Array.isArray(res.data) ? res.data[0] : res.data;
      if (q?.q && q?.a) {
        text = `💡 *Advice*\n\n_"${q.q}"_\n\n— ${q.a}\n\n> 🤖 *AA MD Bot*`;
      } else throw new Error('empty');
    } catch {
      // 2. adviceslip.com
      try {
        const res = await axios.get('https://api.adviceslip.com/advice', {
          headers: { Accept: 'application/json' },
          timeout: 5000,
        });
        const slip = res.data?.slip;
        if (slip?.advice) {
          text = `💡 *Advice #${slip.id}*\n\n_"${slip.advice}"_\n\n> 🤖 *AA MD Bot*`;
        } else throw new Error('empty');
      } catch {
        // 3. Local fallback — always works
        text = `💡 *Advice*\n\n_"${LOCAL_ADVICE[Math.floor(Math.random() * LOCAL_ADVICE.length)]}"_\n\n> 🤖 *AA MD Bot*`;
      }
    }

    await reply(text);
  },
};
