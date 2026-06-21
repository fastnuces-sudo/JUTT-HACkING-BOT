import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { generateId, getBuffer, getBestThumb } from '../../lib/helper.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const YTDLP_PATHS = [
  '/home/runner/workspace/.pythonlibs/bin/yt-dlp',
  '/home/runner/.local/bin/yt-dlp',
  '/usr/local/bin/yt-dlp',
  '/usr/bin/yt-dlp',
  '/opt/homebrew/bin/yt-dlp',
  'yt-dlp',
];

async function getYtdlp() {
  for (const p of YTDLP_PATHS) {
    try { await execAsync(`${p} --version`, { timeout: 5000 }); return p; }
    catch {}
  }
  return null;
}

async function ytSearch(query, ytdlp) {
  const cmd = query.startsWith('http')
    ? `${ytdlp} "${query}" --dump-json --no-playlist --no-download --quiet`
    : `${ytdlp} "ytsearch1:${query}" --dump-json --no-playlist --no-download --quiet`;
  const { stdout } = await execAsync(cmd, { timeout: 30000 });
  return JSON.parse(stdout.trim().split('\n')[0]);
}

async function scSearch(query, ytdlp) {
  const cmd = query.startsWith('http')
    ? `${ytdlp} "${query}" --dump-json --no-playlist --no-download --quiet`
    : `${ytdlp} "scsearch1:${query}" --dump-json --no-playlist --no-download --quiet`;
  const { stdout } = await execAsync(cmd, { timeout: 30000 });
  return JSON.parse(stdout.trim().split('\n')[0]);
}

async function downloadAudio(ytdlp, url, outTemplate, timeout = 120000) {
  await execAsync(
    `${ytdlp} "${url}" -f "bestaudio[ext=m4a]/bestaudio/best" -x --audio-format mp3 --audio-quality 128K -o "${outTemplate}" --no-playlist --quiet --no-warnings`,
    { timeout }
  );
}

export default {
  command: 'song',
  alias: ['play', 'audio', 'music', 'mp3', 'yta'],
  category: 'download',
  description: 'Download YouTube/SoundCloud audio as MP3',
  usage: '.song Faded Alan Walker | .play <song name>',
  ownerOnly: false,

  execute: async ({ reply, react, sock, jid, msg, text }) => {
    if (!text) return reply('🎵 Usage: .song <search query or URL>\n\nExample: .song Faded Alan Walker\n.play Back in Black');

    const ytdlp = await getYtdlp();
    if (!ytdlp) return reply('❌ yt-dlp not available on this server.\n\nAsk admin to install: pip install yt-dlp');

    await react('⏳');

    const tempDir = path.join(__dirname, '../../temp');
    fs.ensureDirSync(tempDir);
    const uid = generateId();
    const outTemplate = path.join(tempDir, `${uid}.%(ext)s`);
    const outFile = path.join(tempDir, `${uid}.mp3`);

    let info = null;
    let source = 'YouTube';

    try {
      // Try YouTube first
      info = await ytSearch(text, ytdlp).catch(() => null);

      // SoundCloud fallback if YouTube fails
      if (!info) {
        source = 'SoundCloud';
        info = await scSearch(text, ytdlp).catch(() => null);
      }

      if (!info) { await react('❌'); return reply('❌ No results found on YouTube or SoundCloud for: ' + text); }

      const title    = info.title     || 'audio';
      const duration = info.duration  || 0;
      const uploader = info.uploader  || info.artist || 'Unknown';
      const views    = info.view_count ? info.view_count.toLocaleString() : '—';
      const thumbUrl = getBestThumb(info);
      const url      = info.webpage_url || text;
      const mins     = Math.floor(duration / 60);
      const secs     = String(duration % 60).padStart(2, '0');

      if (duration > 900) {
        await react('❌');
        return reply(`❌ Audio too long! (${mins}min)\nMax: 15 minutes`);
      }

      const srcIcon = source === 'SoundCloud' ? '🔶' : '🎵';
      const caption =
        `╔═════════•∞•═╗\n` +
        `│⿻ *AA MD Bot*\n` +
        `│  *${source} Player* ${srcIcon}\n` +
        `│⿻ *Title:* ${title}\n` +
        `│⿻ *Duration:* ${mins}:${secs}\n` +
        `│⿻ *Viewers:* ${views}\n` +
        `│⿻ *Author:* ${uploader}\n` +
        `╚═•∞•═════════╝\n` +
        `⦿ *Url* : ${url}\n\n` +
        `⏳ _Downloading audio..._`;

      let thumbBuf = null;
      if (thumbUrl) { try { thumbBuf = await getBuffer(thumbUrl); } catch {} }

      if (thumbBuf) {
        await sock.sendMessage(jid, { image: thumbBuf, caption }, { quoted: msg });
      } else {
        await reply(caption);
      }

      // Try download from primary source
      let downloadErr = null;
      try {
        await downloadAudio(ytdlp, url, outTemplate);
      } catch (e) {
        downloadErr = e;
        // If YouTube failed, try SoundCloud
        if (source === 'YouTube') {
          try {
            const scInfo = await scSearch(text, ytdlp).catch(() => null);
            if (scInfo) {
              await downloadAudio(ytdlp, scInfo.webpage_url || scInfo.url, outTemplate);
              downloadErr = null;
            }
          } catch {}
        }
        if (downloadErr) throw downloadErr;
      }

      const altM4a  = outFile.replace('.mp3', '.m4a');
      const altWebm = outFile.replace('.mp3', '.webm');

      let finalFile = null;
      if (await fs.pathExists(outFile)) finalFile = outFile;
      else if (await fs.pathExists(altM4a)) finalFile = altM4a;
      else if (await fs.pathExists(altWebm)) finalFile = altWebm;

      if (!finalFile) { await react('❌'); return reply('❌ Download failed. Try another song.'); }

      const stat   = await fs.stat(finalFile);
      const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
      const mime   = finalFile.endsWith('.m4a') ? 'audio/mp4' : 'audio/mpeg';
      const ext    = path.extname(finalFile).slice(1);

      await sock.sendMessage(jid, {
        audio: await fs.readFile(finalFile),
        mimetype: mime,
        fileName: `${title}.${ext}`,
        contextInfo: {
          externalAdReply: {
            title,
            body: `${uploader} • ${mins}:${secs} • ${sizeMB} MB • ${source}`,
            renderLargerThumbnail: true,
            thumbnailUrl: thumbUrl || undefined,
            mediaType: 1,
            ...(thumbBuf ? { thumbnail: thumbBuf } : {}),
            sourceUrl: url,
          },
        },
      }, { quoted: msg });

      await react('✅');
      fs.remove(finalFile).catch(() => {});

    } catch (err) {
      await react('❌');
      reply('❌ Song download failed: ' + (err.message?.slice(0, 100) || 'Unknown error'));
    }
  },
};
