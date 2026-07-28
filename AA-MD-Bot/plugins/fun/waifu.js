// AA MD Bot - Anime Images
// Primary: nekos.life (confirmed working from Replit)
// Fallback: waifu.pics (when available)
import axios from 'axios';

// nekos.life endpoint map (confirmed working types)
const NEKOS_LIFE_MAP = {
  waifu:    'waifu',
  neko:     'neko',
  maid:     'neko',
  uniform:  'neko',
  selfies:  'neko',
  raiden:   'waifu',
  rias:     'waifu',
  kamisato: 'waifu',
  wink:     'waifu',
  blush:    'blush',
  smile:    'smile',
  wave:     'wave',
  happy:    'happy',
  husbando: 'husbando',
  shinobu:  'neko',    // shinobu/megumin 500 on nekos.life → fallback to neko
  megumin:  'neko',
  oppai:    'neko',
  slap:     'slap',
  hug:      'hug',
  kiss:     'kiss',
  cuddle:   'cuddle',
  pat:      'pat',
  feed:     'feed',
  poke:     'poke',
  highfive: 'highfive',
  dance:    'dance',
  bully:    'bully',
};

// waifu.pics SFW types — used as fallback
const WAIFUPICS_TYPES = new Set([
  'waifu', 'neko', 'shinobu', 'megumin', 'bully', 'cuddle', 'cry',
  'hug', 'awoo', 'kiss', 'lick', 'pat', 'smug', 'bonk', 'yeet',
  'blush', 'smile', 'wave', 'highfive', 'handhold', 'nom', 'bite',
  'glomp', 'slap', 'kill', 'kick', 'happy', 'wink', 'poke', 'dance', 'cringe',
]);

const COMMANDS = [
  'waifu', 'neko', 'maid', 'husbando', 'shinobu', 'megumin',
  'uniform', 'selfies', 'raiden', 'rias', 'kamisato',
  'wink', 'blush', 'smile', 'wave', 'happy', 'hug', 'kiss',
  'slap', 'pat', 'cuddle', 'dance', 'poke',
];

async function fetchNekosLife(type) {
  const endpoint = NEKOS_LIFE_MAP[type] || 'neko';
  const { data } = await axios.get(
    `https://nekos.life/api/v2/img/${endpoint}`,
    { timeout: 12000 }
  );
  const url = data?.url;
  if (!url || !url.startsWith('http')) throw new Error('no url');
  return url;
}

async function fetchWaifuPics(type) {
  const safeType = WAIFUPICS_TYPES.has(type) ? type : 'waifu';
  const { data } = await axios.get(
    `https://api.waifu.pics/sfw/${safeType}`,
    { timeout: 10000 }
  );
  if (!data?.url) throw new Error('no url');
  return data.url;
}

// Extra: picsum for generic fallback if all anime APIs fail
async function fetchPicsum() {
  const id = Math.floor(Math.random() * 1000);
  return `https://picsum.photos/seed/${id}/400/600`;
}

export default {
  command: 'waifu',
  alias: COMMANDS.filter(c => c !== 'waifu'),
  description: 'Anime images — waifu, neko, maid, husbando, hug, kiss & more',
  category: 'fun',

  async execute({ sock, msg, jid, command, react, reply }) {
    await react('🌸');
    const cmd = (command || 'waifu').toLowerCase();
    const caption = `🌸 *${cmd.charAt(0).toUpperCase() + cmd.slice(1)}*\n\n> 🤖 *AA MD Bot*`;

    let imgUrl;

    // 1. nekos.life (confirmed working)
    try {
      imgUrl = await fetchNekosLife(cmd);
    } catch {}

    // 2. waifu.pics fallback
    if (!imgUrl) {
      try {
        imgUrl = await fetchWaifuPics(cmd);
      } catch {}
    }

    // 3. picsum fallback (always works)
    if (!imgUrl) {
      imgUrl = await fetchPicsum();
    }

    try {
      await sock.sendMessage(jid, { image: { url: imgUrl }, caption }, { quoted: msg });
      await react('✅');
    } catch {
      await react('❌');
      reply('❌ Failed to send anime image. Try again later.\n\n> 🤖 *AA MD Bot*');
    }
  },
};
