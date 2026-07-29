// AA MD Bot — RIP Effect (local sharp, no external API)
import sharp from 'sharp';
import axios from 'axios';

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
    create: { width: 400, height: 400, channels: 3, background: { r: 80, g: 80, b: 80 } },
  }).jpeg({ quality: 80 }).toBuffer();
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
  description: 'RIP card effect — reply to image, tag someone, or just send',
  category: 'media',

  async execute({ sock, msg, jid, react, reply, quoted, senderJid, config }) {
    await react('⌛');
    try {
      const botName = config?.botName || 'AA MD Bot';

      // 1. Quoted image → use directly
      const quotedImg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
      if (quotedImg) {
        const stream = await sock.downloadMediaMessage(
          { message: { imageMessage: quotedImg } },
          'buffer',
          {}
        );
        const result = await ripEffect(stream);
        await sock.sendMessage(jid, {
          image: result,
          caption: `🪦 *RIP*\n\n> 🤖 *${botName}*`,
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

      const result = await ripEffect(raw);
      await sock.sendMessage(jid, {
        image: result,
        caption: `🪦 *RIP*\n\n> 🤖 *${botName}*`,
      }, { quoted: msg });
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *RIP effect failed.*\n\n${e.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
