// ============================================
// AA MD Bot - Number Facts
// Uses numbersapi.com + local bank fallback
// Commands: .numfact .numberfact .mathfact
// ============================================
import axios from 'axios';

const LOCAL_FACTS = {
  0:   '0 is the only number that is neither positive nor negative.',
  1:   '1 is the only positive integer with exactly one divisor.',
  2:   '2 is the only even prime number.',
  3:   '3 is the first odd prime number.',
  7:   '7 is considered the luckiest number in many cultures.',
  12:  '12 is the smallest number with 6 divisors.',
  42:  '42 is the "Answer to the Ultimate Question of Life, the Universe, and Everything" (The Hitchhiker\'s Guide to the Galaxy).',
  69:  '69 is a number that looks the same when rotated 180 degrees.',
  100: '100 is the basis of percentages and the atomic number of Fermium.',
  360: '360 degrees make a full circle, inherited from Babylonian astronomy.',
  666: '666 is known as the "Number of the Beast" from the Book of Revelation.',
  1000:'1000 is a common milestone in counting, known as a millennium in years.',
  9999:'9999 is the largest 4-digit number.',
};

const RANDOM_FACTS = [
  '142857 × 7 = 999999 — it\'s a cyclic number.',
  'The sum of all numbers 1–100 is 5050, discovered by Gauss at age 10.',
  'A googol is 10^100 — more than atoms in the observable universe.',
  '111,111,111 × 111,111,111 = 12,345,678,987,654,321.',
  'Zero was invented in India around 5th century AD.',
  'The Fibonacci sequence appears in sunflower seeds, nautilus shells, and pinecones.',
  'Pi (π) has been calculated to over 100 trillion decimal places.',
  '1 is not a prime number — primes must have exactly two divisors.',
  'The number 1729 is the Hardy-Ramanujan number — the smallest expressible as sum of two cubes in two ways.',
  'There are exactly 4 numbers equal to the sum of cubes of their digits: 1, 153, 370, 371, 407.',
];

export default {
  command: 'numfact',
  alias: ['numberfact', 'mathfact', 'numbertrivia', 'nfact'],
  description: 'Interesting math facts about any number',
  category: 'search',

  async execute({ text, reply, react, prefix }) {
    await react('🔢');

    const num = text?.trim();

    if (!num) {
      const fact = RANDOM_FACTS[Math.floor(Math.random() * RANDOM_FACTS.length)];
      return reply(`🔢 *Random Math Fact*\n\n${fact}\n\n💡 ${prefix}numfact <number> for a specific number\n\n> 🔢 *AA MD Bot*`);
    }

    const n = parseInt(num);
    if (isNaN(n)) return reply(`❌ Please provide a valid number.\n*Usage:* ${prefix}numfact <number>\n\n> 🔢 *AA MD Bot*`);

    // Check local bank first
    if (LOCAL_FACTS[n]) {
      return reply(`🔢 *Number Fact: ${n}*\n\n${LOCAL_FACTS[n]}\n\n> 🔢 *AA MD Bot*`);
    }

    // Try numbersapi.com
    try {
      const { data } = await axios.get(`http://numbersapi.com/${n}/math`, {
        timeout: 8000,
        headers: { 'Accept': 'text/plain' },
      });
      if (data && !data.includes('is an uninteresting number')) {
        reply(`🔢 *Number Fact: ${n}*\n\n${data}\n\n> 🔢 *AA MD Bot*`);
        return;
      }
    } catch {}

    // Try trivia endpoint
    try {
      const { data } = await axios.get(`http://numbersapi.com/${n}/trivia`, {
        timeout: 8000,
        headers: { 'Accept': 'text/plain' },
      });
      if (data) {
        reply(`🔢 *Number Fact: ${n}*\n\n${data}\n\n> 🔢 *AA MD Bot*`);
        return;
      }
    } catch {}

    // Local computation fallback
    const facts = [];
    if (n % 2 === 0) facts.push(`${n} is an even number.`);
    else facts.push(`${n} is an odd number.`);

    let isPrime = n > 1;
    for (let i = 2; i <= Math.sqrt(Math.abs(n)); i++) { if (n % i === 0) { isPrime = false; break; } }
    if (n > 1) facts.push(isPrime ? `${n} is a prime number.` : `${n} is a composite number.`);
    if (n > 0) facts.push(`The square root of ${n} is ≈ ${Math.sqrt(n).toFixed(4)}.`);
    if (Number.isInteger(Math.sqrt(n))) facts.push(`${n} is a perfect square!`);

    reply(`🔢 *Number: ${n}*\n\n${facts.join('\n')}\n\n> 🔢 *AA MD Bot*`);
    await react('✅');
  },
};
