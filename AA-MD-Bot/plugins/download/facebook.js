// ============================================
// AA MD Bot - Facebook Downloader
// Method 1: Direct HTML scrape (public videos)
// Method 2: snapsave API
// Method 3: yt-dlp (last resort)
// ============================================

import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { YTDLP, getCookiesArgs } from '../../lib/ytdlp.js';

const execFileP  = promisify(execFile);
const FB_RX      = /https?:\/\/(www\.|m\.|web\.)?facebook\.com\/[^\s]+|https?:\/\/fb\.watch\/[^\s]+/i;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// ── Method 1: scrape FB page directly (works for public posts) ────────────────
async function scrapeFbPage(url) {
  // Normalize to desktop URL
  const desktop = url.replace(/m\.facebook\.com/, 'www.facebook.com')
                     .replace(/web\.facebook\.com/, 'www.facebook.com');

  const { data: html } = await axios.get(desktop, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml',
      'Sec-Fetch-Mode': 'navigate',
    },
    timeout: 20000,
    maxRedirects: 5,
  });

  // Extract SD / HD video sources from page JSON
  const unescape = (s) => s
    .replace(/\\u0026/g, '&')
    .replace(/\\u0025/g, '%')
    .replace(/\\\//g, '/')
    .replace(/\\"/g, '"');

  const patterns = [
    /"hd_src":"([^"]+)"/,
    /"sd_src":"([^"]+)"/,
    /"browser_native_hd_url":"([^"]+)"/,
    /"browser_native_sd_url":"([^"]+)"/,
    /\"playable_url_quality_hd\":\"([^"]+)\"/,
    /\"playable_url\":\"([^"]+)\"/,
  ];

  for (const rx of patterns) {
    const m = html.match(rx);
    if (m?.[1]) {
      const link = unescape(m[1]);
      if (link.startsWith('http')) return link;
    }
  }
  throw new Error('No video URL found in page (post may be private or stories)');
}

// ── Method 2: snapsave API ────────────────────────────────────────────────────
async function snapsaveFb(url) {
  const form = `URLz=${encodeURIComponent(url)}`;
  const { data } = await axios.post('https://snapsave.app/action.php', form, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Referer': 'https://snapsave.app/',
      'Origin': 'https://snapsave.app',
      'User-Agent': UA,
    },
    timeout: 20000,
  });
  const match = (typeof data === 'string' ? data : JSON.stringify(data))
    .match(/https:\/\/[^\s"'<>]+\.mp4[^\s"'<>]*/i);
  if (!match) throw new Error('snapsave: no video URL');
  return match[0].replace(/&amp;/g, '&');
}

// ── Method 3: yt-dlp (supports some FB URLs when logged in) ──────────────────
async function ytdlpFb(url) {
  const args = [
    url,
    '-f', 'best[ext=mp4][height<=480]/best[ext=mp4]/best',
    '--get-url',
    '--no-playlist',
    '--no-warnings',
    '--socket-timeout', '20',
    ...getCookiesArgs(),
  ];
  const { stdout } = await execFileP(YTDLP, args, { timeout: 40000 });
  const link = stdout.trim().split('\n')[0];
  if (!link?.startsWith('http')) throw new Error('yt-dlp: no URL');
  return link;
}

export default {
  command: 'fb',
  alias: ['facebook', 'fbdl', 'fbvideo'],
  description: 'Download Facebook videos and reels',
  category: 'download',

  async execute({ text, msg, reply, react, sock, jid, prefix }) {
    let url = text?.trim();
    if (!url) {
      const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (q) url = (q.conversation || q.extendedTextMessage?.text || '').trim();
    }
    const match = url?.match(FB_RX);
    if (!match) return reply(
      `📘 *Facebook Downloader*\n\n` +
      `*Usage:* ${prefix}fb <link>\n` +
      `*Supports:* Public Videos • Reels\n\n` +
      `*Example:*\n` +
      `${prefix}fb https://www.facebook.com/watch?v=xxx\n` +
      `${prefix}fb https://fb.watch/xxx\n\n` +
      `> 📘 *AA MD Bot*`
    );

    await react('⏳');
    url = match[0].replace(/[.,!?;]$/, '');

    const cap = `📘 *Facebook*\n\n> 🤖 *AA MD Bot*`;
    const send = (videoUrl) => sock.sendMessage(jid,
      { video: { url: videoUrl }, mimetype: 'video/mp4', caption: cap },
      { quoted: msg }
    );

    // Try all methods in sequence
    for (const [name, fn] of [
      ['scrape', () => scrapeFbPage(url).then(send)],
      ['snapsave', () => snapsaveFb(url).then(send)],
      ['yt-dlp', () => ytdlpFb(url).then(send)],
    ]) {
      try {
        await fn();
        return react('✅');
      } catch {}
    }

    await react('❌');
    reply(
      `❌ *Facebook download failed*\n\n` +
      `Make sure the post is *public*.\n` +
      `Private posts, stories, and reels with restricted sharing cannot be downloaded.\n\n` +
      `> 📘 *AA MD Bot*`
    );
  },
};
