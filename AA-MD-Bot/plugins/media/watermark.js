// AA MD Bot - Image Watermark
// Uses ffmpeg drawtext — no extra dependencies
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateId } from '../../lib/helper.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP = path.join(__dirname, '../../temp');

async function getFfmpeg() {
  try { const m = await import('ffmpeg-static'); return m.default || 'ffmpeg'; } catch { return 'ffmpeg'; }
}

function getImageMsg(msg) {
  const ctx = msg.message?.extendedTextMessage?.contextInfo;
  const quoted = ctx?.quotedMessage;
  const content = quoted || msg.message;
  return content?.imageMessage ? { content, quoted, ctx } : null;
}

// Positions map
const POS = {
  center:       { x: '(w-text_w)/2',       y: '(h-text_h)/2' },
  top:          { x: '(w-text_w)/2',       y: '20' },
  bottom:       { x: '(w-text_w)/2',       y: 'h-text_h-20' },
  topleft:      { x: '20',                 y: '20' },
  topright:     { x: 'w-text_w-20',        y: '20' },
  bottomleft:   { x: '20',                 y: 'h-text_h-20' },
  bottomright:  { x: 'w-text_w-20',        y: 'h-text_h-20' },
};

export default {
  command: 'watermark',
  alias: ['wm', 'addwm', 'wmimage'],
  description: 'Image pe text watermark lagao',
  category: 'media',

  async execute({ sock, jid, msg, reply, react, args, text }) {
    const found = getImageMsg(msg);
    if (!found || !text) return reply(
      `💧 *Watermark*\n\nReply to any image with:\n*.watermark <text>*\n*.watermark <text> | <position>*\n\n*Positions:* center, top, bottom, topleft, topright, bottomleft, bottomright\n\n*Example:*\n_.watermark AA MD Bot | bottomright_\n\n> 🤖 *AA MD Bot*`
    );

    const parts   = text.split('|').map(s => s.trim());
    const wmText  = parts[0] || 'AA MD Bot';
    const posKey  = (parts[1] || 'bottomright').toLowerCase().replace(/\s/g, '');
    const pos     = POS[posKey] || POS.bottomright;

    await react('⏳');
    fs.ensureDirSync(TEMP);
    const id = generateId();
    const inp = path.join(TEMP, `${id}_wm_in.jpg`);
    const out = path.join(TEMP, `${id}_wm_out.jpg`);

    try {
      const { content, quoted, ctx } = found;
      const msgObj = quoted ? { message: content, key: { ...msg.key, id: ctx.stanzaId } } : msg;
      const buffer = await sock.downloadMediaMessage(msgObj);
      if (!buffer?.length) throw new Error('Image download failed');
      await fs.writeFile(inp, buffer);

      const ff = await getFfmpeg();
      // Escape special characters for ffmpeg drawtext
      const escaped = wmText.replace(/[\\:']/g, c => `\\${c}`);

      await execFileAsync(ff, [
        '-y', '-i', inp,
        '-vf', `drawtext=text='${escaped}':fontsize=36:fontcolor=white:borderw=2:bordercolor=black:x=${pos.x}:y=${pos.y}:alpha=0.85`,
        '-q:v', '2',
        out,
      ], { timeout: 30000 });

      const resultBuf = await fs.readFile(out);
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
      fs.remove(out).catch(() => {});
    }
  },
};
