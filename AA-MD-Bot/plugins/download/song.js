import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateId, getBuffer } from '../../lib/helper.js';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const YTDLP_PATHS = [
  '/home/runner/.local/bin/yt-dlp',
  '/usr/local/bin/yt-dlp',
  '/usr/bin/yt-dlp',
  'yt-dlp',
];

async function getYtdlp() {
  for (const p of YTDLP_PATHS) {
    try { await execAsync(`${p} --version`); return p; }
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

export default {
  command: 'song',
  alias: ['play', 'audio', 'music', 'mp3', 'yta'],
  category: 'download',
  description: 'Download YouTube audio/song as MP3',
  usage: '.song Faded Alan Walker | .play <song name>',
  ownerOnly: false,

  execute: async ({ reply, react, sock, jid, msg, text }) => {
    if (!text) return reply('🎵 Usage: .song <search query or YouTube URL>\n\nExample: .song Faded Alan Walker\n.play Back in Black');

    const ytdlp = await getYtdlp();
    if (!ytdlp) return reply('❌ yt-dlp not available on this server.');

    await react('⏳');

    const tempDir = path.join(__dirname, '../../temp');
    fs.ensureDirSync(tempDir);
    const uid = generateId();
    const outFile = path.join(tempDir, `${uid}.mp3`);

    try {
      const info = await ytSearch(text, ytdlp).catch(() => null);
      if (!info) return reply('❌ No results for: ' + text);

      const title    = info.title     || 'audio';
      const duration = info.duration  || 0;
      const uploader = info.uploader  || 'Unknown';
      const views    = info.view_count ? info.view_count.toLocaleString() : '—';
      const thumb    = info.thumbnail;
      const url      = info.webpage_url || text;
      const mins     = Math.floor(duration / 60);
      const secs     = String(duration % 60).padStart(2, '0');

      if (duration > 900) {
        return reply(`❌ Audio too long! (${mins}min)\nMax: 15 minutes`);
      }

      // Send info card first
      const caption =
        `╔═════════•∞•═╗\n` +
        `│⿻ *AA MD Bot*\n` +
        `│  *Youtube Player* ✨\n` +
        `│⿻ *Title:* ${title}\n` +
        `│⿻ *Duration:* ${mins}:${secs}\n` +
        `│⿻ *Viewers:* ${views}\n` +
        `│⿻ *Author:* ${uploader}\n` +
        `╚═•∞•═════════╝\n` +
        `⦿ *Url* : ${url}\n\n` +
        `⏳ _Downloading audio..._`;

      if (thumb) {
        let thumbBuf = null;
        try { thumbBuf = await getBuffer(thumb); } catch {}
        if (thumbBuf) {
          await sock.sendMessage(jid, { image: thumbBuf, caption }, { quoted: msg });
        } else {
          await reply(caption);
        }
      } else {
        await reply(caption);
      }

      // Download best audio and convert to mp3
      await execAsync(
        `${ytdlp} "${url}" -f "bestaudio[ext=m4a]/bestaudio/best" -x --audio-format mp3 --audio-quality 128K -o "${path.join(tempDir, uid + '.%(ext)s')}" --no-playlist --quiet --no-warnings`,
        { timeout: 120000 }
      );

      const altM4a  = outFile.replace('.mp3', '.m4a');
      const altWebm = outFile.replace('.mp3', '.webm');

      let finalFile = null;
      if (await fs.pathExists(outFile)) finalFile = outFile;
      else if (await fs.pathExists(altM4a)) finalFile = altM4a;
      else if (await fs.pathExists(altWebm)) finalFile = altWebm;

      if (!finalFile) return reply('❌ Download failed. Try another song.');

      const stat  = await fs.stat(finalFile);
      const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
      const mime  = finalFile.endsWith('.m4a') ? 'audio/mp4' : 'audio/mpeg';
      const ext   = path.extname(finalFile).slice(1);

      let thumbBuf = null;
      try { if (thumb) thumbBuf = await getBuffer(thumb); } catch {}

      await sock.sendMessage(jid, {
        audio: await fs.readFile(finalFile),
        mimetype: mime,
        fileName: `${title}.${ext}`,
        contextInfo: {
          externalAdReply: {
            title,
            body: uploader,
            renderLargerThumbnail: true,
            thumbnailUrl: thumb,
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
