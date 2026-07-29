// AA MD Bot — GTA Wasted Effect (local sharp, no external API)
import sharp from 'sharp';
import axios from 'axios';

async function fetchBuf(url) {
  const { data } = await axios.get(url, {
    responseType: 'arraybuffer', timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  return Buffer.from(data);
}

async function wastedEffect(buf) {
  const img = sharp(buf);
  const { width: w = 400, height: h = 400 } = await img.metadata();
  const midY = Math.floor(h / 2);
  const svg = Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="rgba(180,0,0,0.30)"/>
      <rect x="0" y="${midY - 44}" width="${w}" height="88" fill="rgba(0,0,0,0.72)"/>
      <text x="${w / 2}" y="${midY + 20}" text-anchor="middle" font-size="54"
        fill="#e8e800" font-family="Impact, Arial Black" font-weight="bold" letter-spacing="5">WASTED</text>
    </svg>`
  );
  return img
    .modulate({ brightness: 0.72, saturation: 0.45 })
    .composite([{ input: svg, blend: 'over' }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

export default {
  command: 'wasted',
  alias: ['gtawasted'],
  description: 'Make a GTA wasted image from someone\'s DP (tag or reply)',
  category: 'media',

  async execute({ sock, msg, jid, react, reply, quoted, senderJid, config }) {
    await react('⌛');
    try {
      const TAG = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const targetJid = quoted?.key?.participant || quoted?.key?.remoteJid || TAG[0] || senderJid;
      let imgUrl;
      try { imgUrl = await sock.profilePictureUrl(targetJid, 'image'); }
      catch { imgUrl = 'https://telegra.ph/file/9521e9ee2fdbd0d6f4f1c.jpg'; }

      const raw = await fetchBuf(imgUrl);
      const result = await wastedEffect(raw);
      const botName = config?.botName || 'AA MD Bot';

      await sock.sendMessage(jid, {
        image: result,
        caption: `☠️ *Wasted*\n\n> 🤖 *${botName}*`,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *Wasted effect failed.*\n${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
