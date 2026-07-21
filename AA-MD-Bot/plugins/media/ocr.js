// ============================================
// AA MD Bot - Image to Text (OCR)
// Developer: Ahsan Ali | AA Mods
// Free: OCR.Space API (no signup needed)
// Optional: set OCR_SPACE_KEY for more limits
// ============================================

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { generateId } from '../../lib/helper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDir    = path.join(__dirname, '../../temp');
const OCR_KEY   = process.env.OCR_SPACE_KEY || 'helloworld';

async function ocrRequest(base64Data, language, engine) {
  const params = new URLSearchParams({
    apikey:             OCR_KEY,
    base64Image:        `data:image/jpeg;base64,${base64Data}`,
    language,
    isOverlayRequired:  'false',
    detectOrientation:  'true',
    scale:              'true',
    isTable:            'false',
    OCREngine:          String(engine),
  });

  const res = await axios.post('https://api.ocr.space/parse/image', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 40000,
  });

  const result = res.data?.ParsedResults?.[0];
  if (!result || result.FileParseExitCode !== 1) return null;
  return (result.ParsedText || '').replace(/\r\n/g, '\n').trim() || null;
}

// Try multiple language+engine combos for best accuracy
async function bestOcr(base64Data) {
  // Strategy: Engine 2 (neural) is better for most text
  // Fallback to Engine 1 (Tesseract) which supports more languages
  const attempts = [
    { lang: 'eng', engine: 2 },
    { lang: 'ara', engine: 2 },  // covers Urdu/Arabic
    { lang: 'eng', engine: 1 },
    { lang: 'ara', engine: 1 },
  ];

  for (const { lang, engine } of attempts) {
    try {
      const text = await ocrRequest(base64Data, lang, engine);
      if (text && text.length > 2) return text;
    } catch {}
  }
  return null;
}

export default {
  command: 'ocr',
  alias: ['imagetext', 'readimage', 'img2text', 'textfromimage'],
  description: 'Extract text from an image (Urdu/English/Arabic)',
  category: 'media',

  async execute({ sock, jid, msg, reply, react }) {
    const ctx    = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;
    const content = quoted || msg.message;
    const imgMsg  = content?.imageMessage || content?.documentMessage;

    if (!imgMsg) {
      return reply(`🖼️ *Image to Text (OCR)*\n\n*Reply* to any image and send *.ocr*.\n\nSupports Urdu, English, and Arabic.\n\n> 🤖 *AA MD Bot*`);
    }

    await react('⏳');
    fs.ensureDirSync(tmpDir);
    const id      = generateId();
    const imgPath = path.join(tmpDir, `${id}_ocr.jpg`);

    try {
      const msgObj = quoted
        ? { message: content, key: { ...msg.key, id: ctx.stanzaId } }
        : msg;

      const buffer = await sock.downloadMediaMessage(msgObj);
      if (!buffer?.length) throw new Error('Image download failed');
      await fs.writeFile(imgPath, buffer);

      const base64 = buffer.toString('base64');
      const text   = await bestOcr(base64);

      if (!text) {
        await react('❌');
        return reply(`❌ *No text found.*\n\nThe text in the image was unclear or the image quality is too low.\n\n> 🤖 *AA MD Bot*`);
      }

      await react('✅');
      return reply(`🖼️ *OCR Result*\n\n${text}\n\n> 🤖 *AA MD Bot*`);

    } catch (err) {
      await react('❌');
      return reply(`❌ *Error:* ${err.message}\n\n> 🤖 *AA MD Bot*`);
    } finally {
      fs.remove(imgPath).catch(() => {});
    }
  },
};
