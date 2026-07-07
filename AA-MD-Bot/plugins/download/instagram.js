// ============================================
// AA MD Bot - Instagram Downloader
// Primary: yt-dlp → fallback: faa API
// ============================================

import axios from 'axios';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { YTDLP, YTDLP_FLAGS, getCookiesFlag } from '../../lib/ytdlp.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP = path.join(__dirname, '../../temp');

const api = axios.create({ timeout: 25000 });
const IG_RX = /https?:\/\/(www\.)?instagram\.com\/[^\s]+/i;

// ── yt-dlp: download IG post / reel → buffer ─────────────────────────────────
async function ytdlpIG(url) {
  await fs.ensureDir(TEMP);
  // Use a unique request-scoped prefix so concurrent downloads never mix files
  const reqId = `ig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const outTpl = path.join(TEMP, `${reqId}_%(autonumber)03d.%(ext)s`);

  const args = [
    YTDLP,
    ...YTDLP_FLAGS.split(' ').filter(Boolean),
    url,
    '-f', 'best[height<=720][ext=mp4]/best[height<=720]/best[ext=mp4]/best',
    '--merge-output-format', 'mp4',
    '--no-playlist',
    '-o', outTpl,
    '--quiet',
    '--no-warnings',
  ];
  // Attach cookies if available (split the flag properly)
  const ckFlag = getCookiesFlag();
  if (ckFlag) {
    const parts = ckFlag.trim().split(/\s+/);
    args.push(...parts);
  }

  try {
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execFile);
    await execFileAsync(args[0], args.slice(1), { timeout: 120000 });
  } catch {
    // yt-dlp may exit non-zero but still produce files — continue to collect
  }

  // Collect only this request's files using the exact reqId prefix
  const dir = TEMP;
  const ownFiles = (await fs.readdir(dir).catch(() => []))
    .filter(f => f.startsWith(reqId) && (f.endsWith('.mp4') || f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.webp')))
    .map(f => path.join(dir, f));

  const results = [];
  for (const f of ownFiles) {
    try {
      const buf = await fs.readFile(f);
      if (buf?.length > 10000) {
        results.push({ buf, isVid: f.endsWith('.mp4') });
      }
    } catch {}
    await fs.remove(f).catch(() => {}); // always clean up own files
  }
  return results.length ? results : null;
}

// ── Fallback: faa API ─────────────────────────────────────────────────────────
async function faaIG(url) {
  const { data } = await api.get(`https://api-faa.my.id/faa/igdl?url=${encodeURIComponent(url)}`);
  if (!data.status) throw new Error(data.message || 'Instagram API error');
  return data.result;
}

export default {
  command: 'ig',
  alias: ['insta', 'instagram', 'igdl', 'reel'],
  description: 'Download Instagram posts, reels, carousels',
  category: 'download',

  async execute({ text, msg, reply, react, sock, jid, prefix }) {
    let url = text?.trim();
    if (!url) {
      const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (q) url = (q.conversation || q.extendedTextMessage?.text || '').trim();
    }
    const match = url?.match(IG_RX);
    if (!match) return reply(
      `📸 *Instagram Downloader*\n\n` +
      `*Usage:* ${prefix}ig <link>\n` +
      `*Supports:* Posts • Reels • Carousels\n\n` +
      `*Example:* ${prefix}ig https://www.instagram.com/p/xxx\n\n` +
      `> 📸 *AA MD Bot*`
    );

    await react('⏳');
    url = match[0].replace(/[.,!?;]$/, '');

    try {
      // Primary: yt-dlp
      const items = await ytdlpIG(url);
      if (items?.length) {
        for (const { buf, isVid } of items.slice(0, 6)) {
          await sock.sendMessage(jid, isVid
            ? { video: buf, mimetype: 'video/mp4', caption: '📸 *Instagram via AA MD Bot*' }
            : { image: buf, caption: '📸 *Instagram via AA MD Bot*' }, { quoted: msg });
        }
        await react('✅');
        return;
      }
    } catch {}

    // Fallback: faa API
    try {
      const r = await faaIG(url);
      const urls = r?.url || [];
      if (!urls.length) throw new Error('No media found');
      for (const link of urls.slice(0, 6)) {
        await sock.sendMessage(jid, r.metadata?.isVideo
          ? { video: { url: link }, mimetype: 'video/mp4', caption: '📸 *Instagram via AA MD Bot*' }
          : { image: { url: link }, caption: '📸 *Instagram via AA MD Bot*' }, { quoted: msg });
      }
      await react('✅');
    } catch (e2) {
      await react('❌');
      reply(`❌ *Instagram download failed*\n\n${e2.message}\n\n💡 Make sure the post is *public* and the link is correct.\n\n> 📸 *AA MD Bot*`);
    }
  },
};
