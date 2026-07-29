// AA MD Bot — RIP Effect (local sharp, no external API)
import sharp from 'sharp';
import axios from 'axios';

async function fetchBuf(url) {
  const { data } = await axios.get(url, {
    responseType: 'arraybuffer', timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  return Buffer.from(data);
}

async function ripEffect(buf) {
  const img = sharp(buf);
  const { width: w = 400, height: h = 400 } = await img.metadata();
  const svg = Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="none" stroke="#888" stroke-width="10"/>
      <rect x="0" y="${h - 58}" width="${w}" height="58" fill="rgba(0,0,0,0.78)"/>
      <text x="${w / 2}" y="${h - 18}" text-anchor="middle" font-size="28"
        fill="white" font-family="serif" font-weight="bold" letter-spacing="5">R . I . P .</text>
    </svg>`
  );
  return img
    .grayscale()
    .modulate({ brightness: 0.85 })
    .composite([{ input: svg, blend: 'over' }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

export default {
  command: 'rip',
  alias: ['ripcard'],
  description: 'Put someone\'s DP on a RIP card (tag or reply)',
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
      const result = await ripEffect(raw);
      const botName = config?.botName || 'AA MD Bot';

      await sock.sendMessage(jid, {
        image: result,
        caption: `🪦 *RIP*\n\n> 🤖 *${botName}*`,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *RIP effect failed.*\n${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
