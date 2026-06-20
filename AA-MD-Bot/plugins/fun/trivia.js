import axios from 'axios';

export default {
  command: 'trivia',
  alias: ['quiz'],
  description: 'Answer a trivia question',
  category: 'fun',
  async execute({ reply }) {
    try {
      const res = await axios.get('https://opentdb.com/api.php?amount=1&type=multiple');
      const q = res.data.results[0];
      const answers = [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5);
      const labels = ['A', 'B', 'C', 'D'];
      const correctLabel = labels[answers.indexOf(q.correct_answer)];
      const answerText = answers.map((a, i) => `${labels[i]}. ${a.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&')}`).join('\n');
      const question = q.question.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
      reply(`🧠 *Trivia Question*\n\n📚 Category: *${q.category}*\n🎯 Difficulty: *${q.difficulty}*\n\n❓ ${question}\n\n${answerText}\n\n||✅ Answer: *${correctLabel}. ${q.correct_answer}*||`);
    } catch {
      reply('❌ Could not fetch trivia. Try again later.');
    }
  },
};
