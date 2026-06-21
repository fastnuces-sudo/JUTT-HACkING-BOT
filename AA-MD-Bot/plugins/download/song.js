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

// ── Phase 1: YouTube metadata (title, thumbnail, views, channel) ─────────────
// YouTube has the best, most accurate metadata — used for display card only.
async function ytSearchMeta(query) {
  try {
    const playdl  = (await import('play-dl')).default;
    const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 });
    if (results.length) {
      const r = results[0];
      return {
        title   : r.title || query,
        uploader: r.channel?.name || 'Unknown',
        duration: r.durationInSec || 0,
        views   : fmtViews(r.views),
        thumbUrl: r.thumbnails?.[r.thumbnails.length - 1]?.url || '',
        ytUrl   : r.url || '',
      };
    }
  } catch {}
  return null;
}

// ── Phase 2a: SoundCloud download using the exact YouTube title ───────────────
// Using the YouTube title (not user's raw query) means SoundCloud finds the
// same song whose info was shown — matching thumbnail and audio track.
async function scDownloadByTitle(ytdlp, title, outFile) {
  // Dump JSON first to get the exact SC track URL, then download that URL.
  // This 2-step approach is more reliable than a blind scsearch download.
  try {
    const { stdout } = await execAsync(
      `"${ytdlp}" "scsearch1:${title}" --dump-json --no-playlist --no-download --quiet --no-warnings`,
      { timeout: 20000 }
    );
    const lines = stdout.trim().split('\n').filter(l => l.startsWith('{'));
    if (lines.length) {
      const j = JSON.parse(lines[0]);
      const scUrl = j.webpage_url || j.url;
      if (scUrl) {
        await execAsync(
          `"${ytdlp}" "${scUrl}" -x --audio-format mp3 --audio-quality 128K --no-playlist -o "${outFile}" --quiet --no-warnings`,
          { timeout: 120000 }
        );
        if (fs.existsSync(outFile)) return true;
      }
    }
  } catch {}

  // Fallback: direct scsearch download (no separate meta step)
  try {
    await execAsync(
      `"${ytdlp}" "scsearch1:${title}" -x --audio-format mp3 --audio-quality 128K --no-playlist -o "${outFile}" --quiet --no-warnings`,
      { timeout: 120000 }
    );
    return fs.existsSync(outFile);
  } catch {
    return false;
  }
}

// ── Phase 2b: YouTube audio download (best for very new / rare songs) ─────────
// tv_embedded is the only reliable yt-dlp client as of June 2026.
// Falls back to android → ios if tv_embedded fails.
async function ytAudioDownload(ytdlp, query, ytUrl, outFile) {
  const ckf = getCookiesFlag();
  // Prefer direct URL if we have it (avoids search ambiguity for latest songs)
  const src = ytUrl || `ytsearch1:${query}`;
  const arg = ytUrl ? `"${ytUrl}"` : `"ytsearch1:${query}"`;

  const cmds = [
    // ① tv_embedded — confirmed working, no cookies needed
    `"${ytdlp}" ${arg} --extractor-args "youtube:player_client=tv_embedded" -x --audio-format mp3 --audio-quality 0 --no-playlist -o "${outFile}" --quiet --no-warnings --no-check-certificate`,
    // ② tv_embedded + cookies
    `"${ytdlp}" ${arg} ${ckf} --extractor-args "youtube:player_client=tv_embedded" -x --audio-format mp3 --audio-quality 0 --no-playlist -o "${outFile}" --quiet --no-warnings --no-check-certificate`,
    // ③ android client
    `"${ytdlp}" ${arg} ${ckf} --extractor-args "youtube:player_client=android" -x --audio-format mp3 --audio-quality 0 --no-playlist -o "${outFile}" --quiet --no-warnings --no-check-certificate`,
    // ④ ios client — sometimes works when android is blocked
    `"${ytdlp}" ${arg} ${ckf} --extractor-args "youtube:player_client=ios" -x --audio-format mp3 --audio-quality 0 --no-playlist -o "${outFile}" --quiet --no-warnings --no-check-certificate`,
  ];

  for (const cmd of cmds) {
    try {
      await execAsync(cmd, { timeout: 150000 });
      if (fs.existsSync(outFile)) return true;
    } catch {}
  }
  return false;
}

export default {
  command : 'song',
  alias   : ['play', 'audio', 'music', 'mp3', 'yta'],
  category: 'download',
  description: 'Download audio — YouTube metadata + SoundCloud audio (matched by title)',
  usage   : '.song <song name or keywords>',

  execute: async ({ reply, react, sock, jid, msg, text, sendMedia }) => {
    if (!text) return reply(
      '🎵 *AA MD Bot — Song Downloader*\n\n' +
      'Usage: `.song <song name>`\n\nExamples:\n' +
      '• `.play Faded Alan Walker`\n' +
      '• `.song Nadeem Sarwar Abbas Jo Zinda Hai`\n' +
      '• `.music Shape of You Ed Sheeran`\n' +
      '• `.play latest songs 2025`'
    );

    await react('⏳');

    const shortQ = text.length > 40 ? text.slice(0, 40) + '...' : text;
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
      // ── Phase 1: YouTube metadata (shown to user) ──────────────────────────
      // Best quality metadata: correct thumbnail, official title, views.
      const ytInfo = await ytSearchMeta(text);

      const title    = ytInfo?.title    || text;
      const uploader = ytInfo?.uploader || 'Unknown';
      const duration = ytInfo?.duration || 0;
      const views    = ytInfo?.views    || '—';
      const thumbUrl = ytInfo?.thumbUrl || '';
      const ytUrl    = ytInfo?.ytUrl    || '';

      // Duration guard — 15 min max
      if (duration > 900) {
        await react('❌');
        return reply(`❌ Too long (${fmtDuration(duration)}). Max 15 minutes.`);
      }

      // Fetch YouTube thumbnail
      let thumbBuf = null;
      if (thumbUrl) {
        try { thumbBuf = await getBuffer(thumbUrl); } catch {}
      }

      // Show info card with YouTube details
      const infoCaption =
        `✦✦✦✦✦✦✦✦✦✦\n` +
        `🎵 *AA MD Bot* MUSIC\n` +
        `✦✦✦✦✦✦✦✦✦✦\n\n` +
        `🎙 *${title}*\n` +
        `🎤 ${uploader}\n` +
        `⏱ ${fmtDuration(duration)} | 👁 ${views} views\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `⏳ _Please wait, downloading audio..._` +
        BRAND;

      if (thumbBuf) {
        await sock.sendMessage(jid, { image: thumbBuf, caption: infoCaption }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, { text: infoCaption }, { quoted: msg });
      }

      // ── Phase 2: Download audio — SoundCloud first, YouTube fallback ────────
      // SoundCloud is searched using the EXACT YouTube title (not user's raw query).
      // This means the audio track matches what was shown in the info card above.
      let downloaded = false;

      // 2a. SoundCloud — search by YouTube title for accurate match
      downloaded = await scDownloadByTitle(YTDLP, title, outFile);

      // 2b. SoundCloud — try original user query if title search failed
      if (!downloaded && title !== text) {
        downloaded = await scDownloadByTitle(YTDLP, text, outFile);
      }

      // 2c. YouTube direct (for latest / rare songs not yet on SoundCloud)
      // Uses the DIRECT YouTube URL so it downloads exactly what was shown
      if (!downloaded) {
        downloaded = await ytAudioDownload(YTDLP, title, ytUrl, outFile);
      }

      // 2d. YouTube search fallback with original query
      if (!downloaded && title !== text) {
        downloaded = await ytAudioDownload(YTDLP, text, '', outFile);
      }

      // Handle yt-dlp output extension change (.mp3 → .opus, .m4a, etc.)
      let dlFile = outFile;
      if (!downloaded || !await fs.pathExists(outFile)) {
        const files = await fs.readdir(tempDir);
        const found = files.find(f => f.startsWith(uid));
        if (found) { dlFile = path.join(tempDir, found); downloaded = true; }
      }

      if (!downloaded || !await fs.pathExists(dlFile)) {
        await react('❌');
        return reply(
          `❌ Download failed. Try different keywords.\n\n` +
          `💡 Tips:\n` +
          `• Add artist name: \`.play ${text} Alan Walker\`\n` +
          `• Add year: \`.play ${text} 2024\`\n` +
          `• Try exact song name`
        );
      }

      await sendMedia({
        audio   : await fs.readFile(dlFile),
        mimetype: 'audio/mpeg',
        fileName: `${title}.mp3`,
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
