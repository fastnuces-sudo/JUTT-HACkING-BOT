// ============================================
// AA MD Bot - Telegram Features Bot
// Token: TELEGRAM_FEATURES_BOT_TOKEN
//
// Commands:
//   /start      — welcome
//   /help       — command list
//   /play       — YouTube audio (MP3)
//   /video      — YouTube video (MP4)
//   /tiktok     — TikTok download
//   /fb         — Facebook download
//   /weather    — Weather info
//   /ai         — AI chat
//   /lyrics     — Song lyrics
//   /translate  — Translate text
//   /sticker    — Convert image URL to sticker
// ============================================

import TelegramBot from 'node-telegram-bot-api';
import axios       from 'axios';
import { logger }  from './logger.js';

const TOKEN = process.env.TELEGRAM_FEATURES_BOT_TOKEN;

// ── Helpers ────────────────────────────────────────────────────────────────────
const YTID_RX = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/;
const TT_RX   = /https?:\/\/(www\.)?(vm\.|vt\.|m\.)?tiktok\.com\/\S+/i;
const FB_RX   = /https?:\/\/(www\.|m\.|web\.)?facebook\.com\/\S+|https?:\/\/fb\.watch\/\S+/i;

async function ytSearch(query) {
  // Use invidious to find first result
  const apis = [
    'https://invidious.nikkosphere.com',
    'https://inv.nadeko.net',
    'https://invidious.privacyredirect.com',
  ];
  for (const base of apis) {
    try {
      const { data } = await axios.get(`${base}/api/v1/search`, {
        params: { q: query, type: 'video', page: 1 },
        timeout: 8000,
      });
      if (data?.[0]?.videoId) return { videoId: data[0].videoId, title: data[0].title, author: data[0].author };
    } catch {}
  }
  return null;
}

async function ytAudioUrl(videoId) {
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
  // Try davidcyriltech
  try {
    const { data } = await axios.get(
      `https://apis.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(ytUrl)}`,
      { timeout: 25000 }
    );
    const u = data?.result?.download_url || data?.result?.downloadUrl || data?.result?.url;
    if (u) return u;
  } catch {}
  // Try nexray
  try {
    const { data } = await axios.get(
      `https://yt-api.p.rapidapi.com/dl?id=${videoId}&cgeo=US`,
      { headers: { 'x-rapidapi-host': 'yt-api.p.rapidapi.com' }, timeout: 15000 }
    );
    const link = data?.link || data?.url;
    if (link) return link;
  } catch {}
  return null;
}

async function ytVideoUrl(videoId) {
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const { data } = await axios.get(
      `https://apis.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(ytUrl)}`,
      { timeout: 25000 }
    );
    const u = data?.result?.download_url || data?.result?.downloadUrl || data?.result?.url;
    if (u) return u;
  } catch {}
  return null;
}

async function tikwmData(url) {
  const { data } = await axios.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    timeout: 20000,
  });
  if (data.code !== 0 || !data.data) throw new Error('tikwm failed');
  return data.data;
}

async function fbVideoUrl(url) {
  // Try fdownloader
  try {
    const res = await axios.post(
      'https://fdownloader.net/api/ajaxSearch',
      `q=${encodeURIComponent(url)}&lang=en&web=facebook`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: 'https://fdownloader.net/',
        },
        timeout: 15000,
      }
    );
    const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const m = html.match(/href=["'](https?:\/\/[^"']*video[^"']*)/i);
    if (m?.[1]) return m[1];
  } catch {}
  return null;
}

async function weatherData(city) {
  const { data } = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, {
    timeout: 10000,
    headers: { Accept: 'application/json' },
  });
  const cur = data?.current_condition?.[0];
  if (!cur) throw new Error('no data');
  return {
    city:    data?.nearest_area?.[0]?.areaName?.[0]?.value || city,
    temp_c:  cur.temp_C,
    temp_f:  cur.temp_F,
    feels:   cur.FeelsLikeC,
    humidity: cur.humidity,
    desc:    cur.weatherDesc?.[0]?.value || '?',
    wind:    cur.windspeedKmph,
  };
}

async function aiReply(text) {
  const { data } = await axios.post('https://text.pollinations.ai/openai', {
    model: 'openai',
    messages: [
      { role: 'system', content: 'You are a helpful assistant. Reply concisely and clearly. No markdown.' },
      { role: 'user',   content: text },
    ],
    temperature: 0.7,
    max_tokens: 400,
  }, { headers: { 'Content-Type': 'application/json' }, timeout: 25000 });
  return data?.choices?.[0]?.message?.content?.trim() || 'No response.';
}

async function translateText(text, targetLang = 'en') {
  const { data } = await axios.get(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${targetLang}`,
    { timeout: 10000 }
  );
  return data?.responseData?.translatedText || null;
}

// ── Main init ──────────────────────────────────────────────────────────────────
export function initTelegramFeatures() {
  if (!TOKEN) {
    logger.warn('⚡ TELEGRAM_FEATURES_BOT_TOKEN not set — Telegram features bot disabled');
    return;
  }

  const bot = new TelegramBot(TOKEN, { polling: true });

  const typing = (chatId) => bot.sendChatAction(chatId, 'typing').catch(() => {});
  const uploading = (chatId, type = 'upload_document') =>
    bot.sendChatAction(chatId, type).catch(() => {});

  // ── /start ─────────────────────────────────────────────────────────────────
  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
      `🤖 *AA MD Bot — Features*\n\n` +
      `WhatsApp bot features right here on Telegram!\n\n` +
      `Use /help to see all available commands.`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  });

  // ── /help ──────────────────────────────────────────────────────────────────
  bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
      `📋 *AA MD Bot Features*\n\n` +
      `🎵 *Music & Video*\n` +
      `/play <song name> — Download YouTube MP3\n` +
      `/video <song/video> — Download YouTube MP4\n` +
      `/tiktok <url> — Download TikTok video\n` +
      `/fb <url> — Download Facebook video\n\n` +
      `🌐 *Utilities*\n` +
      `/weather <city> — Current weather\n` +
      `/translate <text> — Translate to English\n` +
      `/lyrics <song> — Song lyrics\n\n` +
      `🤖 *AI*\n` +
      `/ai <question> — Ask AI anything\n\n` +
      `📌 *Tips:*\n` +
      `• For YouTube, paste a URL or just search by name\n` +
      `• /translate en: Hi how are you — translate to English\n` +
      `• /translate ur: Hello — translate to Urdu`,
      { parse_mode: 'Markdown' }
    ).catch(() => {});
  });

  // ── /play <query|url> — YouTube MP3 ───────────────────────────────────────
  bot.onText(/\/play(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query  = (match[1] || '').trim();
    if (!query) return bot.sendMessage(chatId, '❌ Usage: /play <song name or YouTube URL>');

    await uploading(chatId, 'upload_voice');
    try {
      let videoId;
      const ytMatch = query.match(YTID_RX);
      if (ytMatch) {
        videoId = ytMatch[1];
      } else {
        const result = await ytSearch(query);
        if (!result) return bot.sendMessage(chatId, '❌ No results found for: ' + query);
        videoId = result.videoId;
        await bot.sendMessage(chatId, `🎵 Found: *${result.title}*\nDownloading...`, { parse_mode: 'Markdown' });
      }

      const audioUrl = await ytAudioUrl(videoId);
      if (!audioUrl) return bot.sendMessage(chatId, '❌ Could not download audio. Try again later.');

      await bot.sendAudio(chatId, audioUrl, { caption: `🎵 *AA MD Bot*`, parse_mode: 'Markdown' });
    } catch (e) {
      bot.sendMessage(chatId, `❌ Download failed: ${e.message}`).catch(() => {});
    }
  });

  // ── /video <query|url> — YouTube MP4 ──────────────────────────────────────
  bot.onText(/\/video(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query  = (match[1] || '').trim();
    if (!query) return bot.sendMessage(chatId, '❌ Usage: /video <video name or YouTube URL>');

    await uploading(chatId, 'upload_video');
    try {
      let videoId, title = query;
      const ytMatch = query.match(YTID_RX);
      if (ytMatch) {
        videoId = ytMatch[1];
      } else {
        const result = await ytSearch(query);
        if (!result) return bot.sendMessage(chatId, '❌ No results found for: ' + query);
        videoId = result.videoId;
        title   = result.title;
        await bot.sendMessage(chatId, `🎬 Found: *${title}*\nDownloading...`, { parse_mode: 'Markdown' });
      }

      const videoUrl = await ytVideoUrl(videoId);
      if (!videoUrl) return bot.sendMessage(chatId, '❌ Could not download video. Try again or use /play for audio.');

      await bot.sendVideo(chatId, videoUrl, { caption: `🎬 *${title}*\n\n> 🤖 AA MD Bot`, parse_mode: 'Markdown' });
    } catch (e) {
      bot.sendMessage(chatId, `❌ Download failed: ${e.message}`).catch(() => {});
    }
  });

  // ── /tiktok <url> ──────────────────────────────────────────────────────────
  bot.onText(/\/tiktok(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url    = (match[1] || '').trim();
    if (!url || !TT_RX.test(url)) return bot.sendMessage(chatId, '❌ Usage: /tiktok <TikTok URL>');

    await uploading(chatId, 'upload_video');
    try {
      const d = await tikwmData(url);
      if (d.images?.length) {
        for (const img of d.images.slice(0, 5)) {
          await bot.sendPhoto(chatId, img).catch(() => {});
        }
        bot.sendMessage(chatId, `🎵 @${d.author?.unique_id || 'unknown'} | ❤️ ${d.digg_count || 0}\n\n> 🤖 AA MD Bot`);
      } else if (d.play) {
        await bot.sendVideo(chatId, d.play, {
          caption: `🎵 @${d.author?.unique_id || 'unknown'} | ❤️ ${(d.digg_count||0).toLocaleString()}\n\n> 🤖 AA MD Bot`,
        });
      } else {
        bot.sendMessage(chatId, '❌ Could not extract video.');
      }
    } catch (e) {
      bot.sendMessage(chatId, `❌ TikTok download failed: ${e.message}`).catch(() => {});
    }
  });

  // ── /fb <url> ──────────────────────────────────────────────────────────────
  bot.onText(/\/fb(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url    = (match[1] || '').trim();
    if (!url || !FB_RX.test(url)) return bot.sendMessage(chatId, '❌ Usage: /fb <Facebook video URL>');

    await uploading(chatId, 'upload_video');
    try {
      const videoUrl = await fbVideoUrl(url);
      if (!videoUrl) return bot.sendMessage(chatId, '❌ Could not download. Make sure the post is public.');
      await bot.sendVideo(chatId, videoUrl, { caption: `📘 Facebook\n\n> 🤖 AA MD Bot` });
    } catch (e) {
      bot.sendMessage(chatId, `❌ Facebook download failed: ${e.message}`).catch(() => {});
    }
  });

  // ── /weather <city> ────────────────────────────────────────────────────────
  bot.onText(/\/weather(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const city   = (match[1] || '').trim();
    if (!city) return bot.sendMessage(chatId, '❌ Usage: /weather <city name>');

    await typing(chatId);
    try {
      const w = await weatherData(city);
      bot.sendMessage(chatId,
        `🌤 *Weather — ${w.city}*\n\n` +
        `🌡 Temp: ${w.temp_c}°C / ${w.temp_f}°F\n` +
        `🤔 Feels like: ${w.feels}°C\n` +
        `☁️ Condition: ${w.desc}\n` +
        `💧 Humidity: ${w.humidity}%\n` +
        `💨 Wind: ${w.wind} km/h\n\n` +
        `> 🤖 AA MD Bot`,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    } catch (e) {
      bot.sendMessage(chatId, `❌ Weather data not found for "${city}". Check the city name.`).catch(() => {});
    }
  });

  // ── /ai <question> ─────────────────────────────────────────────────────────
  bot.onText(/\/ai(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const text   = (match[1] || '').trim();
    if (!text) return bot.sendMessage(chatId, '❌ Usage: /ai <your question>');

    await typing(chatId);
    try {
      const reply = await aiReply(text);
      bot.sendMessage(chatId, `🤖 ${reply}\n\n_Powered by AA MD Bot AI_`).catch(() => {});
    } catch (e) {
      bot.sendMessage(chatId, `❌ AI error: ${e.message}`).catch(() => {});
    }
  });

  // ── /translate <text> ──────────────────────────────────────────────────────
  bot.onText(/\/translate(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    let input    = (match[1] || '').trim();
    if (!input) return bot.sendMessage(chatId, '❌ Usage: /translate <text>\nOptional: /translate ur: Hello (translate to Urdu)');

    await typing(chatId);
    let targetLang = 'en';
    if (/^[a-z]{2}:\s*/i.test(input)) {
      targetLang = input.slice(0, 2).toLowerCase();
      input      = input.slice(input.indexOf(':') + 1).trim();
    }
    try {
      const result = await translateText(input, targetLang);
      if (!result) return bot.sendMessage(chatId, '❌ Translation failed.');
      bot.sendMessage(chatId, `🌐 *Translation* (→ ${targetLang.toUpperCase()})\n\n${result}\n\n> 🤖 AA MD Bot`, { parse_mode: 'Markdown' }).catch(() => {});
    } catch (e) {
      bot.sendMessage(chatId, `❌ Translation error: ${e.message}`).catch(() => {});
    }
  });

  // ── /lyrics <song> ────────────────────────────────────────────────────────
  bot.onText(/\/lyrics(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query  = (match[1] || '').trim();
    if (!query) return bot.sendMessage(chatId, '❌ Usage: /lyrics <song name>');

    await typing(chatId);
    try {
      const { data } = await axios.get(
        `https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`,
        { timeout: 10000 }
      );
      const song = data?.data?.[0];
      if (!song) return bot.sendMessage(chatId, `❌ Lyrics not found for "${query}"`);

      const { data: lyricsData } = await axios.get(
        `https://api.lyrics.ovh/v1/${encodeURIComponent(song.artist.name)}/${encodeURIComponent(song.title)}`,
        { timeout: 10000 }
      );
      const lyrics = lyricsData?.lyrics?.slice(0, 3800);
      if (!lyrics) return bot.sendMessage(chatId, `❌ Lyrics not available for "${song.title}"`);

      bot.sendMessage(chatId,
        `🎵 *${song.title}*\n👤 ${song.artist.name}\n\n${lyrics}\n\n> 🤖 AA MD Bot`,
        { parse_mode: 'Markdown' }
      ).catch(() => {});
    } catch (e) {
      bot.sendMessage(chatId, `❌ Lyrics error: ${e.message}`).catch(() => {});
    }
  });

  // ── Unknown commands ───────────────────────────────────────────────────────
  bot.on('message', (msg) => {
    if (msg.text?.startsWith('/') &&
        !msg.text.match(/^\/(start|help|play|video|tiktok|fb|weather|ai|translate|lyrics)/)) {
      bot.sendMessage(msg.chat.id, `❓ Unknown command. Use /help to see all commands.`).catch(() => {});
    }
  });

  bot.on('polling_error', (err) => {
    logger.warn({ err: err.message }, '🤖 Telegram features bot polling error');
  });

  logger.info('🤖 Telegram features bot started');
  return bot;
}
