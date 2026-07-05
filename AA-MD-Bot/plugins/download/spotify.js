// ============================================
// AA MD Bot - Spotify Downloader
// Uses spotifydown.com (free, no key needed)
// ============================================

import axios from 'axios';

const api = axios.create({ timeout: 25000 });
const SP_RX = /https?:\/\/open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/i;

async function getTrackInfo(trackId) {
  const { data } = await api.get(`https://api.spotifydown.com/metadata/track/${trackId}`, {
    headers: { origin: 'https://spotifydown.com', referer: 'https://spotifydown.com' },
  });
  return data;
}

async function downloadTrack(trackId) {
  const { data } = await api.get(`https://api.spotifydown.com/download/${trackId}`, {
    headers: { origin: 'https://spotifydown.com', referer: 'https://spotifydown.com' },
  });
  if (!data.success) throw new Error(data.error || 'Download failed');
  return data;
}

async function getPlaylistTracks(playlistId) {
  const { data } = await api.get(`https://api.spotifydown.com/trackList/playlist/${playlistId}`, {
    headers: { origin: 'https://spotifydown.com', referer: 'https://spotifydown.com' },
  });
  return data?.trackList?.slice(0, 5) || [];
}

export default {
  command: 'spotify',
  alias: ['spot', 'spotifydl', 'spdl'],
  description: 'Download Spotify tracks (free, no account needed)',
  category: 'download',

  async execute({ text, msg, reply, react, sock, jid, prefix }) {
    let url = text?.trim();
    if (!url) {
      const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (q) url = (q.conversation || q.extendedTextMessage?.text || '').trim();
    }

    const match = url?.match(SP_RX);
    if (!match) return reply(
      `🎵 *Spotify Downloader*\n\n` +
      `*Usage:* ${prefix}spotify <link>\n` +
      `*Supports:* Tracks • Playlists (first 5)\n\n` +
      `*Example:*\n` +
      `${prefix}spotify https://open.spotify.com/track/xxx\n\n` +
      `> 🎵 *AA MD Bot*`
    );

    await react('⏳');

    const type = match[1]; // 'track', 'album', 'playlist'
    const id   = match[2];

    try {
      if (type === 'track') {
        // Single track
        const [meta, dl] = await Promise.all([
          getTrackInfo(id).catch(() => null),
          downloadTrack(id),
        ]);

        const title  = meta?.title || dl.metadata?.title || 'Unknown';
        const artist = meta?.artists || dl.metadata?.artists || 'Unknown';
        const cover  = meta?.cover;

        if (cover) {
          await sock.sendMessage(jid, {
            image: { url: cover },
            caption:
              `🎵 *${title}*\n` +
              `👤 *Artist:* ${artist}\n` +
              `⬇️ Sending audio…\n\n` +
              `> 🎵 *AA MD Bot*`,
          }, { quoted: msg });
        }

        await sock.sendMessage(jid, {
          audio: { url: dl.link },
          mimetype: 'audio/mpeg',
          fileName: `${title} - ${artist}.mp3`,
          ptt: false,
        }, { quoted: msg });

        await react('✅');
      } else if (type === 'playlist') {
        const tracks = await getPlaylistTracks(id);
        if (!tracks.length) throw new Error('Playlist is empty or private');

        await reply(`🎵 *Playlist — sending ${tracks.length} tracks*\n\n> 🎵 *AA MD Bot*`);

        for (const track of tracks) {
          try {
            const dl = await downloadTrack(track.id);
            await sock.sendMessage(jid, {
              audio: { url: dl.link },
              mimetype: 'audio/mpeg',
              fileName: `${track.title} - ${track.artists}.mp3`,
              ptt: false,
            }, { quoted: msg });
          } catch {}
        }
        await react('✅');
      } else {
        reply('❌ Albums are not supported. Use a track or playlist link.');
      }
    } catch (e) {
      await react('❌');
      reply(`❌ *Spotify download failed*\n\n${e.message}\n\n💡 Only public tracks/playlists are supported.`);
    }
  },
};
