// AA MD Bot — Trash Effect (local sharp, no external API)
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

async function trashEffect(buf) {
  const img = sharp(buf);
  const { width: w = 400, height: h = 400 } = await img.metadata();
  const svg = Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="none" stroke="#555" stroke-width="10"/>
      <rect x="0" y="${h - 52}" width="${w}" height="52" fill="rgba(0,0,0,0.78)"/>
      <text x="${w / 2}" y="${h - 15}" text-anchor="middle" font-size="28"
        fill="white" font-family="sans-serif" font-weight="bold" letter-spacing="4">TRASH</text>
    </svg>`
  );
  return img
    .modulate({ brightness: 0.88, saturation: 0.55 })
    .composite([{ input: svg, blend: 'over' }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

export default {
  command: 'trash',
  alias: ['trashcard'],
  description: 'Put someone\'s DP in a trash can (tag or reply)',
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

      const result = await trashEffect(raw);
      await sock.sendMessage(jid, {
        image: result,
        caption: `🗑️ *Trash Effect*\n\n> 🤖 *${botName}*`,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *Trash effect failed.*\n\n${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
