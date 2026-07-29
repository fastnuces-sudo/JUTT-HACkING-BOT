// AA MD Bot — Trigger Effect (local sharp, no external API)
import sharp from 'sharp';
import axios from 'axios';

async function fetchBuf(url) {
  const { data } = await axios.get(url, {
    responseType: 'arraybuffer', timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  return Buffer.from(data);
}

async function triggerEffect(buf) {
  const img = sharp(buf);
  const { width: w = 400, height: h = 400 } = await img.metadata();
  const midY = Math.floor(h / 2);
  const svg = Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="rgba(255,0,0,0.22)"/>
      <rect width="${w}" height="${h}" fill="none" stroke="red" stroke-width="14"/>
      <rect x="0" y="${midY - 38}" width="${w}" height="76" fill="rgba(0,0,0,0.75)"/>
      <text x="${w / 2}" y="${midY + 20}" text-anchor="middle" font-size="46"
        fill="red" font-family="Impact, Arial Black" font-weight="bold" letter-spacing="3">TRIGGERED!</text>
    </svg>`
  );
  return img
    .modulate({ saturation: 1.35 })
    .composite([{ input: svg, blend: 'over' }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

export default {
  command: 'trigger',
  alias: ['triggered'],
  description: 'Make a triggered image from someone\'s DP (tag or reply)',
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
      const result = await triggerEffect(raw);
      const botName = config?.botName || 'AA MD Bot';

      await sock.sendMessage(jid, {
        image: result,
        caption: `😤 *Triggered!*\n\n> 🤖 *${botName}*`,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *Trigger effect failed.*\n${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
