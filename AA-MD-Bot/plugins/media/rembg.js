// AA MD Bot - Background Remover
// Free: HuggingFace briaai/RMBG-1.4 (no key needed, faster with HF_TOKEN)
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateId } from '../../lib/helper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP = path.join(__dirname, '../../temp');

const MODELS = [
  'briaai/RMBG-1.4',
  'not-lain/webui',
];

async function removeBackground(imageBuffer) {
  const token = process.env.HF_TOKEN;
  const headers = { 'Content-Type': 'image/jpeg' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  for (const model of MODELS) {
    const url = `https://api-inference.huggingface.co/models/${model}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await axios.post(url, imageBuffer, {
          headers,
          timeout: 60000,
          responseType: 'arraybuffer',
          maxContentLength: 10 * 1024 * 1024,
        });
        const buf = Buffer.from(res.data);
        if (buf.length > 1000) return buf;
      } catch (err) {
        const est = err.response?.data ? JSON.parse(Buffer.from(err.response.data).toString())?.estimated_time : null;
        if (err.response?.status === 503 && est && attempt < 2) {
          await new Promise(r => setTimeout(r, Math.min(est * 1000, 25000)));
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
  command: 'rembg',
  alias: ['removebg', 'nobg', 'bgremove', 'transparent'],
  description: 'Image ka background remove karo (AI)',
  category: 'media',

  async execute({ sock, jid, msg, reply, react }) {
    const found = getImageMsg(msg);
    if (!found) return reply(
      `✂️ *Background Remover*\n\nKisi image ko *reply* kar ke *.rembg* bhejo.\n\nAI background hata ke transparent PNG dega.\n\n> 🤖 *AA MD Bot*`
    );

    await react('⏳');
    fs.ensureDirSync(TEMP);
    const id = generateId();
    const imgPath = path.join(TEMP, `${id}_rembg_in.jpg`);
    const outPath = path.join(TEMP, `${id}_rembg_out.png`);

    try {
      const { content, quoted, ctx } = found;
      const msgObj = quoted
        ? { message: content, key: { ...msg.key, id: ctx.stanzaId } }
        : msg;

      const buffer = await sock.downloadMediaMessage(msgObj);
      if (!buffer?.length) throw new Error('Image download failed');
      await fs.writeFile(imgPath, buffer);

      const result = await removeBackground(buffer);
      if (!result) {
        await react('❌');
        return reply(`❌ *Background remove fail hua.*\n\nHF server busy hai. Thodi der baad try karo ya HF_TOKEN set karo.\n\n> 🤖 *AA MD Bot*`);
      }

      await fs.writeFile(outPath, result);
      await sock.sendMessage(jid, {
        image: result,
        mimetype: 'image/png',
        caption: `✂️ *Background Removed*\n\n_Transparent PNG — sticker banane ke liye .sticker use karo_\n\n> 🤖 *AA MD Bot*`,
      }, { quoted: msg });
      await react('✅');
    } catch (err) {
      await react('❌');
      reply(`❌ *Error:* ${err.message}\n\n> 🤖 *AA MD Bot*`);
    } finally {
      fs.remove(imgPath).catch(() => {});
      fs.remove(outPath).catch(() => {});
    }
  },
};
