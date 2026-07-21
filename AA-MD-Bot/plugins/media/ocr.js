// ============================================
// AA MD Bot - Image to Text (OCR)
// Developer: Ahsan Ali | AA Mods
// Uses OCR.Space free API — no key setup needed
// ============================================

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import FormData from 'form-data';
import { generateId } from '../../lib/helper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDir    = path.join(__dirname, '../../temp');

// OCR.Space free demo key — works without signup (rate limited)
const OCR_KEY = process.env.OCR_SPACE_KEY || 'helloworld';

export default {
  command: 'ocr',
  alias: ['imagetext', 'readimage', 'img2text', 'textfromimage'],
  description: 'Image mein likha text extract karo',
  category: 'media',

  async execute({ sock, jid, msg, reply, react }) {
    const ctx    = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;
    const msgContent = quoted || msg.message;
    const imgMsg     = msgContent?.imageMessage || msgContent?.documentMessage;

    if (!imgMsg) {
      return reply(
        `🖼️ *Image to Text (OCR)*\n\n` +
        `Kisi image ko *reply* kar ke *.ocr* bhejo.\n\n` +
        `*Kya karta hai:*\n` +
        `• Image mein likha text extract karta hai\n` +
        `• Urdu, English, Arabic sab support\n` +
        `• Screenshots, documents, signs sab kaam karte hain\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    await react('⏳');
    fs.ensureDirSync(tmpDir);
    const id      = generateId();
    const imgPath = path.join(tmpDir, `${id}_ocr.jpg`);

    try {
      // Download image
      const msgObj = quoted
        ? { message: msgContent, key: { ...msg.key, id: ctx.stanzaId } }
        : msg;
      const buffer = await sock.downloadMediaMessage(msgObj);
      if (!buffer?.length) throw new Error('Image download failed');
      await fs.writeFile(imgPath, buffer);

      // Send to OCR.Space
      const form = new FormData();
      form.append('file', fs.createReadStream(imgPath), `${id}.jpg`);
      form.append('apikey', OCR_KEY);
      form.append('language', 'eng');          // English first pass
      form.append('isOverlayRequired', 'false');
      form.append('detectOrientation', 'true');
      form.append('scale', 'true');
      form.append('isTable', 'false');
      form.append('OCREngine', '2');           // Engine 2 = better accuracy

      const res = await axios.post(
        'https://api.ocr.space/parse/image',
        form,
        { headers: form.getHeaders(), timeout: 30000 }
      );

      const result = res.data?.ParsedResults?.[0];
      if (!result || result.FileParseExitCode !== 1) {
        await react('❌');
        return reply(`❌ *OCR fail ho gaya.*\n\nImage mein readable text nahi mila.\n\n> 🤖 *AA MD Bot*`);
      }

      const extracted = (result.ParsedText || '').trim();
      if (!extracted) {
        await react('❌');
        return reply(`❌ *Koi text nahi mila.*\n\nImage mein text clear nahi tha.\n\n> 🤖 *AA MD Bot*`);
      }

      await react('✅');
      return reply(
        `🖼️ *Image to Text (OCR)*\n\n` +
        `📝 *Extracted Text:*\n\n${extracted}\n\n` +
        `> 🤖 *AA MD Bot*`
      );

    } catch (err) {
      await react('❌');
      return reply(`❌ *Error:* ${err.message}\n\n> 🤖 *AA MD Bot*`);
    } finally {
      fs.remove(imgPath).catch(() => {});
    }
  },
};
