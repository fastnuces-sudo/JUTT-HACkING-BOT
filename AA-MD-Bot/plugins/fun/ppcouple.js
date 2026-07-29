// ============================================
// AA MD Bot - Anime Couple PP
// Developer: Ahsan Ali | AA Mods
//
// Commands:
//   .ppcouple — random anime couple (boy + girl)
//   .ppboy    — random anime boy PP
//   .ppgirl   — random anime girl PP
// ============================================

import axios from 'axios';

const JSON_URL = 'https://raw.githubusercontent.com/KazukoGans/database/main/anime/ppcouple.json';
const FOOTER   = '\n\n> 🤖 *AA MD Bot*  •  👨‍💻 *Ahsan Ali Wadani*';

// ── Fetch couple data (cached for 10 min to avoid repeated GitHub fetches) ────
let _cache    = null;
let _cacheAt  = 0;
const CACHE_TTL = 10 * 60 * 1000;

async function getCoupleData() {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL) return _cache;
  const { data } = await axios.get(JSON_URL, { timeout: 12000 });
  if (!Array.isArray(data) || !data.length) throw new Error('empty data');
  _cache   = data;
  _cacheAt = Date.now();
  return data;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Download image buffer from URL ────────────────────────────────────────────
async function getBuffer(url) {
  const { data } = await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
  return Buffer.from(data);
}

export default {
  command:     'ppcouple',
  alias:       ['ppcp', 'couplepp', 'ppboy', 'ppgirl', 'animepic'],
  description: 'Random anime couple / boy / girl profile picture',
  category:    'fun',
  usage:       '.ppcouple | .ppboy | .ppgirl',

  async execute({ sock, msg, jid, command, react, reply }) {
    const cmd = (command || 'ppcouple').toLowerCase();

    await react('🌸');

    let coupleData;
    try {
      coupleData = await getCoupleData();
    } catch {
      await react('❌');
      return reply(`❌ Anime database load nahi hua. Thodi der baad try karo.${FOOTER}`);
    }

    const pair = pickRandom(coupleData);

    try {
      // ── .ppboy — only boy image ──────────────────────────────────────────
      if (cmd === 'ppboy') {
        const buf = await getBuffer(pair.cowo);
        await sock.sendMessage(jid, {
          image: buf,
          caption: `👦 *Anime Boy PP*\n_Random anime profile picture_${FOOTER}`,
        }, { quoted: msg });
        return await react('✅');
      }

      // ── .ppgirl — only girl image ────────────────────────────────────────
      if (cmd === 'ppgirl') {
        const buf = await getBuffer(pair.cewe);
        await sock.sendMessage(jid, {
          image: buf,
          caption: `👧 *Anime Girl PP*\n_Random anime profile picture_${FOOTER}`,
        }, { quoted: msg });
        return await react('✅');
      }

      // ── .ppcouple / .ppcp / .couplepp — send boy + girl ──────────────────
      const [boyBuf, girlBuf] = await Promise.all([
        getBuffer(pair.cowo),
        getBuffer(pair.cewe),
      ]);

      await sock.sendMessage(jid, {
        image: boyBuf,
        caption: `💑 *Anime Couple PP*\n\n👦 *Boy*${FOOTER}`,
      }, { quoted: msg });

      await sock.sendMessage(jid, {
        image: girlBuf,
        caption: `👧 *Girl*${FOOTER}`,
      }, { quoted: msg });

      await react('✅');

    } catch (err) {
      await react('❌');
      reply(`❌ Image load nahi hua. Dobara try karo!\n\n_Error: ${err.message}_${FOOTER}`);
    }
  },
};
