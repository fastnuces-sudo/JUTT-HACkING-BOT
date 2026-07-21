// AA MD Bot - AI Image Upscaler
// Free: HuggingFace swin2SR (no key needed)
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateId } from '../../lib/helper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP = path.join(__dirname, '../../temp');

const MODELS = [
  'caidas/swin2SR-classical-sr-x4-64',
  'caidas/swin2SR-realworld-sr-x4-64',
  'eugenesiow/edsr-base',
];

async function upscaleImage(imageBuffer) {
  for (const model of MODELS) {
    const url = `https://api-inference.huggingface.co/models/${model}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await axios.post(url, imageBuffer, {
          headers: { 'Content-Type': 'image/jpeg' },
          timeout: 90000,
          responseType: 'arraybuffer',
          maxContentLength: 15 * 1024 * 1024,
        });
        const buf = Buffer.from(res.data);
        if (buf.length > 5000) return buf;
      } catch (err) {
        let est = null;
        try { est = JSON.parse(Buffer.from(err.response?.data || '{}').toString())?.estimated_time; } catch {}
        if (err.response?.status === 503 && est && attempt < 2) {
          await new Promise(r => setTimeout(r, Math.min(est * 1000, 30000)));
          continue;
        }
        break;
      }
    }
  }
  return null;
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
  description: 'Image ko AI se 4x upscale/enhance karo',
  category: 'media',

  async execute({ sock, jid, msg, reply, react }) {
    const found = getImageMsg(msg);
    if (!found) return reply(
      `🔍 *AI Image Upscaler*\n\nKisi image ko *reply* kar ke *.upscale* bhejo.\n\nAI image ko 4x HD mein convert karega.\n\n> 🤖 *AA MD Bot*`
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

      const buffer = await sock.downloadMediaMessage(msgObj);
      if (!buffer?.length) throw new Error('Image download failed');
      await fs.writeFile(imgPath, buffer);

      const result = await upscaleImage(buffer);
      if (!result) {
        await react('❌');
        return reply(`❌ *Upscale fail hua.*\n\nServer busy hai, thodi der baad dobara try karo.\n\n> 🤖 *AA MD Bot*`);
      }

      await sock.sendMessage(jid, {
        image: result,
        mimetype: 'image/png',
        caption: `🔍 *AI Upscaled (4x HD)*\n\n> 🤖 *AA MD Bot*`,
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
