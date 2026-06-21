import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateId, getBuffer } from '../../lib/helper.js';
import { YTDLP, getCookiesFlag } from '../../lib/ytdlp.js';

const execAsync  = promisify(exec);
const __dirname  = path.dirname(fileURLToPath(import.meta.url));

const BRAND =
  `\n> 🌐 https://aa-mods.vercel.app/\n` +
  `> 🤖 *Powered by AA MD Bot*\n` +
  `> 👨‍💻 *Developed by Ahsan Ali Wadani*`;

function fmtViews(v) {
  if (!v) return '—';
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return String(v);
}

async function ytSearch(query) {
  try {
    const playdl  = (await import('play-dl')).default;
    const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 });
    if (results.length) return results[0];
  } catch {}
  return null;
}

async function scDownload(ytdlp, query, outFile) {
  // SoundCloud — no cookies needed; try SoundCloud first then YouTube with cookies
  const ckf = getCookiesFlag();
  const cmds = [
    // SoundCloud (no bot detection issues)
    `"${ytdlp}" "scsearch1:${query}" -x --audio-format mp3 --audio-quality 128K --no-playlist -o "${outFile}" --quiet --no-warnings`,
    // YouTube with cookies + android client
    `"${ytdlp}" "ytsearch1:${query}" ${ckf} -x --audio-format mp3 --audio-quality 128K --extractor-args "youtube:player_client=android" --no-playlist -o "${outFile}" --quiet --no-warnings --no-check-certificate`,
    // YouTube tv_embedded fallback
    `"${ytdlp}" "ytsearch1:${query}" ${ckf} -x --audio-format mp3 --audio-quality 128K --extractor-args "youtube:player_client=tv_embedded" --no-playlist -o "${outFile}" --quiet --no-warnings --no-check-certificate`,
  ];
  for (const cmd of cmds) {
    try {
      await execAsync(cmd, { timeout: 120000 });
      if (fs.existsSync(outFile)) return true;
    } catch {}
  }
  return false;
}

async function scDumpJson(ytdlp, query) {
  const ckf = getCookiesFlag();
  try {
    const { stdout } = await execAsync(
      `"${ytdlp}" "scsearch1:${query}" --dump-json --no-playlist --no-download --quiet --no-warnings`,
      { timeout: 20000 }
    );
    const lines = stdout.trim().split('\n').filter(l => l.startsWith('{'));
    if (lines.length) return JSON.parse(lines[0]);
  } catch {}
  // fallback: YouTube metadata
  try {
    const { stdout } = await execAsync(
      `"${ytdlp}" "ytsearch1:${query}" ${ckf} --dump-json --no-playlist --no-download --quiet --no-warnings`,
      { timeout: 20000 }
    );
    const lines = stdout.trim().split('\n').filter(l => l.startsWith('{'));
    if (lines.length) return JSON.parse(lines[0]);
  } catch {}
  return null;
}

export default {
  command : 'song',
  alias   : ['play', 'audio', 'music', 'mp3', 'yta'],
  category: 'download',
  description: 'Download audio (YouTube metadata + SoundCloud audio)',
  usage   : '.song <song name>',

  execute: async ({ reply, react, sock, jid, msg, text }) => {
    if (!text) return reply(
      '🎵 *AA MD Bot — Song Downloader*\n\n' +
      'Usage: `.song <song name>`\n\nExamples:\n' +
      '• `.play Faded Alan Walker`\n' +
      '• `.song Nadeem Sarwar Abbas Jo Zinda Hai`\n' +
      '• `.music Shape of You Ed Sheeran`'
    );

    await react('⏳');

    const shortQ = text.length > 35 ? text.slice(0, 35) + '...' : text;
    await sock.sendMessage(jid, {
      text:
        `🔎 *Searching:* ${shortQ}\n` +
        `> 🤖 *Powered by AA MD Bot*\n` +
        `> 👨‍💻 *Developed by Ahsan Ali Wadani*`
    }, { quoted: msg });

    const tempDir = path.join(__dirname, '../../temp');
    await fs.ensureDir(tempDir);
    const uid     = generateId();
    const outFile = path.join(tempDir, `${uid}.mp3`);

    try {
      const ytdlp = YTDLP;

      // ── Step 1: Get YouTube metadata for thumbnail & info ─────────────────
      let title    = text;
      let duration = 0;
      let uploader = 'Unknown';
      let views    = '—';
      let thumbUrl = '';
      let ytUrl    = '';

      const ytInfo = await ytSearch(text);
      if (ytInfo) {
        title    = ytInfo.title    || text;
        duration = ytInfo.durationInSec || 0;
        uploader = ytInfo.channel?.name || 'Unknown';
        views    = fmtViews(ytInfo.views);
        thumbUrl = ytInfo.thumbnails?.[ytInfo.thumbnails.length - 1]?.url || '';
        ytUrl    = ytInfo.url || '';
      }

      // Duration guard
      if (duration > 900) {
        await react('❌');
        const m = Math.floor(duration / 60), s = String(duration % 60).padStart(2, '0');
        return reply(`❌ Too long (${m}:${s}). Max 15 minutes.`);
      }

      const mins = Math.floor(duration / 60);
      const secs = String(duration % 60).padStart(2, '0');

      let thumbBuf = null;
      if (thumbUrl) { try { thumbBuf = await getBuffer(thumbUrl); } catch {} }

      const infoCaption =
        `✦✦✦✦✦✦✦✦✦✦\n` +
        `🎵 *AA MD Bot* MUSIC\n` +
        `✦✦✦✦✦✦✦✦✦✦\n\n` +
        `🎙 *${title}*\n` +
        `🎤 ${uploader}\n` +
        `⏱ ${mins}:${secs} | 👁 ${views} views\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `⏳ _Please wait, downloading audio..._` +
        BRAND;

      if (thumbBuf) {
        await sock.sendMessage(jid, { image: thumbBuf, caption: infoCaption }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: infoCaption }, { quoted: msg });
      }

      // ── Step 2: Download audio from SoundCloud (no bot detection) ─────────
      const scQuery = title || text;
      let downloaded = await scDownload(ytdlp, scQuery, outFile);

      // Fallback: try original query if title changed
      if (!downloaded && title !== text) {
        downloaded = await scDownload(ytdlp, text, outFile);
      }

      // Check if file exists (yt-dlp sometimes changes extension)
      let dlFile = outFile;
      if (!downloaded || !await fs.pathExists(outFile)) {
        const files = await fs.readdir(tempDir);
        const found = files.find(f => f.startsWith(uid));
        if (found) { dlFile = path.join(tempDir, found); downloaded = true; }
      }

      if (!downloaded || !await fs.pathExists(dlFile)) {
        await react('❌');
        return reply(`❌ Download failed.\nTry: \`.song ${text}\` with different keywords.`);
      }

      // If SC gave different metadata, enrich it
      const scInfo = await scDumpJson(ytdlp, scQuery).catch(() => null);
      if (scInfo && !ytInfo) {
        title    = scInfo.title || title;
        duration = Math.floor(scInfo.duration || duration);
        uploader = scInfo.uploader || uploader;
        thumbUrl = scInfo.thumbnail || thumbUrl;
        if (!thumbBuf && thumbUrl) { try { thumbBuf = await getBuffer(thumbUrl); } catch {} }
      }

      const stat    = await fs.stat(dlFile);
      const sizeMB  = (stat.size / 1024 / 1024).toFixed(1);

      await sock.sendMessage(jid, {
        audio: await fs.readFile(dlFile),
        mimetype: 'audio/mpeg',
        fileName: `${title}.mp3`,
        contextInfo: {
          externalAdReply: {
            title,
            body: `${uploader} • ${mins}:${secs} • ${sizeMB}MB`,
            renderLargerThumbnail: true,
            mediaType: 1,
            ...(thumbUrl ? { thumbnailUrl: thumbUrl } : {}),
            ...(thumbBuf ? { thumbnail: thumbBuf } : {}),
            sourceUrl: ytUrl || 'https://aa-mods.vercel.app/',
          },
        },
      }, { quoted: msg });

      await react('✅');
      fs.remove(dlFile).catch(() => {});

    } catch (err) {
      await react('❌');
      reply(`❌ Error: ${err.message?.slice(0, 120) || 'Unknown error'}`);
      fs.remove(outFile).catch(() => {});
    }
  },
};
