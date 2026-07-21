// ============================================
// AA MD Bot - Voice to Text (VTT)
// Developer: Ahsan Ali | AA Mods
// Uses OpenAI Whisper API (set OPENAI_API_KEY)
// Fallback: AssemblyAI  (set ASSEMBLYAI_API_KEY)
// ============================================

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { generateId } from '../../lib/helper.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDir    = path.join(__dirname, '../../temp');

async function getFfmpegBin() {
  try {
    const mod = await import('ffmpeg-static');
    return mod.default || 'ffmpeg';
  } catch {
    return 'ffmpeg';
  }
}

async function toMp3(inputPath, outputPath) {
  const ffmpeg = await getFfmpegBin();
  await execFileAsync(ffmpeg, [
    '-y', '-i', inputPath,
    '-ar', '16000', '-ac', '1', '-b:a', '64k',
    outputPath,
  ]);
}

async function transcribeOpenAI(mp3Path) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  // Dynamic import to avoid top-level issues with CommonJS form-data
  const FormData = (await import('form-data')).default;
  const form = new FormData();
  form.append('file', fs.createReadStream(mp3Path), 'audio.mp3');
  form.append('model', 'whisper-1');
  const res = await axios.post(
    'https://api.openai.com/v1/audio/transcriptions',
    form,
    { headers: { ...form.getHeaders(), Authorization: `Bearer ${key}` }, timeout: 60000 }
  );
  return res.data?.text || null;
}

async function transcribeAssemblyAI(mp3Path) {
  const key = process.env.ASSEMBLYAI_API_KEY;
  if (!key) return null;
  const fileData = await fs.readFile(mp3Path);
  const upload = await axios.post(
    'https://api.assemblyai.com/v2/upload',
    fileData,
    { headers: { authorization: key, 'content-type': 'application/octet-stream' }, timeout: 30000 }
  );
  const audioUrl = upload.data.upload_url;
  const req = await axios.post(
    'https://api.assemblyai.com/v2/transcript',
    { audio_url: audioUrl, language_detection: true },
    { headers: { authorization: key }, timeout: 15000 }
  );
  const id = req.data.id;
  for (let i = 0; i < 24; i++) {
    await new Promise(r => setTimeout(r, 2500));
    const poll = await axios.get(
      `https://api.assemblyai.com/v2/transcript/${id}`,
      { headers: { authorization: key }, timeout: 10000 }
    );
    if (poll.data.status === 'completed') return poll.data.text || null;
    if (poll.data.status === 'error') return null;
  }
  return null;
}

export default {
  command: 'vtt',
  alias: ['voicetext', 'stt', 'transcribe', 'v2t'],
  description: 'Voice/audio message ko text mein convert karo',
  category: 'media',

  async execute({ sock, jid, msg, reply, react }) {
    const hasKey = process.env.OPENAI_API_KEY || process.env.ASSEMBLYAI_API_KEY;
    if (!hasKey) {
      return reply(
        `🎙️ *Voice to Text*\n\n` +
        `Is feature ke liye ek free API key chahiye.\n\n` +
        `*Setup (ek baar):*\n` +
        `1️⃣ *OpenAI Whisper:* openai.com → API Keys\n` +
        `   Replit Secret: *OPENAI_API_KEY*\n\n` +
        `2️⃣ *AssemblyAI (free):* assemblyai.com signup\n` +
        `   Replit Secret: *ASSEMBLYAI_API_KEY*\n\n` +
        `Key set hone ke baad automatically kaam karega!\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    const ctx        = msg.message?.extendedTextMessage?.contextInfo;
    const quoted     = ctx?.quotedMessage;
    const msgContent = quoted || msg.message;
    const audioMsg   = msgContent?.audioMessage || msgContent?.videoMessage;

    if (!audioMsg) {
      return reply(
        `🎙️ *Voice to Text*\n\n` +
        `Kisi audio/voice message ko *reply* kar ke *.vtt* bhejo.\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    await react('⏳');
    fs.ensureDirSync(tmpDir);
    const id      = generateId();
    const inPath  = path.join(tmpDir, `${id}_audio.ogg`);
    const mp3Path = path.join(tmpDir, `${id}_audio.mp3`);

    try {
      const msgObj = quoted
        ? { message: msgContent, key: { ...msg.key, id: ctx.stanzaId } }
        : msg;
      const buffer = await sock.downloadMediaMessage(msgObj);
      if (!buffer?.length) throw new Error('Audio download failed');
      await fs.writeFile(inPath, buffer);

      await toMp3(inPath, mp3Path);

      let text = await transcribeOpenAI(mp3Path);
      if (!text) text = await transcribeAssemblyAI(mp3Path);

      if (!text?.trim()) {
        await react('❌');
        return reply(`❌ *Transcription fail hua.* Audio clear nahi tha.\n\n> 🤖 *AA MD Bot*`);
      }

      await react('✅');
      return reply(
        `🎙️ *Voice to Text*\n\n` +
        `📝 *Transcript:*\n${text.trim()}\n\n` +
        `> 🤖 *AA MD Bot*`
      );

    } catch (err) {
      await react('❌');
      return reply(`❌ *Error:* ${err.message}\n\n> 🤖 *AA MD Bot*`);
    } finally {
      fs.remove(inPath).catch(() => {});
      fs.remove(mp3Path).catch(() => {});
    }
  },
};
