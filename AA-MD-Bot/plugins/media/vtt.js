// ============================================
// AA MD Bot - Voice to Text (VTT)
// Developer: Ahsan Ali | AA Mods
// Free: HuggingFace Whisper (no key needed)
// Optional: set HF_TOKEN for more requests
// ============================================

import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { execFile } from "child_process";
import { promisify } from "util";
import { generateId } from "../../lib/helper.js";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmpDir = path.join(__dirname, "../../temp");

// Ordered by speed/reliability: turbo first, then large-v3, then fallbacks
const HF_MODELS = [
  "openai/whisper-large-v3-turbo",
  "openai/whisper-large-v3",
  "openai/whisper-medium",
  "openai/whisper-base",
];

async function getFfmpegBin() {
  try {
    const m = await import("ffmpeg-static");
    return m.default || "ffmpeg";
  } catch {
    return "ffmpeg";
  }
}

async function toWav(inputPath, outputPath) {
  const ff = await getFfmpegBin();
  await execFileAsync(ff, [
    "-y",
    "-i",
    inputPath,
    "-ar",
    "16000",
    "-ac",
    "1",
    "-acodec",
    "pcm_s16le",
    outputPath,
  ]);
}

async function hfWhisper(audioBuffer, mimeType = "audio/ogg") {
  const token = process.env.HF_TOKEN;
  const headers = { "Content-Type": mimeType };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  for (const model of HF_MODELS) {
    const url = `https://api-inference.huggingface.co/models/${model}`;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await axios.post(url, audioBuffer, {
          headers,
          timeout: 90000,
          maxContentLength: 25 * 1024 * 1024,
        });
        const text = res.data?.text || res.data?.[0]?.generated_text;
        if (text?.trim()) return text.trim();
        break;
      } catch (err) {
        const status = err.response?.status;
        const est = err.response?.data?.estimated_time;
        // 503 = model loading — wait and retry
        if (status === 503 && est && attempt < 2) {
          await new Promise((r) => setTimeout(r, Math.min(est * 1000, 30000)));
          continue;
        }
        // 429 = rate limit — try next model
        if (status === 429) break;
        break;
      }
    }
  }
  return null;
}

export default {
  command: "vtt",
  alias: ["voicetext", "stt", "transcribe", "v2t"],
  description: "Convert a voice/audio message to text",
  category: "media",

  async execute({ sock, jid, msg, reply, react }) {
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const quoted = ctx?.quotedMessage;
    const content = quoted || msg.message;

    // Support voice note, audio, video, and ptt
    const audioMsg =
      content?.audioMessage || content?.videoMessage || content?.ptvMessage;

    if (!audioMsg) {
      return reply(
        `🎙️ *Voice to Text*\n\n` +
          `*Reply* to any voice or audio message and send *.vtt*.\n\n` +
          `> 🤖 *AA MD Bot*`,
      );
    }

    await react("⏳");
    fs.ensureDirSync(tmpDir);
    const id = generateId();
    const oggPath = path.join(tmpDir, `${id}.ogg`);
    const wavPath = path.join(tmpDir, `${id}.wav`);

    try {
      const msgObj = quoted
        ? { message: content, key: { ...msg.key, id: ctx.stanzaId } }
        : msg;

      const buffer = await sock.downloadMediaMessage(msgObj);
      if (!buffer?.length) throw new Error("Audio download failed");

      // 1st attempt: send raw OGG/Opus (WhatsApp voice note format)
      let text = await hfWhisper(buffer, "audio/ogg");

      // 2nd attempt: convert to 16kHz WAV (cleaner for Whisper)
      if (!text) {
        await fs.writeFile(oggPath, buffer);
        await toWav(oggPath, wavPath);
        const wavBuf = await fs.readFile(wavPath);
        text = await hfWhisper(wavBuf, "audio/wav");
      }

      if (!text) {
        await react("❌");
        return reply(
          `❌ *Transcription failed.*\n\nThe audio was unclear or the server is busy. Please try again in a moment.\n\n> 🤖 *AA MD Bot*`,
        );
      }

      await react("✅");
      return reply(`🎙️ *Voice to Text*\n\n${text}\n\n> 🤖 *AA MD Bot*`);
    } catch (err) {
      await react("❌");
      return reply(`❌ *Error:* ${err.message}\n\n> 🤖 *AA MD Bot*`);
    } finally {
      fs.remove(oggPath).catch(() => {});
      fs.remove(wavPath).catch(() => {});
    }
  },
};
