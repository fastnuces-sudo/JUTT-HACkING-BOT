// ============================================
// AA MD Bot - AI Video Generator
// Developer: Ahsan Ali | AA Mods
//
// Commands:
//   .aivideo <prompt>   — Generate AI video from text
//   .aivid <prompt>     — short alias
//   .videogen <prompt>  — alternate alias
//
// Fallback chain (auto — tries each in order):
//   1. ZeroScope v2     (hysts/zeroscope-v2)            — fast, works globally
//   2. AnimateDiff ⚡   (ByteDance/AnimateDiff-Lightning) — fast GIF, works globally
//   3. Wan2.1 T2V 1.3B  (Wan-AI/Wan2.1-T2V-1.3B)        — high quality
//   4. LTX-Video        (Lightricks/LTX-Video)            — alternate high quality
// ============================================

import { Client } from "@gradio/client";
import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.join(__dirname, "../../temp");

const FOOTER = "\n\n> 🤖 *AA MD Bot*  •  👨‍💻 *Ahsan Ali Wadani*";

// ── Progress bar frames ───────────────────────────────────────────────────────
const FRAMES = [
  "⬛⬜⬜⬜⬜⬜⬜⬜⬜⬜  10%",
  "⬛⬛⬜⬜⬜⬜⬜⬜⬜⬜  20%",
  "⬛⬛⬛⬜⬜⬜⬜⬜⬜⬜  30%",
  "⬛⬛⬛⬛⬜⬜⬜⬜⬜⬜  40%",
  "⬛⬛⬛⬛⬛⬜⬜⬜⬜⬜  50%",
  "⬛⬛⬛⬛⬛⬛⬜⬜⬜⬜  60%",
  "⬛⬛⬛⬛⬛⬛⬛⬜⬜⬜  70%",
  "⬛⬛⬛⬛⬛⬛⬛⬛⬜⬜  80%",
  "⬛⬛⬛⬛⬛⬛⬛⬛⬛⬜  90%",
  "⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛ 100%",
];

// ── Extract URL/path from Gradio result ───────────────────────────────────────
function extractFromResult(result) {
  const item = result?.data?.[0];
  if (!item) return null;
  if (item?.url) return { url: item.url, name: item.orig_name || "video" };
  if (item?.path)
    return { localPath: item.path, name: item.orig_name || "video" };
  if (typeof item === "string" && item.startsWith("http"))
    return { url: item, name: "video" };
  if (item?.name)
    return {
      url: item.name.startsWith("http") ? item.name : null,
      localPath: item.name,
      name: "video",
    };
  return null;
}

// ── Download file to local temp path ─────────────────────────────────────────
async function download(urlOrPath, destPath) {
  if (urlOrPath.startsWith("http")) {
    const { data } = await axios.get(urlOrPath, {
      responseType: "arraybuffer",
      timeout: 90000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    fs.writeFileSync(destPath, Buffer.from(data));
  } else if (fs.existsSync(urlOrPath)) {
    fs.copyFileSync(urlOrPath, destPath);
  } else {
    throw new Error(`Cannot read file: ${urlOrPath}`);
  }
}

// ── Model 1: ZeroScope v2 (fast, works globally) ─────────────────────────────
async function tryZeroscope(prompt) {
  const app = await Client.connect("hysts/zeroscope-v2");
  const result = await app.predict("/run", {
    prompt,
    seed: Math.floor(Math.random() * 2147483647),
    num_frames: 24,
    num_inference_steps: 25,
  });
  const file = extractFromResult(result);
  if (!file) throw new Error("No output from ZeroScope");
  return { ...file, model: "ZeroScope v2", mime: "video/mp4", ext: "mp4" };
}

// ── Model 2: AnimateDiff-Lightning (fast animated GIF, works globally) ────────
async function tryAnimateDiff(prompt) {
  const app = await Client.connect("ByteDance/AnimateDiff-Lightning");
  const result = await app.predict("/generate_image", {
    prompt,
    base: "epiCrealism",
    motion: "",
    step: 4,
  });
  const file = extractFromResult(result);
  if (!file) throw new Error("No output from AnimateDiff");
  return {
    ...file,
    model: "AnimateDiff-Lightning",
    mime: "video/mp4",
    ext: "mp4",
    isGif: true,
  };
}

// ── Model 3: Wan2.1 T2V 1.3B (high quality) ──────────────────────────────────
async function tryWan21(prompt) {
  const app = await Client.connect("Wan-AI/Wan2.1-T2V-1.3B-Diffusers");
  const result = await app.predict("/predict", {
    prompt,
    negative_prompt: "low quality, blurry, static, watermark, text, deformed",
    aspect_ratio: "16:9",
    num_inference_steps: 20,
  });
  const file = extractFromResult(result);
  if (!file) throw new Error("No output from Wan2.1");
  return { ...file, model: "Wan2.1 T2V", mime: "video/mp4", ext: "mp4" };
}

// ── Model 4: LTX-Video (alternate high quality) ───────────────────────────────
async function tryLTX(prompt) {
  const app = await Client.connect("Lightricks/LTX-Video");
  const info = await app.view_api().catch(() => null);
  const eps = Object.keys(info?.named_endpoints || {});
  const ep =
    eps.find(
      (e) =>
        e.includes("generate") || e.includes("predict") || e.includes("run"),
    ) || eps[0];
  if (!ep) throw new Error("No usable endpoint on LTX-Video");
  const result = await app.predict(ep, { prompt });
  const file = extractFromResult(result);
  if (!file) throw new Error("No output from LTX-Video");
  return { ...file, model: "LTX-Video", mime: "video/mp4", ext: "mp4" };
}

// ── Ordered fallback chain ────────────────────────────────────────────────────
const MODELS = [
  { name: "ZeroScope v2", fn: tryZeroscope },
  { name: "AnimateDiff-Lightning", fn: tryAnimateDiff },
  { name: "Wan2.1 T2V", fn: tryWan21 },
  { name: "LTX-Video", fn: tryLTX },
];

// ── Plugin ────────────────────────────────────────────────────────────────────
export default {
  command: "aivideo",
  alias: ["aivid", "videogen", "makevideo"],
  description: "Generate AI video from text — 4 model fallback chain",
  category: "media",
  usage: ".aivideo <your prompt in English>",

  async execute({ sock, msg, jid, text, react, reply }) {
    let interval;
    let loadingMsg;

    // Everything is wrapped in a single try/catch to ensure
    // any unexpected error doesn't silently crash the entire function
    // and the user always gets some response.
    try {
      const prompt = (text || "").trim();

      if (!prompt) {
        await reply(
          `🎬 *AI Video Generator*\n\n` +
            `_Write your idea — AI will create a video!_\n\n` +
            `*Usage:*\n` +
            `▸ *.aivideo* <English prompt>\n\n` +
            `*Examples:*\n` +
            `▸ .aivideo a cat walking on a beach at sunset\n` +
            `▸ .aivideo snowfall in a forest, cinematic slow motion\n` +
            `▸ .aivideo a dragon flying over mountains at night\n` +
            `▸ .aivideo waves crashing on rocks, 4K\n\n` +
            `*Models (auto fallback):*\n` +
            `1️⃣ ZeroScope v2\n` +
            `2️⃣ AnimateDiff-Lightning\n` +
            `3️⃣ Wan2.1 T2V 1.3B\n` +
            `4️⃣ LTX-Video\n\n` +
            `⏱️ _Time: 1-4 minutes depending on model_\n` +
            `🆓 _Free — No API key needed_${FOOTER}`,
        );
        return;
      }

      try {
        await react("🎬");
      } catch {
        /* ignore */
      }

      let currentModel = MODELS[0].name;

      const makeLoadingText = (frame, modelName) =>
        `🎬 *AI Video Generator*\n\n` +
        `📝 *Prompt:* _${prompt.slice(0, 80)}${prompt.length > 80 ? "..." : ""}_\n` +
        `🤖 *Model:* ${modelName}\n\n` +
        `${FRAMES[frame]}\n\n` +
        `_Please wait, may take 1-4 minutes..._${FOOTER}`;

      try {
        loadingMsg = await sock.sendMessage(
          jid,
          {
            text: makeLoadingText(0, currentModel),
          },
          { quoted: msg },
        );
      } catch (e) {
        console.error("[aivideo] Failed to send loading message:", e.message);
      }

      // Animate loading bar
      let frame = 0;
      interval = setInterval(async () => {
        try {
          if (frame < FRAMES.length - 2) {
            frame++;
            await sock.sendMessage(jid, {
              edit: loadingMsg?.key,
              text: makeLoadingText(frame, currentModel),
            });
          }
        } catch {
          /* ignore */
        }
      }, 15000);

      try {
        if (!fs.existsSync(TEMP_DIR))
          fs.mkdirSync(TEMP_DIR, { recursive: true });
      } catch (e) {
        console.error("[aivideo] Could not create temp dir:", e.message);
      }

      let lastError = null;
      let success = false;

      for (const model of MODELS) {
        try {
          currentModel = model.name;

          try {
            await sock.sendMessage(jid, {
              edit: loadingMsg?.key,
              text: makeLoadingText(frame, currentModel),
            });
          } catch {
            /* ignore */
          }

          const fileInfo = await model.fn(prompt);
          const localPath = path.join(
            TEMP_DIR,
            `aivideo_${Date.now()}.${fileInfo.ext}`,
          );

          const src = fileInfo.url || fileInfo.localPath;
          if (!src) throw new Error("No source URL/path in result");
          await download(src, localPath);

          const size = fs.statSync(localPath).size;
          if (size < 1000)
            throw new Error(`File too small (${size} bytes) — likely empty`);

          clearInterval(interval);

          try {
            await sock.sendMessage(jid, {
              edit: loadingMsg?.key,
              text:
                `🎬 *AI Video Generator*\n\n` +
                `📝 *Prompt:* _${prompt.slice(0, 80)}${prompt.length > 80 ? "..." : ""}_\n` +
                `🤖 *Model:* ${model.name}\n\n` +
                `${FRAMES[9]}\n\n` +
                `_Sending video..._${FOOTER}`,
            });
          } catch {
            /* ignore */
          }

          if (fileInfo.isGif) {
            await sock.sendMessage(
              jid,
              {
                video: fs.readFileSync(localPath),
                mimetype: "video/mp4",
                caption:
                  `🎬 *AI Video Generated!*\n\n` +
                  `📝 *Prompt:* ${prompt}\n` +
                  `🤖 *Model:* ${model.name} (animated)\n` +
                  `✅ *Status:* Success!${FOOTER}`,
                gifPlayback: true,
              },
              { quoted: msg },
            );
          } else {
            await sock.sendMessage(
              jid,
              {
                video: fs.readFileSync(localPath),
                mimetype: "video/mp4",
                caption:
                  `🎬 *AI Video Generated!*\n\n` +
                  `📝 *Prompt:* ${prompt}\n` +
                  `🤖 *Model:* ${model.name}\n` +
                  `✅ *Status:* Success!${FOOTER}`,
              },
              { quoted: msg },
            );
          }

          try {
            await react("✅");
          } catch {
            /* ignore */
          }
          success = true;

          try {
            fs.unlinkSync(localPath);
          } catch {
            /* ignore */
          }
          break;
        } catch (err) {
          lastError = err;
          console.error(`[aivideo] ${model.name} failed:`, err.message);
        }
      }

      if (!success) {
        console.error(
          "[aivideo] All models failed. Last error:",
          lastError?.message,
        );

        try {
          await sock.sendMessage(jid, {
            edit: loadingMsg?.key,
            text: `❌ *AI Video Failed*\n\nAll models failed.\n\n_${lastError?.message?.slice(0, 100) || "Unknown error"}_${FOOTER}`,
          });
        } catch {
          /* ignore */
        }

        try {
          await react("❌");
        } catch {
          /* ignore */
        }
        await reply(
          `❌ *AI Video Generation Failed*\n\n` +
            `📝 Prompt: _${prompt}_\n\n` +
            `💡 *Tips:*\n` +
            `▸ Write your prompt in English\n` +
            `▸ Give a simple, clear description\n` +
            `▸ Try again after some time\n` +
            `▸ AI servers might be busy sometimes${FOOTER}`,
        );
      }
    } catch (fatalErr) {
      // This is a new safety net — not present in the previous code,
      // so any unexpected crash would result in "no response".
      console.error("[aivideo] FATAL ERROR:", fatalErr);
      try {
        await reply(
          `❌ *Unexpected Error*\n\n_${fatalErr.message?.slice(0, 150) || "Unknown error"}_\n\n` +
            `Check console log or try again.${FOOTER}`,
        );
      } catch {
        /* ignore */
      }
    } finally {
      if (interval) clearInterval(interval);
    }
  },
};
