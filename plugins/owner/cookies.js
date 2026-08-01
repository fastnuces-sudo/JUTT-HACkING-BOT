import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { COOKIES_PATH } from '../../lib/ytdlp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function downloadBuffer(sock, msg) {
  try {
    const { downloadMediaMessage } = await import('@whiskeysockets/baileys');
    return await downloadMediaMessage(msg, 'buffer', {}, {
      logger: { level: 'silent', ...console },
      reuploadRequest: sock.updateMediaMessage,
    });
  } catch { return null; }
}

function getCookieInfo() {
  try {
    if (!fs.existsSync(COOKIES_PATH)) return null;
    const stat = fs.statSync(COOKIES_PATH);
    const content = fs.readFileSync(COOKIES_PATH, 'utf8');
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const ageMins = Math.floor((Date.now() - stat.mtimeMs) / 60000);
    const ageStr = ageMins < 60
      ? `${ageMins} minutes`
      : ageMins < 1440
        ? `${Math.floor(ageMins / 60)} hours`
        : `${Math.floor(ageMins / 1440)} days`;
    return { size: stat.size, lines: lines.length, ageStr };
  } catch { return null; }
}

export default {
  command: 'cookies',
  alias: ['ytcookies', 'setcookies'],
  category: 'owner',
  description: 'Upload YouTube cookies for bypass',
  superOwnerOnly: true,
  usage: '.cookies | .cookies clear',

  async execute({ reply, react, sock, msg, args, text }) {
    const sub = args[0]?.toLowerCase();

    // ── .cookies clear ─────────────────────────────────────
    if (sub === 'clear' || sub === 'delete' || sub === 'remove') {
      if (fs.existsSync(COOKIES_PATH)) {
        fs.removeSync(COOKIES_PATH);
        await react('🗑️');
        return reply(
          `🗑️ *Cookies Deleted*\n\n` +
          `YouTube cookies have been removed.\n` +
          `Downloads will use standard bypass strategies.\n\n` +
          `> 🤖 *Jutts Bot*\n> 👨‍💻 *Sajid Jutt*`
        );
      }
      return reply('❌ No cookies file found.');
    }

    // ── Check for quoted/replied text with cookie content ───
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText =
      quotedMsg?.conversation ||
      quotedMsg?.extendedTextMessage?.text ||
      quotedMsg?.buttonsResponseMessage?.selectedButtonId ||
      null;

    if (quotedText && quotedText.includes('# Netscape HTTP Cookie File')) {
      fs.writeFileSync(COOKIES_PATH, quotedText, 'utf8');
      await react('✅');
      const info = getCookieInfo();
      return reply(
        `✅ *Cookies Saved!*\n\n` +
        `📦 Entries : *${info?.lines || '?'}*\n` +
        `📁 Size    : *${((info?.size || 0) / 1024).toFixed(1)} KB*\n\n` +
        `All YouTube downloads will now use your cookies.\n\n` +
        `> 🤖 *Jutts Bot*\n> 👨‍💻 *Sajid Jutt*`
      );
    }

    // ── Check for document/file attachment ──────────────────
    const docMsg =
      msg.message?.documentMessage ||
      msg.message?.documentWithCaptionMessage?.message?.documentMessage ||
      quotedMsg?.documentMessage;

    if (docMsg) {
      await react('⏳');
      const buf = await downloadBuffer(sock, docMsg ? { ...msg, message: { documentMessage: docMsg } } : msg);
      if (!buf) return reply('❌ Could not download the file. Try pasting the cookies text instead.');
      const content = buf.toString('utf8');
      if (!content.includes('# Netscape HTTP Cookie File') && !content.includes('\t')) {
        return reply('❌ Invalid cookies file. Must be Netscape cookie format (exported from browser extension).');
      }
      fs.writeFileSync(COOKIES_PATH, content, 'utf8');
      await react('✅');
      const info = getCookieInfo();
      return reply(
        `✅ *Cookies Saved from File!*\n\n` +
        `📦 Entries : *${info?.lines || '?'}*\n` +
        `📁 Size    : *${((info?.size || 0) / 1024).toFixed(1)} KB*\n\n` +
        `All YouTube downloads now use your cookies.\n\n` +
        `> 🤖 *Jutts Bot*\n> 👨‍💻 *Sajid Jutt*`
      );
    }

    // ── Check for pasted text (no reply) ────────────────────
    if (text && text.includes('# Netscape HTTP Cookie File')) {
      fs.writeFileSync(COOKIES_PATH, text.trim(), 'utf8');
      await react('✅');
      const info = getCookieInfo();
      return reply(
        `✅ *Cookies Saved!*\n\n` +
        `📦 Entries : *${info?.lines || '?'}*\n` +
        `📁 Size    : *${((info?.size || 0) / 1024).toFixed(1)} KB*\n\n` +
        `> 🤖 *Jutts Bot*\n> 👨‍💻 *Sajid Jutt*`
      );
    }

    // ── Status view ─────────────────────────────────────────
    const info = getCookieInfo();
    if (!info) {
      return reply(
        `🍪 *YouTube Cookies*\n` +
        `─────────────────────\n` +
        `Status : ❌ *No cookies set*\n\n` +
        `*How to add cookies:*\n\n` +
        `1. Install *"Get cookies.txt LOCALLY"* extension in Chrome/Edge\n` +
        `2. Open *youtube.com* while logged in\n` +
        `3. Click the extension → Export → *Netscape format*\n` +
        `4. Copy all the text\n` +
        `5. Send *.cookies* as a reply to the copied text\n` +
        `   OR attach the *.txt file* to *.cookies*\n\n` +
        `*Commands:*\n` +
        `▸ *.cookies* — Check status\n` +
        `▸ *.cookies clear* — Remove cookies\n\n` +
        `> 🤖 *Jutts Bot*\n> 👨‍💻 *Sajid Jutt*`
      );
    }

    return reply(
      `🍪 *YouTube Cookies*\n` +
      `─────────────────────\n` +
      `Status  : ✅ *Active*\n` +
      `Entries : *${info.lines}* cookie entries\n` +
      `Size    : *${(info.size / 1024).toFixed(1)} KB*\n` +
      `Age     : *${info.ageStr} ago*\n\n` +
      `All YouTube downloads use these cookies.\n` +
      `To update: send *.cookies* as reply to new cookies text.\n` +
      `To remove: *.cookies clear*\n\n` +
      `> 🤖 *Jutts Bot*\n> 👨‍💻 *Sajid Jutt*`
    );
  },
};
