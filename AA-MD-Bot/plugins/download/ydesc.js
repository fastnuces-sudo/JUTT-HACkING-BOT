import { exec } from 'child_process';
import { promisify } from 'util';
import { getBestThumb } from '../../lib/helper.js';
import { YTDLP } from '../../lib/ytdlp.js';

const execAsync = promisify(exec);

export default {
  command: 'ydesc',
  alias: ['ytdesc', 'ytinfo', 'ytdescription'],
  category: 'download',
  description: 'Search YouTube and show video info',
  usage: '.ydesc Faded Alan Walker',
  ownerOnly: false,
  execute: async ({ reply, react, sock, jid, msg, text }) => {
    if (!text) return reply('🔍 Usage: .ydesc <search query>\n\nExample: .ydesc Faded Alan Walker');

    const ytdlp = YTDLP;

    await react('⏳');

    try {
      const { stdout } = await execAsync(
        `${ytdlp} "ytsearch5:${text}" --dump-json --no-playlist --no-download --quiet`,
        { timeout: 30000 }
      );

      const videos = stdout.trim().split('\n').filter(Boolean).map(l => {
        try { return JSON.parse(l); } catch { return null; }
      }).filter(Boolean);

      if (!videos.length) {
        await react('❌');
        return reply('❌ No results found for: ' + text);
      }

      let result = `🔍 *YouTube Search Results*\n_Query: ${text}_\n\n`;
      videos.forEach((v, i) => {
        const dur = v.duration || 0;
        const min = Math.floor(dur / 60);
        const sec = String(dur % 60).padStart(2, '0');
        result += `*${i + 1}.* ${v.title}\n`;
        result += `   ⏱️ ${min}:${sec} | 👁️ ${(v.view_count || 0).toLocaleString()} views\n`;
        result += `   👤 ${v.uploader || 'Unknown'}\n`;
        result += `   🔗 ${v.webpage_url}\n\n`;
      });

      result += `_Use .song or .video to download_`;

      // Send with thumbnail of first result
      const thumbUrl = getBestThumb(videos[0]);
      if (thumbUrl) {
        await sock.sendMessage(jid, {
          image: { url: thumbUrl },
          caption: result,
        }, { quoted: msg });
      } else {
        await reply(result);
      }

      await react('✅');
    } catch (err) {
      await react('❌');
      reply('❌ YouTube search failed. Please try again in a few seconds.');
    }
  },
};
