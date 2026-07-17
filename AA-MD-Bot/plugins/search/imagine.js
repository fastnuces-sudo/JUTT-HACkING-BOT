// ============================================
// AA MD Bot - AI Image Generator (Powerful Edition)
// Features:
//   • Auto prompt enhancement via AI
//   • 4 model styles: flux, flux-realism, flux-anime, turbo
//   • Smart aspect ratio detection (portrait/landscape/square)
//   • Style flags: --real, --anime, --fast, --portrait, --wide
//   • Free, no API key needed
// ============================================

import axios from 'axios';

const CHAT_URL  = 'https://text.pollinations.ai/openai';
const IMAGE_URL = 'https://image.pollinations.ai/prompt';

// ── Models ───────────────────────────────────────────────────────────────────
const MODELS = {
  flux:         { id: 'flux',          label: 'Quality',   emoji: '✨' },
  realistic:    { id: 'flux-realism',  label: 'Realistic', emoji: '📸' },
  anime:        { id: 'flux-anime',    label: 'Anime',     emoji: '🎌' },
  fast:         { id: 'turbo',         label: 'Fast',      emoji: '⚡' },
};

// ── Parse flags from user prompt ─────────────────────────────────────────────
function parseFlags(text) {
  const flags = {
    model: 'flux',
    width:  1024,
    height: 1024,
    ratio: 'square',
  };

  let clean = text;

  // Model flags
  if (/--real(istic)?/i.test(clean))   { flags.model = 'realistic'; clean = clean.replace(/--real(istic)?/gi, ''); }
  else if (/--anime/i.test(clean))      { flags.model = 'anime';     clean = clean.replace(/--anime/gi, ''); }
  else if (/--fast/i.test(clean))       { flags.model = 'fast';      clean = clean.replace(/--fast/gi, ''); }

  // Aspect ratio flags
  if (/--portrait|--port/i.test(clean)) {
    flags.width = 832; flags.height = 1216; flags.ratio = 'portrait';
    clean = clean.replace(/--portrait|--port/gi, '');
  } else if (/--wide|--landscape/i.test(clean)) {
    flags.width = 1216; flags.height = 832; flags.ratio = 'landscape';
    clean = clean.replace(/--wide|--landscape/gi, '');
  }

  // Auto-detect aspect ratio from keywords if no flag given
  if (flags.ratio === 'square') {
    if (/\b(portrait|face|selfie|headshot|person|girl|boy|man|woman|character)\b/i.test(clean)) {
      flags.width = 832; flags.height = 1216; flags.ratio = 'portrait';
    } else if (/\b(landscape|panorama|wide|mountain|city|skyline|horizon|banner)\b/i.test(clean)) {
      flags.width = 1216; flags.height = 832; flags.ratio = 'landscape';
    }
  }

  flags.prompt = clean.trim();
  return flags;
}

// ── AI Prompt Enhancer ───────────────────────────────────────────────────────
async function enhancePrompt(userPrompt, model) {
  const styleHints = {
    flux:       'high quality digital art, highly detailed, 8K resolution, professional lighting, cinematic composition',
    realistic:  'photorealistic, ultra-realistic photography, DSLR, RAW photo, perfect exposure, shallow depth of field, Canon EOS R5',
    anime:      'anime art style, Studio Ghibli quality, vibrant colors, detailed linework, manga illustration',
    fast:       'digital art, colorful, detailed',
  };

  const styleHint = styleHints[model] || styleHints.flux;

  const systemMsg = `You are an expert AI art prompt engineer. Your job is to take a simple user description and expand it into a detailed, vivid image generation prompt.

Rules:
- Expand the description with visual details: lighting, colors, textures, mood, atmosphere, style
- Add quality keywords: "${styleHint}"
- Keep it under 120 words
- Output ONLY the enhanced prompt — no explanation, no quotes, no extra text
- Do NOT add NSFW content`;

  try {
    const { data } = await axios.post(CHAT_URL, {
      model: 'openai',
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user',   content: `Enhance this prompt: "${userPrompt}"` },
      ],
      temperature: 0.8,
      max_tokens: 200,
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 15000 });

    const enhanced = data?.choices?.[0]?.message?.content?.trim();
    return (enhanced && enhanced.length > userPrompt.length) ? enhanced : userPrompt;
  } catch {
    return userPrompt; // fall back to original if enhancer fails
  }
}

// ── Build image URL ──────────────────────────────────────────────────────────
function buildImageUrl(prompt, { model, width, height }) {
  const m = MODELS[model] || MODELS.flux;
  const seed = Math.floor(Math.random() * 9999999);
  return `${IMAGE_URL}/${encodeURIComponent(prompt)}?width=${width}&height=${height}&model=${m.id}&seed=${seed}&nologo=true&enhance=false`;
}

// ── Help text ────────────────────────────────────────────────────────────────
function helpText(prefix) {
  return (
    `🎨 *AI Image Generator — Powered*\n\n` +
    `*Usage:* ${prefix}imagine <description>\n\n` +
    `*Examples:*\n` +
    `• ${prefix}imagine Pakistani village at golden hour\n` +
    `• ${prefix}imagine anime girl in cherry blossom forest\n` +
    `• ${prefix}imagine futuristic Karachi city at night\n\n` +
    `*Style Flags (add to your prompt):*\n` +
    `• \`--real\` — 📸 Photorealistic (DSLR quality)\n` +
    `• \`--anime\` — 🎌 Anime/manga style\n` +
    `• \`--fast\` — ⚡ Fast generation\n` +
    `• \`--portrait\` — 🖼 Tall/portrait ratio\n` +
    `• \`--wide\` — 🌄 Wide/landscape ratio\n\n` +
    `*Examples with flags:*\n` +
    `• ${prefix}imagine lion in savanna --real\n` +
    `• ${prefix}imagine ninja warrior --anime --portrait\n\n` +
    `✨ *AI auto-enhances your prompt for best results*\n\n` +
    `> 🎨 *AA MD Bot*`
  );
}

export default {
  command: 'imagine',
  alias: ['imgen', 'aiimage', 'aimg', 'genimage', 'dalle', 'txt2img'],
  description: 'Powerful AI image generator — auto-enhanced prompts, 4 model styles',
  category: 'search',

  async execute({ text, reply, react, sock, jid, msg, prefix }) {
    if (!text) return reply(helpText(prefix));

    await react('🎨');

    const flags = parseFlags(text);

    if (!flags.prompt) return reply(helpText(prefix));

    const modelInfo = MODELS[flags.model] || MODELS.flux;

    try {
      // Step 1: Enhance the prompt via AI
      await react('✨');
      const enhanced = await enhancePrompt(flags.prompt, flags.model);

      // Step 2: Build URL and fetch image
      const url = buildImageUrl(enhanced, flags);
      const { data: imgBuf } = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 90000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      // Step 3: Send
      const ratioLabel = flags.ratio === 'portrait' ? '🖼 Portrait' : flags.ratio === 'landscape' ? '🌄 Landscape' : '⬛ Square';

      await sock.sendMessage(jid, {
        image: Buffer.from(imgBuf),
        caption:
          `🎨 *AI Generated Image*\n\n` +
          `📝 *Prompt:* _${flags.prompt.substring(0, 80)}${flags.prompt.length > 80 ? '…' : ''}_\n` +
          `${modelInfo.emoji} *Style:* ${modelInfo.label}  •  ${ratioLabel}\n\n` +
          `> 🎨 *AA MD Bot*`,
      }, { quoted: msg });

      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *Image generation failed*\n\n${e.message}\n\nTry a simpler description or use \`--fast\` flag.\n\n> 🎨 *AA MD Bot*`);
    }
  },
};
