// AA MD Bot - Image Watermark
// Uses sharp SVG overlay — reliable, no ffmpeg font issues
import sharp from 'sharp';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateId } from '../../lib/helper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP = path.join(__dirname, '../../temp');

// Position maps: [textAnchor, xExpr, yExpr] for SVG
const POS = {
  center:      ['middle', '50%', '50%'],
  top:         ['middle', '50%', '8%'],
  bottom:      ['middle', '50%', '94%'],
  topleft:     ['start',  '3%',  '8%'],
  topright:    ['end',    '97%', '8%'],
  bottomleft:  ['start',  '3%',  '94%'],
  bottomright: ['end',    '97%', '94%'],
};

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildSvg(text, width, height, posKey) {
  const [anchor, xPct, yPct] = POS[posKey] || POS.bottomright;
  const x = xPct;
  const y = yPct;
  const fontSize = Math.max(20, Math.round(Math.min(width, height) * 0.06));
  const safe = escapeXml(text);
  return Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">` +
    `<style>text{font-family:Arial,Helvetica,sans-serif;font-weight:bold}</style>` +
    // Shadow/stroke for readability
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${fontSize}" ` +
    `fill="black" fill-opacity="0.55" stroke="black" stroke-width="3" stroke-opacity="0.5">${safe}</text>` +
    // Main text
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${fontSize}" ` +
    `fill="white" fill-opacity="0.9">${safe}</text>` +
    `</svg>`
  );
}

function getImageMsg(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;
  const content = quoted || msg.message;
  return content?.imageMessage ? { content, quoted, ctx } : null;
}

export default {
  command: 'watermark',
  alias: ['wm', 'addwm', 'wmimage'],
  description: 'Image pe text watermark lagao',
  category: 'media',

  async execute({ sock, jid, msg, reply, react, text }) {
    const found = getImageMsg(msg);
    if (!found || !text) return reply(
      `💧 *Watermark*\n\nReply to any image with:\n*.watermark <text>*\n*.watermark <text> | <position>*\n\n` +
      `*Positions:* center, top, bottom, topleft, topright, bottomleft, bottomright\n\n` +
      `*Example:*\n_.watermark AA MD Bot | bottomright_\n\n> 🤖 *AA MD Bot*`
    );

    const parts  = text.split('|').map(s => s.trim());
    const wmText = parts[0] || 'AA MD Bot';
    const posKey = (parts[1] || 'bottomright').toLowerCase().replace(/\s/g, '');

    await react('⏳');
    await fs.ensureDir(TEMP);
    const id  = generateId();
    const inp = path.join(TEMP, `${id}_wm_in.jpg`);

    try {
      const { content, quoted, ctx } = found;
      const msgObj = quoted ? { message: content, key: { ...msg.key, id: ctx.stanzaId } } : msg;
      const buffer = await downloadMediaMessage(msgObj, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage });
      if (!buffer?.length) throw new Error('Image download failed');

      await fs.writeFile(inp, buffer);

      // Get image dimensions
      const meta = await sharp(buffer).metadata();
      const w    = meta.width  || 800;
      const h    = meta.height || 600;

      // Build SVG overlay
      const svg = buildSvg(wmText, w, h, posKey);

      // Composite SVG onto image
      const resultBuf = await sharp(buffer)
        .composite([{ input: svg, top: 0, left: 0 }])
        .jpeg({ quality: 92 })
        .toBuffer();

      await sock.sendMessage(jid, {
        image: resultBuf,
        caption: `💧 *Watermark Added*\n\n_"${wmText}"_ — ${posKey}\n\n> 🤖 *AA MD Bot*`,
      }, { quoted: msg });
      await react('✅');
    } catch (err) {
      await react('❌');
      reply(`❌ *Error:* ${err.message}\n\n> 🤖 *AA MD Bot*`);
    } finally {
      fs.remove(inp).catch(() => {});
    }
  },
};
