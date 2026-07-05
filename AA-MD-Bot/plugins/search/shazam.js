// ============================================
// AA MD Bot - Song Recognition (Shazam-like)
// Uses AudD.io — recognizes song from audio
// Reply to a voice note or audio with .shazam
// ============================================

import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';
import { generateId } from '../../lib/helper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDD_API  = 'https://api.audd.io/';

async function recognizeSong(audioBuf) {
  const FormData = (await import('form-data')).default;
  const form = new FormData();
  form.append('file', audioBuf, { filename: 'audio.mp3', contentType: 'audio/mpeg' });
  form.append('return', 'apple_music,spotify');
  form.append('api_token', 'test'); // free test token

  const { data } = await axios.post(AUDD_API, form, {
    headers: form.getHeaders(),
    timeout: 30000,
  });
  return data;
}

export default {
  command: 'shazam',
  alias: ['identify', 'whatsong', 'findsong', 'recognize'],
  description: 'Identify a song from any audio/voice note — reply to an audio with .shazam',
  category: 'search',

  async execute({ msg, reply, react, sock, jid, prefix }) {
    // Get quoted audio / audio in current message
    const quotedMsg  = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const audioMsg   = quotedMsg?.audioMessage
                    || quotedMsg?.videoMessage
                    || msg.message?.audioMessage;

    if (!audioMsg) return reply(
      `🎵 *Song Recognition*\n\n` +
      `Reply to an *audio, voice note, or video* with:\n` +
      `*.shazam*\n\n` +
      `The bot will identify the song and give you:\n` +
      `• Song title & artist\n` +
      `• Album & release year\n` +
      `• Spotify & Apple Music links\n\n` +
      `> 🎵 *AA MD Bot*`
    );

    await react('🎵');

    const tmpDir = path.join(__dirname, '../../temp');
    fs.ensureDirSync(tmpDir);
    const tmpFile = path.join(tmpDir, `shazam_${generateId()}.mp3`);

    try {
      // Download the audio
      const mediaType = audioMsg === msg.message?.audioMessage ? 'audio' : (quotedMsg?.videoMessage ? 'video' : 'audio');
      const stream = await downloadContentFromMessage(audioMsg, mediaType);
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const buf = Buffer.concat(chunks);
      fs.writeFileSync(tmpFile, buf);

      const result = await recognizeSong(buf);

      if (result.status !== 'success' || !result.result) {
        await react('❓');
        return reply(
          `❓ *Song not recognized*\n\n` +
          `Could not identify the song. Try with:\n` +
          `• A clearer audio clip (5+ seconds)\n` +
          `• Less background noise\n\n` +
          `> 🎵 *AA MD Bot*`
        );
      }

      const r        = result.result;
      const title    = r.title    || 'Unknown';
      const artist   = r.artist   || 'Unknown';
      const album    = r.album    || 'N/A';
      const year     = r.release_date?.split('-')[0] || 'N/A';
      const spotUrl  = r.spotify?.external_urls?.spotify || '';
      const appleUrl = r.apple_music?.url || '';
      const cover    = r.apple_music?.artwork?.url?.replace('{w}x{h}', '600x600') || r.spotify?.album?.images?.[0]?.url;

      const info =
        `🎵 *Song Identified!*\n\n` +
        `🎤 *Title:* ${title}\n` +
        `👤 *Artist:* ${artist}\n` +
        `💿 *Album:* ${album}\n` +
        `📅 *Year:* ${year}\n` +
        (spotUrl  ? `\n🟢 *Spotify:* ${spotUrl}` : '') +
        (appleUrl ? `\n🍎 *Apple Music:* ${appleUrl}` : '') +
        `\n\n> 🎵 *AA MD Bot*`;

      if (cover) {
        await sock.sendMessage(jid, { image: { url: cover }, caption: info }, { quoted: msg });
      } else {
        reply(info);
      }

      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ Shazam failed: ${e.message}`);
    } finally {
      fs.remove(tmpFile).catch(() => {});
    }
  },
};
