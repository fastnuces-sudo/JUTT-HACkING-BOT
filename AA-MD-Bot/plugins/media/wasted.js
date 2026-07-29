// AA MD Bot — GTA Wasted Effect (local sharp, no external API)
import sharp from 'sharp';
import axios from 'axios';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

// Download any URL to buffer
async function fetchBuf(url) {
  const { data } = await axios.get(url, {
    responseType: 'arraybuffer', timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  return Buffer.from(data);
}

// Generate a gray placeholder when no DP is available
async function makePlaceholder() {
  return sharp({
    create: { width: 400, height: 400, channels: 3, background: { r: 100, g: 100, b: 100 } },
  }).jpeg({ quality: 80 }).toBuffer();
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
  description: 'GTA Wasted effect — reply to image, tag someone, or just send',
  category: 'media',

  async execute({ sock, msg, jid, react, reply, quoted, senderJid, config }) {
    await react('⌛');
    try {
      const botName = config?.botName || 'AA MD Bot';

      // 1. Quoted image → use directly
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedImg = quotedMsg?.imageMessage;
      if (quotedImg) {
        const buf = await downloadMediaMessage(
          { message: { imageMessage: quotedImg }, key: msg.key },
          'buffer', {},
          { reuploadRequest: sock.updateMediaMessage }
        );
        const result = await wastedEffect(buf);
        await sock.sendMessage(jid, {
          image: result,
          caption: `☠️ *Wasted*\n\n> 🤖 *${botName}*`,
        }, { quoted: msg });
        return await react('✅');
      }

      // 2. Tag or reply → get their DP
      const TAG       = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      const targetJid = quoted?.key?.participant || quoted?.key?.remoteJid || TAG[0] || senderJid;

      let raw;
      try {
        const imgUrl = await sock.profilePictureUrl(targetJid, 'image');
        raw = await fetchBuf(imgUrl);
      } catch {
        // DP unavailable (private) — use gray placeholder
        raw = await makePlaceholder();
      }

      const result = await wastedEffect(raw);
      await sock.sendMessage(jid, {
        image: result,
        caption: `☠️ *Wasted*\n\n> 🤖 *${botName}*`,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *Wasted effect failed.*\n\n${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
