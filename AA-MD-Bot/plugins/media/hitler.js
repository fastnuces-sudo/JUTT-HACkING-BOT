// AA MD Bot — Hitler Effect (local sharp, no external API)
import sharp from 'sharp';
import axios from 'axios';

async function fetchBuf(url) {
  const { data } = await axios.get(url, {
    responseType: 'arraybuffer', timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  return Buffer.from(data);
}

async function makePlaceholder() {
  return sharp({
    create: { width: 400, height: 400, channels: 3, background: { r: 90, g: 90, b: 90 } },
  }).jpeg({ quality: 80 }).toBuffer();
}

async function hitlerEffect(buf) {
  const img = sharp(buf);
  const { width: w = 400, height: h = 400 } = await img.metadata();
  const svg = Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="none" stroke="#333" stroke-width="10"/>
      <rect x="0" y="${h - 58}" width="${w}" height="58" fill="rgba(0,0,0,0.82)"/>
      <text x="${w / 2}" y="${h - 16}" text-anchor="middle" font-size="22"
        fill="#cc0000" font-family="sans-serif" font-weight="bold" letter-spacing="2">WORSE THAN HITLER</text>
    </svg>`
  );
  return img
    .grayscale()
    .modulate({ brightness: 0.8 })
    .composite([{ input: svg, blend: 'over' }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

export default {
  command: 'hitler',
  alias: [],
  description: 'Put someone\'s DP on a Hitler image (tag or reply)',
  category: 'media',

  async execute({ sock, msg, jid, react, reply, quoted, senderJid, config }) {
    await react('⌛');
    try {
      const TAG       = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const targetJid = quoted?.key?.participant || quoted?.key?.remoteJid || TAG[0] || senderJid;
      const botName   = config?.botName || 'AA MD Bot';

      let raw;
      try {
        const imgUrl = await sock.profilePictureUrl(targetJid, 'image');
        raw = await fetchBuf(imgUrl);
      } catch {
        raw = await makePlaceholder();
      }

      const result = await hitlerEffect(raw);
      await sock.sendMessage(jid, {
        image: result,
        caption: `😈 *Hitler Effect*\n\n> 🤖 *${botName}*`,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *Hitler effect failed.*\n\n${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
