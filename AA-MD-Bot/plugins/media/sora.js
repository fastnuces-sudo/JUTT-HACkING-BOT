// ============================================
// AA MD Bot - Sora AI Text-to-Video
// Generates a short AI video from a text prompt
// APIs tried in order until one succeeds.
// ============================================

import axios from 'axios';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const HEADERS = { 'User-Agent': UA, Accept: 'application/json, */*' };

// ── Try each API in order, return first working video URL ────────────────────
async function generateVideo(prompt) {
  const apis = [
    // 1. Okatsu (from reference code)
    async () => {
      const { data } = await axios.get(
        `https://okatsu-rolezapiiz.vercel.app/ai/txt2video?text=${encodeURIComponent(prompt)}`,
        { timeout: 90000, headers: HEADERS }
      );
      const url = data?.videoUrl || data?.result || data?.data?.videoUrl;
      if (!url) throw new Error('No video URL');
      return url;
    },
    // 2. Nexray
    async () => {
      const { data } = await axios.get(
        `https://api.nexray.web.id/ai/sora?prompt=${encodeURIComponent(prompt)}`,
        { timeout: 90000, headers: HEADERS }
      );
      const url = data?.result?.url || data?.url || data?.videoUrl;
      if (!url) throw new Error('No video URL');
      return url;
    },
    // 3. EliteProTech
    async () => {
      const { data } = await axios.get(
        `https://eliteprotech-apis.zone.id/ai/sora?prompt=${encodeURIComponent(prompt)}`,
        { timeout: 90000, headers: HEADERS }
      );
      const url = data?.result?.url || data?.url || data?.videoUrl;
      if (!url) throw new Error('No video URL');
      return url;
    },
    // 4. Princetechn
    async () => {
      const { data } = await axios.get(
        `https://api.princetechn.com/api/ai/sora?apikey=prince_tech_api_azfsbshfb&prompt=${encodeURIComponent(prompt)}`,
        { timeout: 90000, headers: HEADERS }
      );
      const url = data?.result?.url || data?.url || data?.videoUrl;
      if (!url) throw new Error('No video URL');
      return url;
    },
    // 5. Davidcyriltech
    async () => {
      const { data } = await axios.get(
        `https://apis.davidcyriltech.my.id/ai/sora?prompt=${encodeURIComponent(prompt)}`,
        { timeout: 90000, headers: HEADERS }
      );
      const url = data?.result?.url || data?.url || data?.videoUrl;
      if (!url) throw new Error('No video URL');
      return url;
    },
  ];

  for (const fn of apis) {
    try {
      const url = await fn();
      if (url && typeof url === 'string' && url.startsWith('http')) return url;
    } catch {}
  }
  return null;
}

// Download video URL as buffer
async function downloadVideoBuffer(url) {
  const res = await axios.get(url, {
    timeout: 90000,
    responseType: 'arraybuffer',
    headers: HEADERS,
  });
  return Buffer.from(res.data);
}

export default {
  command: 'sora',
  alias: ['txt2video', 'text2video', 'videogen', 'aivideo'],
  description: 'Generate an AI video from a text prompt using Sora AI',
  category: 'media',

  async execute({ sock, jid, msg, args, reply, react }) {
    // Get prompt from args OR quoted text
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
    const prompt = args.join(' ').trim() || quotedText.trim();

    if (!prompt) {
      return reply(
        `🎬 *Sora AI Video Generator*\n\n` +
        `Generate a short AI video from any text prompt.\n\n` +
        `*Usage:*\n` +
        `▸ *.sora anime girl walking in rain*\n` +
        `▸ *.sora sunset over mountains with birds flying*\n` +
        `▸ *.sora a cat playing piano*\n\n` +
        `*Aliases:* .txt2video .videogen .aivideo\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    await react('⏳');
    await reply(`🎬 *Generating video...*\n\n_Prompt: ${prompt}_\n\nThis may take 30–90 seconds ⏱️`);

    try {
      const videoUrl = await generateVideo(prompt);

      if (!videoUrl) {
        await react('❌');
        return reply(
          `❌ *Video generation failed.*\n\n` +
          `The AI video service is temporarily unavailable.\n` +
          `Please try again later.\n\n` +
          `> 🤖 *AA MD Bot*`
        );
      }

      // Download buffer so WhatsApp can play it reliably
      await react('📥');
      const videoBuf = await downloadVideoBuffer(videoUrl);

      if (!videoBuf?.length || videoBuf.length < 10000) {
        throw new Error('Downloaded video too small');
      }

      await sock.sendMessage(jid, {
        video: videoBuf,
        mimetype: 'video/mp4',
        caption:
          `🎬 *AI Generated Video*\n\n` +
          `📝 *Prompt:* ${prompt}\n\n` +
          `> 🤖 *AA MD Bot*`,
      }, { quoted: msg });

      await react('✅');

    } catch (err) {
      await react('❌');
      reply(
        `❌ *Video generation failed.*\n\n` +
        `${err.message?.includes('402') ? 'Service requires payment — trying others.' : 'Service temporarily unavailable.'}\n` +
        `Please try again later.\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }
  },
};
