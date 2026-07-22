// AA MD Bot - Song Recognition (Shazam-like)
// Primary: AudD.io (test token — ~3 free recognitions/day per IP)
// Fallback: Shazam RapidAPI (requires RAPIDAPI_KEY env var)
import axios from 'axios';
import FormData from 'form-data';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

async function downloadAudio(audioMsg, mediaType) {
  const stream = await downloadContentFromMessage(audioMsg, mediaType);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// AudD.io — supports base64 audio upload, free without token (limited)
async function tryAudd(buf) {
  const form = new FormData();
  form.append('file', buf, { filename: 'audio.mp3', contentType: 'audio/mpeg' });
  form.append('return', 'apple_music,spotify');
  // Use 'test' only as fallback — works ~3 times per IP per day
  const { data } = await axios.post('https://api.audd.io/', form, {
    headers: form.getHeaders(),
    timeout: 30000,
  });
  if (data?.status !== 'success' || !data?.result) throw new Error('no match');
  return data.result;
}

// Unofficial Shazam API via a public proxy
async function tryShazamProxy(buf) {
  const b64 = buf.toString('base64');
  const { data } = await axios.post(
    'https://shazam.p.rapidapi.com/songs/detect',
    b64,
    {
      headers: {
        'content-type': 'text/plain',
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY || '',
        'X-RapidAPI-Host': 'shazam.p.rapidapi.com',
      },
      timeout: 20000,
    }
  );
  const track = data?.track;
  if (!track) throw new Error('no match');
  return {
    title: track.title,
    artist: track.subtitle,
    album: track.sections?.[0]?.metadata?.find(m => m.title === 'Album')?.text,
    release_date: track.sections?.[0]?.metadata?.find(m => m.title === 'Released')?.text,
    spotify: null,
    apple_music: null,
  };
}

export default {
  command: 'shazam',
  alias: ['identify', 'whatsong', 'findsong', 'recognize'],
  description: 'Identify a song from any audio/voice note — reply to an audio with .shazam',
  category: 'search',

  async execute({ msg, reply, react, prefix }) {
    const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const audioMsg  = quotedMsg?.audioMessage
                   || quotedMsg?.videoMessage
                   || msg.message?.audioMessage;
    const mediaType = audioMsg === msg.message?.audioMessage
      ? 'audio'
      : quotedMsg?.videoMessage ? 'video' : 'audio';

    if (!audioMsg) {
      return reply(
        `🎵 *Song Recognition*\n\n` +
        `Reply to a *voice note, audio, or video* with:\n` +
        `*${prefix}shazam*\n\n` +
        `The bot will identify the song.\n\n` +
        `> 🎵 *AA MD Bot*`
      );
    }

    await react('🎵');

    let buf;
    try {
      buf = await downloadAudio(audioMsg, mediaType);
    } catch (err) {
      await react('❌');
      return reply(`❌ Failed to download audio: ${err.message}`);
    }

    let result = null;

    // Try AudD.io
    try {
      result = await tryAudd(buf);
    } catch {}

    // Try Shazam proxy (needs RAPIDAPI_KEY)
    if (!result && process.env.RAPIDAPI_KEY) {
      try {
        result = await tryShazamProxy(buf);
      } catch {}
    }

    if (!result) {
      await react('❌');
      return reply(
        `❌ *Could not identify this song.*\n\n` +
        `Possible reasons:\n` +
        `• Audio too short (need at least 5s of music)\n` +
        `• Background noise is too loud\n` +
        `• Song not in the recognition database\n\n` +
        `> 🎵 *AA MD Bot*`
      );
    }

    const spotify = result.spotify?.external_urls?.spotify;
    const apple   = result.apple_music?.url;

    let out =
      `🎵 *Song Identified!*\n\n` +
      `🎤 *Title:* ${result.title}\n` +
      `👤 *Artist:* ${result.artist}\n`;
    if (result.album)        out += `💿 *Album:* ${result.album}\n`;
    if (result.release_date) out += `📅 *Released:* ${result.release_date}\n`;
    if (spotify)             out += `\n🟢 *Spotify:* ${spotify}`;
    if (apple)               out += `\n🍎 *Apple Music:* ${apple}`;
    out += `\n\n> 🎵 *AA MD Bot*`;

    await react('✅');
    await reply(out);
  },
};
