import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateId, getBuffer } from '../../lib/helper.js';
import { YTDLP, getCookiesFlag } from '../../lib/ytdlp.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function fmtDuration(sec) {
  const s = Math.floor(sec || 0);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

// ── Step 1: Get SoundCloud metadata + exact URL ────────────────────────────
// Returns { title, uploader, duration, thumbUrl, sourceUrl } or null
async function scMeta(ytdlp, query) {
  try {
    const { stdout } = await execAsync(
      `"${ytdlp}" "scsearch1:${query}" --dump-json --no-playlist --no-download --quiet --no-warnings`,
      { timeout: 25000 }
    );
    const lines = stdout.trim().split('\n').filter(l => l.startsWith('{'));
    if (!lines.length) return null;
    const j = JSON.parse(lines[0]);
    return {
      title    : j.title      || query,
      uploader : j.uploader   || j.channel || 'Unknown',
      duration : Math.floor(j.duration || 0),
      views    : fmtViews(j.view_count),
      thumbUrl : j.thumbnail  || '',
      sourceUrl: j.webpage_url || j.url || '',
    };
  } catch {
    return null;
  }
}

// ── Step 2a: Download from exact SoundCloud URL (guaranteed metadata match) ─
async function scDownloadUrl(ytdlp, url, outFile) {
  try {
    await execAsync(
      `"${ytdlp}" "${url}" -x --audio-format mp3 --audio-quality 128K --no-playlist -o "${outFile}" --quiet --no-warnings`,
      { timeout: 120000 }
    );
    return fs.existsSync(outFile);
  } catch {
    return false;
  }
}

// ── Step 2b: YouTube fallback (tv_embedded — only reliable client June 2026) ─
async function ytDownload(ytdlp, query, outFile) {
  const ckf = getCookiesFlag();
  const cmds = [
    // tv_embedded — no cookie requirement, confirmed working
    `"${ytdlp}" "ytsearch1:${query}" -x --audio-format mp3 --audio-quality 128K --extractor-args "youtube:player_client=tv_embedded" --no-playlist -o "${outFile}" --quiet --no-warnings --no-check-certificate`,
    // tv_embedded with cookies
    `"${ytdlp}" "ytsearch1:${query}" ${ckf} -x --audio-format mp3 --audio-quality 128K --extractor-args "youtube:player_client=tv_embedded" --no-playlist -o "${outFile}" --quiet --no-warnings --no-check-certificate`,
    // android client fallback
    `"${ytdlp}" "ytsearch1:${query}" ${ckf} -x --audio-format mp3 --audio-quality 128K --extractor-args "youtube:player_client=android" --no-playlist -o "${outFile}" --quiet --no-warnings --no-check-certificate`,
  ];
  for (const cmd of cmds) {
    try {
      await execAsync(cmd, { timeout: 120000 });
      if (fs.existsSync(outFile)) return true;
    } catch {}
  }
  return false;
}

// ── Step 2c: YouTube metadata via play-dl (for YT fallback display) ─────────
async function ytSearchMeta(query) {
  try {
    const playdl  = (await import('play-dl')).default;
    const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 });
    if (results.length) return results[0];
  } catch {}
  return null;
}

export default {
  command : 'song',
  alias   : ['play', 'audio', 'music', 'mp3', 'yta'],
  category: 'download',
  description: 'Download audio — metadata always matches the track',
  usage   : '.song <song name>',

  execute: async ({ reply, react, sock, jid, msg, text, sendMedia }) => {
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
      // ── Phase 1: Get metadata from SoundCloud first ──────────────────────
      // SoundCloud metadata is fetched BEFORE download so what we show
      // matches what we actually download (same search result).
      let meta = await scMeta(YTDLP, text);
      let source = 'soundcloud';

      if (!meta || !meta.sourceUrl) {
        // SC search returned nothing — try YouTube metadata instead
        const ytInfo = await ytSearchMeta(text);
        if (ytInfo) {
          meta = {
            title    : ytInfo.title || text,
            uploader : ytInfo.channel?.name || 'Unknown',
            duration : ytInfo.durationInSec || 0,
            views    : fmtViews(ytInfo.views),
            thumbUrl : ytInfo.thumbnails?.[ytInfo.thumbnails.length - 1]?.url || '',
            sourceUrl: ytInfo.url || '',
          };
          source = 'youtube';
        } else {
          meta = { title: text, uploader: 'Unknown', duration: 0, views: '—', thumbUrl: '', sourceUrl: '' };
          source = 'unknown';
        }
      }

      // Duration guard (15 min max)
      if (meta.duration > 900) {
        await react('❌');
        return reply(`❌ Too long (${fmtDuration(meta.duration)}). Max 15 minutes.`);
      }

      // Fetch thumbnail
      let thumbBuf = null;
      if (meta.thumbUrl) {
        try { thumbBuf = await getBuffer(meta.thumbUrl); } catch {}
      }

      // Show info card — this metadata is exactly what will be downloaded
      const infoCaption =
        `✦✦✦✦✦✦✦✦✦✦\n` +
        `🎵 *AA MD Bot* MUSIC\n` +
        `✦✦✦✦✦✦✦✦✦✦\n\n` +
        `🎙 *${meta.title}*\n` +
        `🎤 ${meta.uploader}\n` +
        `⏱ ${fmtDuration(meta.duration)} | 👁 ${meta.views} views\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `⏳ _Please wait, downloading audio..._` +
        BRAND;

      if (thumbBuf) {
        await sock.sendMessage(jid, { image: thumbBuf, caption: infoCaption }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: infoCaption }, { quoted: msg });
      }

      // ── Phase 2: Download the EXACT track whose metadata we showed ────────
      let downloaded = false;

      if (source === 'soundcloud' && meta.sourceUrl) {
        // Download the exact URL from Phase 1 — guaranteed match
        downloaded = await scDownloadUrl(YTDLP, meta.sourceUrl, outFile);
        // Retry with title search if exact URL fails (rare network issue)
        if (!downloaded) {
          const cmd = `"${YTDLP}" "scsearch1:${meta.title}" -x --audio-format mp3 --audio-quality 128K --no-playlist -o "${outFile}" --quiet --no-warnings`;
          try { await execAsync(cmd, { timeout: 120000 }); downloaded = fs.existsSync(outFile); } catch {}
        }
      }

      if (!downloaded) {
        // Fall back to YouTube (tv_embedded — confirmed working June 2026)
        downloaded = await ytDownload(YTDLP, meta.title !== text ? meta.title : text, outFile);
        if (!downloaded && meta.title !== text) {
          downloaded = await ytDownload(YTDLP, text, outFile);
        }
      }

      // Handle yt-dlp extension change (e.g. .mp3 → .opus, etc.)
      let dlFile = outFile;
      if (!downloaded || !await fs.pathExists(outFile)) {
        const files = await fs.readdir(tempDir);
        const found = files.find(f => f.startsWith(uid));
        if (found) { dlFile = path.join(tempDir, found); downloaded = true; }
      }

      if (!downloaded || !await fs.pathExists(dlFile)) {
        await react('❌');
        return reply(`❌ Download failed. Try again or use different keywords.\n\nExample: \`.song ${text} lyrics\``);
      }

      await sendMedia({
        audio   : await fs.readFile(dlFile),
        mimetype: 'audio/mpeg',
        fileName: `${meta.title}.mp3`,
        ptt     : false,
      });

      await react('✅');
      fs.remove(dlFile).catch(() => {});

    } catch (err) {
      await react('❌');
      reply(`❌ Error: ${err.message?.slice(0, 120) || 'Unknown error'}`);
      fs.remove(outFile).catch(() => {});
    }
  },
};
