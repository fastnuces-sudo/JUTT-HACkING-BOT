// ============================================
// AA MD Bot - Voice to Text (VTT)
// Developer: Ahsan Ali | AA Mods
// Free: HuggingFace Whisper (no key needed)
// Optional: set HF_TOKEN for more requests
// ============================================

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { generateId } from '../../lib/helper.js';

const execFileAsync = promisify(execFile);
const __dirname     = path.dirname(fileURLToPath(import.meta.url));
const tmpDir        = path.join(__dirname, '../../temp');

const HF_MODELS = [
  'openai/whisper-large-v3',
  'openai/whisper-medium',
  'openai/whisper-base',
];

async function getFfmpegBin() {
  try { const m = await import('ffmpeg-static'); return m.default || 'ffmpeg'; }
  catch { return 'ffmpeg'; }
}

async function toWav(inputPath, outputPath) {
  const ff = await getFfmpegBin();
  await execFileAsync(ff, ['-y', '-i', inputPath, '-ar', '16000', '-ac', '1', outputPath]);
}

async function hfWhisper(audioBuffer, mimeType = 'audio/ogg') {
  const token = process.env.HF_TOKEN;
  const headers = { 'Content-Type': mimeType };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  for (const model of HF_MODELS) {
    const url = `https://api-inference.huggingface.co/models/${model}`;
    // Retry up to 3x if model is loading
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await axios.post(url, audioBuffer, { headers, timeout: 60000 });
        const text = res.data?.text || res.data?.[0]?.generated_text;
        if (text?.trim()) return text.trim();
        break;
      } catch (err) {
        const est = err.response?.data?.estimated_time;
        if (err.response?.status === 503 && est && attempt < 2) {
          await new Promise(r => setTimeout(r, Math.min(est * 1000, 25000)));
          continue;
        }
        break;
      }
    }
  }
  return null;
}

export default {
  command: 'vtt',
  alias: ['voicetext', 'stt', 'transcribe', 'v2t'],
  description: 'Voice/audio message ko text mein convert karo',
  category: 'media',

  async execute({ sock, jid, msg, reply, react }) {
    const ctx    = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;
    const content = quoted || msg.message;
    const audioMsg = content?.audioMessage || content?.videoMessage;

    if (!audioMsg) {
      return reply(`🎙️ *Voice to Text*\n\nKisi voice/audio message ko *reply* kar ke *.vtt* bhejo.\n\n_Optional: HF_TOKEN secret set karo zyada limits ke liye (huggingface.co — free)_\n\n> 🤖 *AA MD Bot*`);
    }

    await react('⏳');
    fs.ensureDirSync(tmpDir);
    const id      = generateId();
    const oggPath = path.join(tmpDir, `${id}.ogg`);
    const wavPath = path.join(tmpDir, `${id}.wav`);

    try {
      const msgObj = quoted ? { message: content, key: { ...msg.key, id: ctx.stanzaId } } : msg;
      const buffer = await sock.downloadMediaMessage(msgObj);
      if (!buffer?.length) throw new Error('Audio download failed');

      // Try raw OGG first (fastest)
      let text = await hfWhisper(buffer, 'audio/ogg');

      // If failed, convert to WAV and retry
      if (!text) {
        await fs.writeFile(oggPath, buffer);
        await toWav(oggPath, wavPath);
        const wavBuf = await fs.readFile(wavPath);
        text = await hfWhisper(wavBuf, 'audio/wav');
      }

      if (!text) {
        await react('❌');
        return reply(`❌ *Transcription fail hui.*\n\nAudio clear nahi tha ya server busy hai. Dobara try karo.\n\n> 🤖 *AA MD Bot*`);
      }

      await react('✅');
      return reply(`🎙️ *Voice to Text*\n\n${text}\n\n> 🤖 *AA MD Bot*`);

    } catch (err) {
      await react('❌');
      return reply(`❌ *Error:* ${err.message}\n\n> 🤖 *AA MD Bot*`);
    } finally {
      fs.remove(oggPath).catch(() => {});
      fs.remove(wavPath).catch(() => {});
    }
  },
};
