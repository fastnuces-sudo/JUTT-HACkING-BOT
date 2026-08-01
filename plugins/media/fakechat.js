// AA MD Bot - Pixel-perfect Fake WhatsApp Chat Generator
// Uses sharp + SVG for accurate rendering (colors, bubbles, tails, ticks, UI chrome)

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import { generateId } from '../../lib/helper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP = path.join(__dirname, '../../temp');

// ── WhatsApp exact colors (light theme) ──────────────────────────────────────
const C = {
  statusBg:  '#054C44',   // status bar (darker green)
  headerBg:  '#075E54',   // classic WA header green
  accent:    '#25D366',   // WA bright green (send button, online dot)
  chatBg:    '#ECE5DD',   // chat background
  sentBg:    '#DCF8C6',   // sent bubble (light green)
  recvBg:    '#FFFFFF',   // received bubble (white)
  text:      '#111B21',   // primary message text
  time:      '#667781',   // timestamp grey
  inputBg:   '#F0F0F0',   // input bar background
  inputFld:  '#FFFFFF',   // input field white
  tickBlue:  '#53BDEB',   // read receipt (blue ticks)
  tickGrey:  '#8696A0',   // sent/delivered (grey ticks)
  online:    '#8BA9B0',   // "online" subtitle
  dateBg:    '#E1F2FB',   // date pill bg
  dateText:  '#54656F',   // date pill text
  divider:   '#E9EDEF',   // thin separator
};

// ── Layout constants ──────────────────────────────────────────────────────────
const W        = 390;   // total width (iPhone-like)
const SB_H     = 26;    // status bar height
const HDR_H    = 62;    // header height
const INPUT_H  = 60;    // input bar height
const CHAT_TOP = SB_H + HDR_H;

const BMAX_W   = 265;   // max bubble width
const FONT_SZ  = 14;    // message body font size
const LINE_H   = 20;    // line height
const BPAD_X   = 10;    // bubble horizontal padding
const BPAD_Y   = 7;     // bubble top padding
const BPAD_BOT = 24;    // bubble bottom (room for timestamp)
const BRAD     = 8;     // bubble corner radius
const SIDE_PAD = 12;    // distance from screen edge to bubble
const TAIL_W   = 8;     // tail horizontal protrusion
const TAIL_H   = 10;    // tail height

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Approximate pixel width for "Liberation Sans" / Arial at various sizes
const CW = { 10: 5.5, 11: 6.1, 12: 6.7, 13: 7.2, 14: 7.8, 16: 8.9 };
const tw = (str, sz = FONT_SZ) => String(str).length * (CW[sz] ?? sz * 0.56);

function wrap(text, maxW, sz = FONT_SZ) {
  const maxChars = Math.floor(maxW / (CW[sz] ?? sz * 0.56));
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!w) continue;
    const cand = cur ? `${cur} ${w}` : w;
    if (cand.length > maxChars) {
      if (cur) lines.push(cur);
      if (w.length > maxChars) {
        let r = w;
        while (r.length > maxChars) { lines.push(r.slice(0, maxChars)); r = r.slice(maxChars); }
        cur = r;
      } else {
        cur = w;
      }
    } else {
      cur = cand;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

// Deterministic avatar color from contact name
function avatarColor(name) {
  const palette = [
    '#AB47BC','#26A69A','#EC407A','#FF7043','#7E57C2',
    '#42A5F5','#26C6DA','#FFA726','#66BB6A','#EF5350',
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xFFFF;
  return palette[h % palette.length];
}

// Messages at progressively earlier times so last msg = "now"
function buildTimes(count) {
  const base = new Date();
  const times = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(base.getTime() - i * 90000); // ~1.5 min apart
    times.push(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`);
  }
  return times;
}

// ── SVG tail paths — WhatsApp-authentic pointed style ─────────────────────────
// Sent: pointed tail at bottom-right
function sentTail(bx, by, bw, bh, color) {
  const x1 = bx + bw;           // right edge of bubble
  const y1 = by + bh - TAIL_H;  // tail start (upper anchor on bubble edge)
  const x2 = bx + bw + TAIL_W;  // tip of tail
  const y2 = by + bh;           // bottom of bubble
  // Straight-line triangle that merges cleanly with the rounded bubble corner
  return `<path d="M${x1},${y1} L${x2},${y2} L${x1},${y2}Z" fill="${color}"/>`;
}
// Received: pointed tail at bottom-left
function recvTail(bx, by, bh, color) {
  const x1 = bx;                // left edge of bubble
  const y1 = by + bh - TAIL_H;  // tail start
  const x2 = bx - TAIL_W;       // tip of tail
  const y2 = by + bh;           // bottom
  return `<path d="M${x1},${y1} L${x2},${y2} L${x1},${y2}Z" fill="${color}"/>`;
}

// ── Double-tick SVG ───────────────────────────────────────────────────────────
// Draws two overlapping check marks at (x, y); color = blue or grey
function ticks(x, y, color) {
  // First tick
  const t1 = `<polyline points="${x},${y} ${x + 4},${y + 4} ${x + 9},${y - 3}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  // Second tick (offset 3px right)
  const t2 = `<polyline points="${x + 3},${y} ${x + 7},${y + 4} ${x + 12},${y - 3}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  return t1 + t2;
}

// Current time for status bar
function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// ── Build complete SVG ────────────────────────────────────────────────────────
function buildSVG(contactName, messages, readAll, statusText) {
  const times = buildTimes(messages.length);

  // ── Pre-compute bubble dimensions ────────────────────────────────────────
  const textMaxW = BMAX_W - BPAD_X * 2 - 4;
  const bubbles = messages.map((m, i) => {
    const isSent  = m.who === 'me';
    const isFirst = i === 0 || messages[i - 1].who !== m.who;
    const lines   = wrap(m.text, textMaxW);
    const lastW   = tw(lines[lines.length - 1]);
    const timeW   = tw(times[i], 11) + (isSent ? 22 : 4); // space for ticks
    const timeFits = (lastW + timeW + 10) <= textMaxW;
    const rows     = lines.length + (timeFits ? 0 : 1);
    const bW = Math.min(BMAX_W, Math.max(...lines.map(l => tw(l)), timeW) + BPAD_X * 2 + 6);
    const bH = BPAD_Y + rows * LINE_H + BPAD_BOT;
    return { m, isSent, isFirst, lines, bW, bH, time: times[i], timeFits };
  });

  // ── Total height ──────────────────────────────────────────────────────────
  let contentH = 16; // top padding
  contentH += 32;    // date separator
  for (const b of bubbles) contentH += (b.isFirst ? 10 : 3) + b.bH;
  contentH += 16;    // bottom padding
  const totalH = SB_H + HDR_H + contentH + INPUT_H;

  const sbTime = nowTime();

  // ── Start SVG ─────────────────────────────────────────────────────────────
  let S = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${totalH}">`;
  S += `<defs>`;
  // WhatsApp chat background pattern — tiny repeating diamonds
  S += `<pattern id="waBg" x="0" y="0" width="22" height="22" patternUnits="userSpaceOnUse">`;
  S += `<rect width="22" height="22" fill="${C.chatBg}"/>`;
  S += `<path d="M11,2 L20,11 L11,20 L2,11 Z" fill="none" stroke="#D7CFC7" stroke-width="0.6" opacity="0.55"/>`;
  S += `</pattern>`;
  S += `</defs>`;

  // Chat background with wallpaper pattern
  S += `<rect width="${W}" height="${totalH}" fill="url(#waBg)"/>`;

  // ── Status bar ────────────────────────────────────────────────────────────
  S += `<rect x="0" y="0" width="${W}" height="${SB_H}" fill="${C.statusBg}"/>`;
  S += `<text x="14" y="18" font-family="Arial,Liberation Sans,sans-serif" font-size="12" font-weight="bold" fill="white">${esc(sbTime)}</text>`;
  // WiFi icon
  S += `<path d="M${W-54},${13} Q${W-50},${9} ${W-46},${13}" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" opacity="0.6"/>`;
  S += `<path d="M${W-57},${10} Q${W-50},${4} ${W-43},${10}" fill="none" stroke="white" stroke-width="1.4" stroke-linecap="round" opacity="0.8"/>`;
  S += `<circle cx="${W-50}" cy="${15}" r="1.5" fill="white"/>`;
  // Signal bars
  S += `<rect x="${W - 38}" y="9" width="3" height="9" rx="1" fill="white" opacity="0.5"/>`;
  S += `<rect x="${W - 33}" y="7" width="3" height="11" rx="1" fill="white" opacity="0.7"/>`;
  S += `<rect x="${W - 28}" y="5" width="3" height="13" rx="1" fill="white"/>`;
  // Battery
  S += `<rect x="${W - 22}" y="7" width="16" height="10" rx="2" fill="none" stroke="white" stroke-width="1.4"/>`;
  S += `<rect x="${W - 7}" y="10" width="2" height="4" rx="0.5" fill="white"/>`;
  S += `<rect x="${W - 21}" y="8" width="13" height="8" rx="1" fill="white"/>`;

  // ── Header ────────────────────────────────────────────────────────────────
  const hY = SB_H;
  S += `<rect x="0" y="${hY}" width="${W}" height="${HDR_H}" fill="${C.headerBg}"/>`;
  // subtle bottom shadow on header
  S += `<rect x="0" y="${hY + HDR_H - 1}" width="${W}" height="1" fill="rgba(0,0,0,0.15)"/>`;

  // Back chevron + unread badge
  S += `<polyline points="26,${hY + 20} 17,${hY + 31} 26,${hY + 42}" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;

  // Avatar circle
  const avCX = 58, avCY = hY + HDR_H / 2;
  const avColor = avatarColor(contactName);
  S += `<circle cx="${avCX}" cy="${avCY}" r="21" fill="${avColor}"/>`;
  S += `<text x="${avCX}" y="${avCY + 7}" font-family="Arial,Liberation Sans,sans-serif" font-size="18" font-weight="bold" fill="white" text-anchor="middle">${esc(contactName.charAt(0).toUpperCase())}</text>`;

  // Contact name
  S += `<text x="88" y="${hY + 30}" font-family="Arial,Liberation Sans,sans-serif" font-size="15.5" font-weight="bold" fill="white">${esc(contactName)}</text>`;
  // Status subtitle
  const subLabel = statusText || 'online';
  S += `<text x="88" y="${hY + 48}" font-family="Arial,Liberation Sans,sans-serif" font-size="12" fill="${C.online}">${esc(subLabel)}</text>`;

  // Right icons: video call, phone call, menu dots
  // Video icon
  S += `<rect x="${W - 112}" y="${hY + 22}" width="15" height="11" rx="2" fill="none" stroke="white" stroke-width="1.7"/>`;
  S += `<polyline points="${W - 97},${hY + 25} ${W - 92},${hY + 22} ${W - 92},${hY + 34} ${W - 97},${hY + 31}" fill="white"/>`;
  // Phone icon (simple circle-based)
  S += `<text x="${W - 74}" y="${hY + 41}" font-family="Arial,sans-serif" font-size="18" fill="white">📞</text>`;
  // Three dots (menu)
  const mx = W - 18;
  S += `<circle cx="${mx}" cy="${hY + 23}" r="2" fill="white"/>`;
  S += `<circle cx="${mx}" cy="${hY + 31}" r="2" fill="white"/>`;
  S += `<circle cx="${mx}" cy="${hY + 39}" r="2" fill="white"/>`;

  // ── Date separator ────────────────────────────────────────────────────────
  const dateY = CHAT_TOP + 10;
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  S += `<rect x="${(W - 80) / 2}" y="${dateY}" width="80" height="20" rx="10" fill="${C.dateBg}" opacity="0.92"/>`;
  S += `<text x="${W / 2}" y="${dateY + 14}" font-family="Arial,Liberation Sans,sans-serif" font-size="11" fill="${C.dateText}" text-anchor="middle">${esc(today)}</text>`;

  // ── Messages ──────────────────────────────────────────────────────────────
  let msgY = CHAT_TOP + 46;

  for (const { m, isSent, isFirst, lines, bW, bH, time, timeFits } of bubbles) {
    msgY += isFirst ? 10 : 3;

    const bx = isSent
      ? W - SIDE_PAD - bW - (isFirst ? TAIL_W : 0)
      : SIDE_PAD + (isFirst ? TAIL_W : 0);
    const bg = isSent ? C.sentBg : C.recvBg;

    // Tail
    if (isFirst) {
      S += isSent
        ? sentTail(bx, msgY, bW, bH, bg)
        : recvTail(bx, msgY, bH, bg);
    }

    // Bubble body
    S += `<rect x="${bx}" y="${msgY}" width="${bW}" height="${bH}" rx="${BRAD}" fill="${bg}"/>`;

    // Text lines
    let ty = msgY + BPAD_Y + FONT_SZ;
    for (const line of lines) {
      S += `<text x="${bx + BPAD_X}" y="${ty}" font-family="Liberation Sans,Arial,sans-serif" font-size="${FONT_SZ}" fill="${C.text}">${esc(line)}</text>`;
      ty += LINE_H;
    }

    // Timestamp row (bottom right of bubble)
    const timeX = bx + bW - BPAD_X;
    const timeY = msgY + bH - 7;

    if (isSent) {
      // Draw ticks first (to the left of timestamp)
      const tickX = timeX - 14;
      const tickColor = (m.read || readAll) ? C.tickBlue : C.tickGrey;
      S += ticks(tickX - 12, timeY - 2, tickColor);
      // Timestamp to left of ticks
      S += `<text x="${tickX - 16}" y="${timeY}" font-family="Liberation Sans,Arial,sans-serif" font-size="11" fill="${C.time}" text-anchor="end">${esc(time)}</text>`;
    } else {
      // Received: just timestamp
      S += `<text x="${timeX}" y="${timeY}" font-family="Liberation Sans,Arial,sans-serif" font-size="11" fill="${C.time}" text-anchor="end">${esc(time)}</text>`;
    }

    msgY += bH;
  }

  // ── Input bar ─────────────────────────────────────────────────────────────
  const inputTop = totalH - INPUT_H;

  // Thin divider above input
  S += `<rect x="0" y="${inputTop}" width="${W}" height="1" fill="${C.divider}"/>`;
  S += `<rect x="0" y="${inputTop}" width="${W}" height="${INPUT_H}" fill="${C.inputBg}"/>`;

  // Emoji button (circle + smiley)
  S += `<circle cx="24" cy="${inputTop + 30}" r="12" fill="none" stroke="${C.time}" stroke-width="1.5"/>`;
  S += `<circle cx="20" cy="${inputTop + 28}" r="1.5" fill="${C.time}"/>`;
  S += `<circle cx="28" cy="${inputTop + 28}" r="1.5" fill="${C.time}"/>`;
  S += `<path d="M20,${inputTop + 33} Q24,${inputTop + 37} 28,${inputTop + 33}" fill="none" stroke="${C.time}" stroke-width="1.5" stroke-linecap="round"/>`;

  // Input field (rounded white pill)
  const ifX = 46, ifY = inputTop + 10, ifW = W - 118, ifH = 40;
  S += `<rect x="${ifX}" y="${ifY}" width="${ifW}" height="${ifH}" rx="20" fill="${C.inputFld}"/>`;
  S += `<text x="${ifX + 16}" y="${inputTop + 35}" font-family="Liberation Sans,Arial,sans-serif" font-size="14" fill="#AEBAC1">Message</text>`;

  // Attachment icon (paperclip — simplified)
  const clipX = W - 66, clipY = inputTop + 18;
  S += `<path d="M${clipX},${clipY + 16} C${clipX - 6},${clipY + 10} ${clipX - 6},${clipY + 2} ${clipX},${clipY - 2} C${clipX + 6},${clipY - 6} ${clipX + 13},${clipY - 4} ${clipX + 14},${clipY + 4} L${clipX + 14},${clipY + 22} C${clipX + 14},${clipY + 27} ${clipX + 8},${clipY + 27} ${clipX + 8},${clipY + 22} L${clipX + 8},${clipY + 8}" fill="none" stroke="${C.time}" stroke-width="1.8" stroke-linecap="round"/>`;

  // Camera icon
  const camX = W - 42, camY = inputTop + 20;
  S += `<rect x="${camX}" y="${camY}" width="18" height="14" rx="3" fill="none" stroke="${C.time}" stroke-width="1.8"/>`;
  S += `<circle cx="${camX + 9}" cy="${camY + 7}" r="4" fill="none" stroke="${C.time}" stroke-width="1.5"/>`;
  S += `<polyline points="${camX + 5},${camY} ${camX + 7},${camY - 3} ${camX + 11},${camY - 3} ${camX + 13},${camY}" fill="none" stroke="${C.time}" stroke-width="1.5"/>`;

  // Mic / Send button (green circle)
  S += `<circle cx="${W - 14}" cy="${inputTop + 30}" r="20" fill="${C.accent}"/>`;
  // Mic icon (white)
  S += `<rect x="${W - 19}" y="${inputTop + 20}" width="10" height="14" rx="5" fill="white"/>`;
  S += `<path d="M${W - 22},${inputTop + 32} Q${W - 22},${inputTop + 40} ${W - 14},${inputTop + 40} Q${W - 6},${inputTop + 40} ${W - 6},${inputTop + 32}" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round"/>`;
  S += `<line x1="${W - 14}" y1="${inputTop + 40}" x2="${W - 14}" y2="${inputTop + 44}" stroke="white" stroke-width="1.8" stroke-linecap="round"/>`;
  S += `<line x1="${W - 17}" y1="${inputTop + 44}" x2="${W - 11}" y2="${inputTop + 44}" stroke="white" stroke-width="1.8" stroke-linecap="round"/>`;

  S += `</svg>`;
  return S;
}

// ── Plugin export ─────────────────────────────────────────────────────────────
export default {
  command: 'fakechat',
  alias: ['fc', 'fakewa', 'fakemsg', 'fakewhatsapp'],
  description: 'Generate a pixel-perfect fake WhatsApp chat screenshot',
  category: 'media',

  async execute({ sock, jid, msg, reply, react, text, prefix }) {
    if (!text) return reply(
      `💬 *Fake WhatsApp Chat*\n\n` +
      `*Format:*\n` +
      `\`${prefix}fakechat Name | them:msg | me:msg\`\n\n` +
      `*Keywords:*\n` +
      `▸ \`them:\` or \`they:\` — their message (left, white bubble)\n` +
      `▸ \`me:\` — your message (right, green bubble)\n` +
      `▸ \`status:online\` — contact status (default: online)\n` +
      `▸ \`status:typing...\` — shows typing status\n` +
      `▸ \`status:last seen today\` — last seen text\n` +
      `▸ Add \`| read\` anywhere → blue double ticks\n\n` +
      `*Example:*\n` +
      `\`${prefix}fakechat Ahmed | them:Assalamualaikum | me:Walikumsalam! | them:Kya haal ha? | me:Alhamdulillah | read | status:online\`\n\n` +
      `> 🤖 *AA MD Bot*`
    );

    const parts = text.split('|').map(s => s.trim()).filter(Boolean);
    if (parts.length < 2) return reply(
      `❌ *At least one message required.*\n*Format:* \`${prefix}fakechat Name | them:msg | me:reply\`\n\n> 🤖 *AA MD Bot*`
    );

    const contactName = parts[0];
    if (!contactName) return reply(`❌ Contact name required.\n\n> 🤖 *AA MD Bot*`);

    let readAll = false;
    let statusText = null;
    const messages = [];

    for (const p of parts.slice(1)) {
      const lp = p.toLowerCase();
      if (lp === 'read') { readAll = true; continue; }
      if (lp.startsWith('status:')) { statusText = p.slice(7).trim(); continue; }
      if (lp.startsWith('me:'))           messages.push({ who: 'me',   text: p.slice(3).trim(), read: false });
      else if (lp.startsWith('them:'))    messages.push({ who: 'them', text: p.slice(5).trim() });
      else if (lp.startsWith('they:'))    messages.push({ who: 'them', text: p.slice(5).trim() });
      else                                messages.push({ who: 'them', text: p });
    }

    const finalMsgs = messages.filter(m => m.text);
    if (!finalMsgs.length) return reply(`❌ No valid messages found.\n\n> 🤖 *AA MD Bot*`);
    if (finalMsgs.length > 20) return reply(`❌ Max 20 messages.\n\n> 🤖 *AA MD Bot*`);

    await react('⏳');
    fs.ensureDirSync(TEMP);

    try {
      const svg = buildSVG(contactName, finalMsgs, readAll, statusText);

      // PNG renders SVG text/lines much crisper than JPEG
      const buf = await sharp(Buffer.from(svg), { density: 144 })
        .png({ compressionLevel: 7 })
        .toBuffer();

      await sock.sendMessage(jid, {
        image: buf,
        caption: `💬 *${contactName}*\n\n> 🤖 *AA MD Bot*`,
        mimetype: 'image/png',
      }, { quoted: msg });

      await react('✅');
    } catch (err) {
      await react('❌');
      reply(`❌ *Error:* ${err.message}\n\n> 🤖 *AA MD Bot*`);
    }
  },
};
