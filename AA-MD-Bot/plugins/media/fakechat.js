// AA MD Bot - Fake WhatsApp Chat Generator
// Uses Jimp v1 (named exports) to generate chat bubble image
import { Jimp, loadFont, HorizontalAlign } from 'jimp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { generateId } from '../../lib/helper.js';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const TEMP       = path.join(__dirname, '../../temp');
const FONTS_DIR  = path.join(__dirname, '../../node_modules/@jimp/plugin-print/dist/fonts/open-sans');

const F16B = path.join(FONTS_DIR, 'open-sans-16-black/open-sans-16-black.fnt');
const F32B = path.join(FONTS_DIR, 'open-sans-32-black/open-sans-32-black.fnt');
const F16W = path.join(FONTS_DIR, 'open-sans-16-white/open-sans-16-white.fnt');

// WhatsApp-like colors (RGBA hex integers)
const BG_COLOR    = 0xE5DDD5FF;
const MINE_COLOR  = 0xDCF8C6FF;
const THEIR_COLOR = 0xFFFFFFFF;
const HDR_COLOR   = 0x075E54FF;

const W         = 420;
const BUBBLE_W  = 300;
const PAD       = 10;
const LINE_H    = 20;

function wrapText(text, maxChars = 38) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (candidate.length > maxChars) {
      if (cur) lines.push(cur);
      cur = w.length > maxChars ? w.slice(0, maxChars) : w;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

function timeStr() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`;
}

function fillRect(img, x, y, w, h, colorHex) {
  const r = (colorHex >>> 24) & 0xFF;
  const g = (colorHex >>> 16) & 0xFF;
  const b = (colorHex >>> 8)  & 0xFF;
  const a = colorHex          & 0xFF;
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      img.setPixelColor(
        ((r << 24) | (g << 16) | (b << 8) | a) >>> 0,
        px, py
      );
    }
  }
}

async function buildChat(contactName, messages) {
  const font16B = await loadFont(F16B);
  const font32B = await loadFont(F32B);
  const font16W = await loadFont(F16W);

  // Pre-calculate total height
  const blocks = [];
  for (const { who, text } of messages) {
    const lines = wrapText(text, 38);
    const nameH = who === 'them' ? LINE_H + 4 : 0;
    const bh    = nameH + lines.length * LINE_H + 24;
    blocks.push({ who, text, lines, bh, nameH });
  }

  const totalH = 56 + blocks.reduce((s, b) => s + b.bh + 8, 0) + 16;
  const img    = new Jimp({ width: W, height: totalH, color: BG_COLOR });

  // Header
  fillRect(img, 0, 0, W, 52, HDR_COLOR);
  img.print({ font: font32B, x: 58, y: 10, text: contactName });

  let y = 60;
  const t = timeStr();

  for (const { who, lines, bh, nameH } of blocks) {
    const isMine = who === 'me';
    const bx     = isMine ? W - BUBBLE_W - PAD : PAD;
    const bgCol  = isMine ? MINE_COLOR : THEIR_COLOR;

    // Bubble background
    fillRect(img, bx, y, BUBBLE_W, bh, bgCol);

    let ty = y + 6;

    // Contact name for incoming
    if (!isMine) {
      img.print({ font: font16W, x: bx + 8, y: ty, text: contactName, maxWidth: BUBBLE_W - 16 });
      ty += nameH;
    }

    // Message lines
    for (const line of lines) {
      img.print({ font: font16B, x: bx + 8, y: ty, text: line, maxWidth: BUBBLE_W - 16 });
      ty += LINE_H;
    }

    // Timestamp (small, bottom-right of bubble)
    img.print({ font: font16B, x: bx + BUBBLE_W - 45, y: ty + 2, text: t });

    y += bh + 8;
  }

  return img.getBuffer('image/jpeg');
}

export default {
  command: 'fakechat',
  alias: ['fc', 'fakewa', 'fakemsg'],
  description: 'Fake WhatsApp chat screenshot banao',
  category: 'media',

  async execute({ sock, jid, msg, reply, react, text, prefix }) {
    if (!text) return reply(
      `💬 *Fake Chat Generator*\n\n` +
      `*Format:*\n_${prefix}fakechat ContactName | them:message | me:reply | them:msg_\n\n` +
      `*Misaal:*\n_${prefix}fakechat Ahmed | them:Kya haal? | me:Alhamdulillah! | them:MashaAllah_\n\n` +
      `> 🤖 *AA MD Bot*`
    );

    const parts = text.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length < 2) return reply(
      `❌ Kam se kam ek message chahiye.\n*Format:* _${prefix}fakechat Name | them:msg | me:msg_\n\n> 🤖 *AA MD Bot*`
    );

    const contactName = parts[0];
    const msgs = parts.slice(1).map(p => {
      const lower = p.toLowerCase();
      if (lower.startsWith('me:'))   return { who: 'me',   text: p.slice(3).trim() };
      if (lower.startsWith('them:')) return { who: 'them', text: p.slice(5).trim() };
      return { who: 'them', text: p };
    }).filter(m => m.text);

    if (!msgs.length) return reply(`❌ Koi message nahi mila.\n\n> 🤖 *AA MD Bot*`);

    await react('⏳');
    fs.ensureDirSync(TEMP);
    const outPath = path.join(TEMP, `${generateId()}_fc.jpg`);

    try {
      const buf = await buildChat(contactName, msgs);
      await fs.writeFile(outPath, buf);
      await sock.sendMessage(jid, {
        image: buf,
        caption: `💬 *Fake Chat — ${contactName}*\n\n> 🤖 *AA MD Bot*`,
      }, { quoted: msg });
      await react('✅');
    } catch (err) {
      await react('❌');
      reply(`❌ *Error:* ${err.message}\n\n> 🤖 *AA MD Bot*`);
    } finally {
      fs.remove(outPath).catch(() => {});
    }
  },
};
