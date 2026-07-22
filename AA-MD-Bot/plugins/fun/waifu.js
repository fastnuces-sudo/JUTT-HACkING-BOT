// AA MD Bot - Anime Images (waifu.im + waifu.pics fallback)
import axios from 'axios';

// waifu.im tag map
const WAIFU_TAGS = {
  waifu: 'waifu',
  neko: 'maid',
  maid: 'maid',
  uniform: 'uniform',
  selfies: 'selfies',
  raiden: 'raiden-shogun',
  rias: 'rias-gremory',
  kamisato: 'kamisato-ayaka',
  wink: 'wink',
  blush: 'blush',
  smile: 'smile',
  wave: 'wave',
  happy: 'happy',
  husbando: 'husbando',
  shinobu: 'shinobu',
  megumin: 'megumin',
  oppai: 'oppai',
};

// waifu.pics SFW types
const WAIFUPICS_TYPES = ['waifu', 'neko', 'shinobu', 'megumin', 'bully', 'cuddle', 'cry',
  'hug', 'awoo', 'kiss', 'lick', 'pat', 'smug', 'bonk', 'yeet', 'blush',
  'smile', 'wave', 'highfive', 'handhold', 'nom', 'bite', 'glomp', 'slap',
  'kill', 'kick', 'happy', 'wink', 'poke', 'dance', 'cringe'];

const COMMANDS = [...new Set([
  'waifu', 'neko', 'maid', 'husbando', 'shinobu', 'megumin',
  'uniform', 'selfies', 'raiden', 'rias', 'kamisato',
  'wink', 'blush', 'smile', 'wave', 'happy',
])];

async function fetchWaifuIm(tag) {
  const { data } = await axios.get('https://api.waifu.im/search', {
    params: { included_tags: tag, is_nsfw: false },
    timeout: 12000,
  });
  const images = data?.images;
  if (!images?.length) throw new Error('no image');
  return images[Math.floor(Math.random() * images.length)].url;
}

async function fetchWaifuPics(type) {
  const safeType = WAIFUPICS_TYPES.includes(type) ? type : 'waifu';
  const { data } = await axios.get(`https://api.waifu.pics/sfw/${safeType}`, { timeout: 10000 });
  if (!data?.url) throw new Error('no url');
  return data.url;
}

export default {
  command: 'waifu',
  alias: COMMANDS.filter(c => c !== 'waifu'),
  description: 'Anime girl/guy images — waifu, neko, maid, husbando, shinobu, megumin, raiden & more',
  category: 'fun',

  async execute({ sock, msg, jid, command, react, reply }) {
    await react('🌸');
    const cmd = (command || 'waifu').toLowerCase();
    const tag = WAIFU_TAGS[cmd] || 'waifu';
    const caption = `🌸 *${cmd.charAt(0).toUpperCase() + cmd.slice(1)}*\n\n> 🤖 *AA MD Bot*`;

    let imgUrl;
    try {
      imgUrl = await fetchWaifuIm(tag);
    } catch {
      try {
        imgUrl = await fetchWaifuPics(cmd);
      } catch {
        await react('❌');
        return reply('❌ Failed to fetch anime image. Try again later.');
      }
    }

    await sock.sendMessage(jid, { image: { url: imgUrl }, caption }, { quoted: msg });
    await react('✅');
  },
};
