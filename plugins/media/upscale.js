// AA MD Bot - AI Image Upscaler
// Primary: HuggingFace swin2SR (no key needed)
// Fallback: sharp 4x lanczos3 (guaranteed, local)
import axios from 'axios';
import sharp from 'sharp';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateId } from '../../lib/helper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP = path.join(__dirname, '../../temp');

const HF_MODELS = [
  'caidas/swin2SR-classical-sr-x4-64',
  'caidas/swin2SR-realworld-sr-x4-64',
  'eugenesiow/edsr-base',
];

async function tryHuggingFace(imageBuffer) {
  for (const model of HF_MODELS) {
    const url = `https://api-inference.huggingface.co/models/${model}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await axios.post(url, imageBuffer, {
          headers: { 'Content-Type': 'image/jpeg' },
          timeout: 40000,
          responseType: 'arraybuffer',
          maxContentLength: 15 * 1024 * 1024,
        });
        const buf = Buffer.from(res.data);
        if (buf.length > 5000) return buf;
      } catch (err) {
        // 503 = model loading — wait briefly and retry once
        if (err.response?.status === 503 && attempt === 0) {
          await new Promise(r => setTimeout(r, 8000));
          continue;
        }
        break;
      }
    }
  }
  return null;
}

async function sharpUpscale(imageBuffer) {
  const meta = await sharp(imageBuffer).metadata();
  const w = (meta.width  || 400) * 4;
  const h = (meta.height || 400) * 4;
  // Cap at 4000px to keep file size reasonable
  const scale = Math.min(1, 4000 / Math.max(w, h));
  return sharp(imageBuffer)
    .resize(Math.round(w * scale), Math.round(h * scale), {
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: false,
    })
    .sharpen({ sigma: 1.2, m1: 1.5, m2: 0.7 })
    .jpeg({ quality: 95, mozjpeg: true })
    .toBuffer();
}

function getImageMsg(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;
  const content = quoted || msg.message;
  return content?.imageMessage ? { content, quoted, ctx } : null;
}

export default {
  command: 'upscale',
  alias: ['enhance', 'hd', 'upscaleimg', 'aienhance'],
  description: 'Upscale / enhance an image 4x using AI',
  category: 'media',

  async execute({ sock, jid, msg, reply, react }) {
    const found = getImageMsg(msg);
    if (!found) return reply(
      `🔍 *Image Upscaler*\n\n*Reply* to any image and send *.upscale*.\n\nConverts to 4x HD resolution.\n\n> 🤖 *AA MD Bot*`
    );

    await react('⏳');
    fs.ensureDirSync(TEMP);
    const id = generateId();
    const imgPath = path.join(TEMP, `${id}_up_in.jpg`);

    try {
      const { content, quoted, ctx } = found;
      const msgObj = quoted
        ? { message: content, key: { ...msg.key, id: ctx.stanzaId } }
        : msg;

      const buffer = await downloadMediaMessage(msgObj, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
      if (!buffer?.length) throw new Error('Image download failed');
      await fs.writeFile(imgPath, buffer);

      // Try AI upscale first; fall back to sharp
      let result = await tryHuggingFace(buffer);
      let method = '🤖 AI Upscaled (4x HD)';

      if (!result) {
        result = await sharpUpscale(buffer);
        method = '🔍 Upscaled (4x HD)';
      }

      if (!result) throw new Error('Upscale failed');

      await sock.sendMessage(jid, {
        image: result,
        mimetype: 'image/jpeg',
        caption: `${method}\n\n> 🤖 *AA MD Bot*`,
      }, { quoted: msg });
      await react('✅');
    } catch (err) {
      await react('❌');
      reply(`❌ *Error:* ${err.message}\n\n> 🤖 *AA MD Bot*`);
    } finally {
      fs.remove(imgPath).catch(() => {});
    }
  },
};
