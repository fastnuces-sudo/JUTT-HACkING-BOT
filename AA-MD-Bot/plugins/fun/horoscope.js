// ============================================
// AA MD Bot - Horoscope / Zodiac
// Developer: Ahsan Ali | AA Mods
// ============================================

import axios from 'axios';

const SIGNS = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces'];
const EMOJIS = { aries:'♈',taurus:'♉',gemini:'♊',cancer:'♋',leo:'♌',virgo:'♍',libra:'♎',scorpio:'♏',sagittarius:'♐',capricorn:'♑',aquarius:'♒',pisces:'♓' };

const DATES = {
  aries:'Mar 21 – Apr 19',taurus:'Apr 20 – May 20',gemini:'May 21 – Jun 20',
  cancer:'Jun 21 – Jul 22',leo:'Jul 23 – Aug 22',virgo:'Aug 23 – Sep 22',
  libra:'Sep 23 – Oct 22',scorpio:'Oct 23 – Nov 21',sagittarius:'Nov 22 – Dec 21',
  capricorn:'Dec 22 – Jan 19',aquarius:'Jan 20 – Feb 18',pisces:'Feb 19 – Mar 20',
};

export default {
  command: 'horoscope',
  alias: ['zodiac', 'horo', 'rashifal'],
  description: 'Get today\'s horoscope for your zodiac sign',
  category: 'fun',

  async execute({ args, reply, react }) {
    const sign = (args[0] || '').toLowerCase().trim();

    if (!sign || !SIGNS.includes(sign)) {
      const list = SIGNS.map(s => `${EMOJIS[s]} ${s}`).join(' · ');
      return reply(
        `🔮 *Horoscope*\n\n` +
        `📋 *Usage:* *.horoscope <sign>*\n\n` +
        `♈ *Signs:*\n${list}\n\n` +
        `📅 *Date Ranges:*\n` +
        SIGNS.map(s => `${EMOJIS[s]} *${s[0].toUpperCase()+s.slice(1)}:* ${DATES[s]}`).join('\n') +
        `\n\n> 🤖 *AA MD Bot*`
      );
    }

    await react('🔮');

    try {
      const { data } = await axios.get(
        `https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily?sign=${sign}&day=today`,
        { timeout: 7000 }
      );
      const horoscope = data?.data?.horoscope_data || 'No reading available today.';
      return reply(
        `${EMOJIS[sign]} *${sign[0].toUpperCase()+sign.slice(1)} Horoscope*\n` +
        `📅 *${DATES[sign]}*\n\n` +
        `🔮 ${horoscope}\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    } catch {
      return reply(
        `${EMOJIS[sign] || '🔮'} *${sign[0].toUpperCase()+sign.slice(1)} Horoscope*\n\n` +
        `⚠️ Could not fetch reading right now. Try again shortly.\n\n> 🤖 *AA MD Bot*`
      );
    }
  },
};
