// AA MD Bot — Wanted Poster Effect (local sharp, no external API)
import sharp from 'sharp';
import axios from 'axios';

async function fetchBuf(url) {
  const { data } = await axios.get(url, {
    responseType: 'arraybuffer', timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  return Buffer.from(data);
}

async function wantedEffect(buf) {
  const img = sharp(buf);
  const { width: w = 400, height: h = 400 } = await img.metadata();
  const svg = Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="none" stroke="#8B6914" stroke-width="14"/>
      <rect x="0" y="0" width="${w}" height="52" fill="rgba(80,50,0,0.88)"/>
      <text x="${w / 2}" y="37" text-anchor="middle" font-size="30"
        fill="#FFD700" font-family="serif" font-weight="bold" letter-spacing="7">WANTED</text>
      <rect x="0" y="${h - 48}" width="${w}" height="48" fill="rgba(80,50,0,0.88)"/>
      <text x="${w / 2}" y="${h - 14}" text-anchor="middle" font-size="19"
        fill="#FFD700" font-family="serif" letter-spacing="3">DEAD OR ALIVE</text>
    </svg>`
  );
  return img
    .modulate({ brightness: 1.05, saturation: 0.7, hue: 15 })
    .composite([{ input: svg, blend: 'over' }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

export default {
  command: 'wanted',
  alias: ['wantedposter'],
  description: 'Put someone\'s DP on a wanted poster (tag or reply)',
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
      const result = await wantedEffect(raw);
      const botName = config?.botName || 'AA MD Bot';

      await sock.sendMessage(jid, {
        image: result,
        caption: `🤠 *Wanted Poster*\n\n> 🤖 *${botName}*`,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *Wanted effect failed.*\n${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
