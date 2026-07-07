// ============================================
// AA MD Bot - Spotify Downloader
// Primary: spotifydown.com API
// Fallback: YouTube search via yt-dlp (--get-url)
// ============================================

import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { YTDLP, getCookiesArgs } from '../../lib/ytdlp.js';

const execFileP = promisify(execFile);
const api       = axios.create({ timeout: 18000 });
const SP_RX     = /https?:\/\/open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/i;

const SD_HEADERS = {
  origin:  'https://spotifydown.com',
  referer: 'https://spotifydown.com/',
};

// ── Spotify metadata ──────────────────────────────────────────────────────────
async function getSpotifyMeta(id) {
  const { data } = await api.get(
    `https://api.spotifydown.com/metadata/track/${id}`,
    { headers: SD_HEADERS }
  );
  return data;
}

// ── Direct spotifydown download ───────────────────────────────────────────────
async function spotifyDown(id) {
  const { data } = await api.get(
    `https://api.spotifydown.com/download/${id}`,
    { headers: SD_HEADERS }
  );
  if (!data?.success || !data?.link) throw new Error(data?.error || 'spotifydown failed');
  return data;
}

// ── Playlist track list ───────────────────────────────────────────────────────
async function getPlaylistTracks(id) {
  const { data } = await api.get(
    `https://api.spotifydown.com/trackList/playlist/${id}`,
    { headers: SD_HEADERS }
  );
  return data?.trackList?.slice(0, 5) || [];
}

// ── Fallback: YouTube search → yt-dlp stream URL ─────────────────────────────
// Uses --get-url so WhatsApp streams it directly — no temp file, no piping.
async function ytFallback(title, artist) {
  const query = `${title} ${artist} audio`.slice(0, 120);
  const args = [
    `ytsearch1:${query}`,
    '-f', 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio',
    '--get-url',
    '--no-playlist',
    '--no-warnings',
    '--socket-timeout', '20',
    ...getCookiesArgs(),
  ];
  const { stdout } = await execFileP(YTDLP, args, { timeout: 40000 });
  const link = stdout.trim().split('\n')[0];
  if (!link?.startsWith('http')) throw new Error('yt-dlp search returned no URL');
  return link;
}

// ── Send audio helper ─────────────────────────────────────────────────────────
async function sendAudio(sock, jid, msg, url, title, artist) {
  await sock.sendMessage(jid, {
    audio: { url },
    mimetype: 'audio/mp4',
    fileName: `${title} - ${artist}.m4a`,
    ptt: false,
  }, { quoted: msg });
}

export default {
  command: 'spotify',
  alias: ['spot', 'spotifydl', 'spdl'],
  description: 'Download Spotify tracks (free)',
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
    const type = match[1];
    const id   = match[2];

    try {
      if (type === 'track') {
        // ── Metadata ──────────────────────────────────────────────────────────
        let title = 'Unknown', artist = 'Unknown', cover = null;
        try {
          const meta = await getSpotifyMeta(id);
          title  = meta?.title   || title;
          artist = meta?.artists || meta?.artist || artist;
          cover  = meta?.cover   || null;
        } catch {}

        // Show cover while downloading
        if (cover) {
          await sock.sendMessage(jid, {
            image: { url: cover },
            caption:
              `🎵 *${title}*\n` +
              `👤 *${artist}*\n\n` +
              `⏳ Downloading…\n\n> 🎵 *AA MD Bot*`,
          }, { quoted: msg }).catch(() => {});
        }

        // ── Try spotifydown ───────────────────────────────────────────────────
        let audioUrl = null;
        try {
          const dl = await spotifyDown(id);
          audioUrl = dl.link;
          // Update title/artist from spotifydown metadata if we didn't get it before
          if (dl.metadata?.title  && title  === 'Unknown') title  = dl.metadata.title;
          if (dl.metadata?.artists && artist === 'Unknown') artist = dl.metadata.artists;
        } catch {}

        // ── Fallback: YouTube search ──────────────────────────────────────────
        if (!audioUrl) {
          audioUrl = await ytFallback(title, artist);
        }

        await sendAudio(sock, jid, msg, audioUrl, title, artist);
        await react('✅');

      } else if (type === 'playlist') {
        let tracks = [];
        try { tracks = await getPlaylistTracks(id); } catch {}
        if (!tracks.length) throw new Error('Playlist is empty or private');

        await reply(`🎵 *Playlist — sending ${tracks.length} tracks…*\n\n> 🎵 *AA MD Bot*`);

        for (const track of tracks) {
          const t = track.title  || 'Unknown';
          const a = track.artists || 'Unknown';
          try {
            let audioUrl = null;
            try { const dl = await spotifyDown(track.id); audioUrl = dl.link; } catch {}
            if (!audioUrl) audioUrl = await ytFallback(t, a);
            await sendAudio(sock, jid, msg, audioUrl, t, a);
          } catch {}
        }
        await react('✅');

      } else {
        reply(`❌ Albums not supported. Use a *track* or *playlist* link.\n\n> 🎵 *AA MD Bot*`);
      }

    } catch (e) {
      await react('❌');
      reply(`❌ *Spotify failed:* ${e.message}\n\n> 🎵 *AA MD Bot*`);
    }
  },
};
