// ============================================
// AA MD Bot - Random Facts
// Developer: Ahsan Ali | AA Mods
// ============================================

import axios from 'axios';

const FALLBACK_FACTS = [
  'Honey never spoils — archaeologists have found 3,000-year-old honey in Egyptian tombs.',
  'A group of flamingos is called a "flamboyance".',
  'Octopuses have three hearts and blue blood.',
  'The shortest war in history lasted 38 minutes (Anglo-Zanzibar War, 1896).',
  'A day on Venus is longer than a year on Venus.',
  'Bananas are berries, but strawberries are not.',
  'The human body contains enough iron to make a 3-inch nail.',
  'Sharks are older than trees — they have existed for over 400 million years.',
  'A bolt of lightning is five times hotter than the surface of the sun.',
  'Cleopatra lived closer in time to the Moon landing than to the construction of the Great Pyramid.',
  'The unicorn is the national animal of Scotland.',
  'Wombat poop is cube-shaped.',
  'It rains diamonds on Neptune and Uranus.',
  'The average person walks the equivalent of three times around the Earth in a lifetime.',
  'A snail can sleep for three years.',
];

export default {
  command: 'fact',
  alias: ['facts', 'funfact', 'randomfact'],
  description: 'Get a random interesting fact',
  category: 'fun',

  async execute({ reply, react }) {
    await react('🧠');
    try {
      const { data } = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', { timeout: 5000 });
      const fact = data?.text || FALLBACK_FACTS[Math.floor(Math.random() * FALLBACK_FACTS.length)];
      return reply(
        `🧠 *Random Fact*\n\n` +
        `📖 ${fact}\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    } catch {
      const fact = FALLBACK_FACTS[Math.floor(Math.random() * FALLBACK_FACTS.length)];
      return reply(`🧠 *Random Fact*\n\n📖 ${fact}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
