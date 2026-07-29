// ============================================
// AA MD Bot - AI Video Generator
// Developer: Ahsan Ali | AA Mods
//
// Commands:
//   .aivideo <prompt> — text se AI video banao
//   .aivid <prompt>   — short alias
//
// Powered by: Wan2.1-T2V via Hugging Face (free)
// ============================================

import { Client } from '@gradio/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR  = path.join(__dirname, '../../temp');

const FOOTER = '\n\n> 🤖 *AA MD Bot*  •  👨‍💻 *Ahsan Ali Wadani*';

const FRAMES = [
  '🎬 Generating video [■□□□□□□□□□]  10%',
  '🎬 Generating video [■■□□□□□□□□]  20%',
  '🎬 Generating video [■■■□□□□□□□]  30%',
  '🎬 Generating video [■■■■□□□□□□]  40%',
  '🎬 Generating video [■■■■■□□□□□]  50%',
  '🎬 Generating video [■■■■■■□□□□]  60%',
  '🎬 Generating video [■■■■■■■□□□]  70%',
  '🎬 Generating video [■■■■■■■■□□]  80%',
  '🎬 Generating video [■■■■■■■■■□]  90%',
];

export default {
  command:     'aivideo',
  alias:       ['aivid', 'videogen', 'makevideo'],
  description: 'Text se AI video banao (free, no limits)',
  category:    'media',
  usage:       '.aivideo <prompt>',

  async execute({ sock, msg, jid, text, react, reply }) {
    const prompt = (text || '').trim();

    // ── No prompt — show usage ───────────────────────────────────────────────
    if (!prompt) {
      return reply(
        `🎬 *AI Video Generator*\n\n` +
        `_Text description se real AI video banao!_\n\n` +
        `*Usage:*\n` +
        `▸ *.aivideo* <prompt>\n\n` +
        `*Examples:*\n` +
        `▸ .aivideo a cat walking on a beach at sunset\n` +
        `▸ .aivideo snowfall in a forest, cinematic\n` +
        `▸ .aivideo a dragon flying over mountains\n\n` +
        `⏱️ _Generation time: ~2-4 minutes_\n` +
        `🆓 _Free — No API key needed_${FOOTER}`
      );
    }

    await react('🎬');

    // Send initial loading message
    let loadingMsg;
    try {
      loadingMsg = await sock.sendMessage(jid, {
        text: `🎬 *AI Video Generator*\n\n📝 Prompt: _${prompt}_\n\n${FRAMES[0]}\n\n_Please wait, yeh 2-4 minute le sakta hai..._${FOOTER}`,
      }, { quoted: msg });
    } catch { /* can't send loading msg, continue anyway */ }

    // Animate loading bar
    let frame = 0;
    const interval = setInterval(async () => {
      try {
        if (frame < FRAMES.length - 1) {
          frame++;
          await sock.sendMessage(jid, {
            edit: loadingMsg?.key,
            text: `🎬 *AI Video Generator*\n\n📝 Prompt: _${prompt}_\n\n${FRAMES[frame]}\n\n_Please wait, yeh 2-4 minute le sakta hai..._${FOOTER}`,
          });
        }
      } catch { /* ignore edit failures */ }
    }, 18000); // update every 18s

    try {
      // ── Connect to Hugging Face Wan2.1 model ──────────────────────────────
      const app = await Client.connect('Wan-AI/Wan2.1-T2V-1.3B-Diffusers', {
        hf_token: undefined, // free public space
      });

      const result = await app.predict('/predict', {
        prompt:               prompt,
        negative_prompt:      'low quality, blurry, static, watermark, text, deformed',
        aspect_ratio:         '16:9',
        num_inference_steps:  20,
      });

      clearInterval(interval);

      // Update loading message to 100%
      try {
        await sock.sendMessage(jid, {
          edit: loadingMsg?.key,
          text: `🎬 *AI Video Generator*\n\n📝 Prompt: _${prompt}_\n\n✅ Done [■■■■■■■■■■] 100%\n\n_Sending video..._${FOOTER}`,
        });
      } catch { /* ignore */ }

      // ── Get video file path ───────────────────────────────────────────────
      const tempVideoPath = result?.data?.[0]?.path || result?.data?.[0];
      if (!tempVideoPath) throw new Error('No video path returned');

      // Gradio returns a local temp path — copy to our temp dir
      if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
      const localPath = path.join(TEMP_DIR, `aivideo_${Date.now()}.mp4`);

      if (typeof tempVideoPath === 'string' && fs.existsSync(tempVideoPath)) {
        fs.copyFileSync(tempVideoPath, localPath);
      } else if (typeof tempVideoPath === 'string' && tempVideoPath.startsWith('http')) {
        // If it's a URL (remote Gradio space), download it
        const { default: axios } = await import('axios');
        const { data } = await axios.get(tempVideoPath, { responseType: 'arraybuffer', timeout: 60000 });
        fs.writeFileSync(localPath, Buffer.from(data));
      } else {
        throw new Error('Cannot read video from result');
      }

      // ── Send video ────────────────────────────────────────────────────────
      await sock.sendMessage(jid, {
        video:    fs.readFileSync(localPath),
        mimetype: 'video/mp4',
        caption:
          `🎬 *AI Video Generated!*\n\n` +
          `📝 *Prompt:* ${prompt}\n` +
          `✅ *Status:* Success!\n` +
          `🤖 *Model:* Wan2.1 T2V 1.3B${FOOTER}`,
      }, { quoted: msg });

      await react('✅');

      // Cleanup temp file
      try { fs.unlinkSync(localPath); } catch { /* ignore */ }

    } catch (err) {
      clearInterval(interval);
      console.error('[aivideo] Error:', err.message);

      // Update loading msg to show failure
      try {
        await sock.sendMessage(jid, {
          edit: loadingMsg?.key,
          text: `❌ *AI Video Failed*\n\n📝 Prompt: _${prompt}_\n\n❌ Failed [■■■■■□□□□□]\n\n_${err.message}_${FOOTER}`,
        });
      } catch { /* ignore */ }

      await react('❌');
      reply(
        `❌ *AI Video Generation Failed*\n\n` +
        `📝 Prompt: _${prompt}_\n\n` +
        `💡 *Tips:*\n` +
        `▸ Prompt simple rakho (English mein)\n` +
        `▸ Thodi der baad dobara try karo\n` +
        `▸ HuggingFace server busy ho sakta hai${FOOTER}`
      );
    }
  },
};
