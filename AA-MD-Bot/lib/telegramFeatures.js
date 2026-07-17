// ============================================
// AA MD Bot - Telegram Features Bot
// Token: TELEGRAM_FEATURES_BOT_TOKEN
//
// Commands:
//   /start      /help
//   /play       /video      /tiktok     /fb
//   /weather    /ai         /translate  /lyrics
//   /wiki       /movie      /anime      /joke
//   /quote      /fact       /qr         /sticker
// ============================================

import TelegramBot from 'node-telegram-bot-api';
import axios       from 'axios';
import { logger }  from './logger.js';

const TOKEN = process.env.TELEGRAM_FEATURES_BOT_TOKEN;

// ── Regex ──────────────────────────────────────────────────────────────────────
const YTID_RX = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/;
const TT_RX   = /https?:\/\/(www\.)?(vm\.|vt\.|m\.)?tiktok\.com\/\S+/i;
const FB_RX   = /https?:\/\/(www\.|m\.|web\.)?facebook\.com\/\S+|https?:\/\/fb\.watch\/\S+/i;

// ── YouTube ────────────────────────────────────────────────────────────────────
async function ytSearch(query) {
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
      if (data?.[0]?.videoId) return data[0];
    } catch {}
  }
  return null;
}

async function ytAudioUrl(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const { data } = await axios.get(
      `https://apis.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(url)}`,
      { timeout: 25000 }
    );
    const u = data?.result?.download_url || data?.result?.downloadUrl || data?.result?.url;
    if (u) return u;
  } catch {}
  // Nexray fallback
  try {
    const { data } = await axios.get(
      `https://nxray-api.vercel.app/ytdl?url=${encodeURIComponent(url)}&type=audio`,
      { timeout: 15000 }
    );
    const u = data?.url || data?.link;
    if (u) return u;
  } catch {}
  return null;
}

async function ytVideoUrl(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  try {
    const { data } = await axios.get(
      `https://apis.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(url)}`,
      { timeout: 25000 }
    );
    const u = data?.result?.download_url || data?.result?.downloadUrl || data?.result?.url;
    if (u) return u;
  } catch {}
  return null;
}

// ── TikTok ─────────────────────────────────────────────────────────────────────
async function tikwmData(url) {
  const { data } = await axios.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000,
  });
  if (data.code !== 0 || !data.data) throw new Error('tikwm failed');
  return data.data;
}

// ── Facebook ───────────────────────────────────────────────────────────────────
async function fbVideoUrl(url) {
  try {
    const res = await axios.post(
      'https://fdownloader.net/api/ajaxSearch',
      `q=${encodeURIComponent(url)}&lang=en&web=facebook`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest', Referer: 'https://fdownloader.net/' }, timeout: 15000 }
    );
    const html = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const m = html.match(/href=["'](https?:\/\/[^"']*video[^"']*)/i);
    if (m?.[1]) return m[1];
  } catch {}
  return null;
}

// ── Weather ────────────────────────────────────────────────────────────────────
async function weatherData(city) {
  const { data } = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, {
    timeout: 10000, headers: { Accept: 'application/json' },
  });
  const cur = data?.current_condition?.[0];
  if (!cur) throw new Error('no data');
  return {
    city:     data?.nearest_area?.[0]?.areaName?.[0]?.value || city,
    country:  data?.nearest_area?.[0]?.country?.[0]?.value || '',
    temp_c:   cur.temp_C, temp_f: cur.temp_F,
    feels:    cur.FeelsLikeC, humidity: cur.humidity,
    desc:     cur.weatherDesc?.[0]?.value || '?',
    wind:     cur.windspeedKmph, uv: cur.uvIndex,
    visibility: cur.visibility,
  };
}

// ── AI ─────────────────────────────────────────────────────────────────────────
async function aiReply(text) {
  const { data } = await axios.post('https://text.pollinations.ai/openai', {
    model: 'openai',
    messages: [
      { role: 'system', content: 'You are a helpful assistant. Reply concisely and clearly. No markdown.' },
      { role: 'user',   content: text },
    ],
    temperature: 0.7, max_tokens: 400,
  }, { headers: { 'Content-Type': 'application/json' }, timeout: 25000 });
  return data?.choices?.[0]?.message?.content?.trim() || 'No response.';
}

// ── Translate ──────────────────────────────────────────────────────────────────
async function translateText(text, targetLang = 'en') {
  const { data } = await axios.get(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${targetLang}`,
    { timeout: 10000 }
  );
  return data?.responseData?.translatedText || null;
}

// ── Wikipedia ──────────────────────────────────────────────────────────────────
async function wikiSearch(query) {
  const { data } = await axios.get(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
    { timeout: 10000 }
  );
  return data;
}

// ── Movie (OMDB) ───────────────────────────────────────────────────────────────
async function movieInfo(query) {
  const { data } = await axios.get(
    `https://www.omdbapi.com/?t=${encodeURIComponent(query)}&apikey=trilogy`,
    { timeout: 10000 }
  );
  if (data?.Response === 'False') throw new Error(data.Error || 'Not found');
  return data;
}

// ── Anime (Jikan) ──────────────────────────────────────────────────────────────
async function animeSearch(query) {
  const { data } = await axios.get(
    `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1`,
    { timeout: 12000 }
  );
  return data?.data?.[0];
}

// ── Joke ───────────────────────────────────────────────────────────────────────
async function getJoke() {
  const { data } = await axios.get(
    'https://v2.jokeapi.dev/joke/Any?blacklistFlags=nsfw,racist,sexist&type=single',
    { timeout: 8000 }
  );
  return data?.joke || null;
}

// ── Quote ──────────────────────────────────────────────────────────────────────
async function getQuote() {
  const { data } = await axios.get('https://api.quotable.io/random', { timeout: 8000 });
  return data;
}

// ── Fact ───────────────────────────────────────────────────────────────────────
async function getFact() {
  const { data } = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', { timeout: 8000 });
  return data?.text || null;
}

// ── QR Code ────────────────────────────────────────────────────────────────────
function qrUrl(text) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
}

// ── Lyrics ─────────────────────────────────────────────────────────────────────
async function getLyrics(query) {
  const suggest = await axios.get(`https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`, { timeout: 10000 });
  const song = suggest.data?.data?.[0];
  if (!song) return null;
  const { data } = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(song.artist.name)}/${encodeURIComponent(song.title)}`, { timeout: 10000 });
  return { title: song.title, artist: song.artist.name, lyrics: data?.lyrics };
}

// ── Main init ──────────────────────────────────────────────────────────────────
export function initTelegramFeatures() {
  if (!TOKEN) {
    logger.warn('⚡ TELEGRAM_FEATURES_BOT_TOKEN not set — Telegram features bot disabled');
    return;
  }

  const bot = new TelegramBot(TOKEN, { polling: true });
  const typing    = (id) => bot.sendChatAction(id, 'typing').catch(() => {});
  const uploading = (id, t = 'upload_document') => bot.sendChatAction(id, t).catch(() => {});
  const md        = { parse_mode: 'Markdown' };

  // ── /start ─────────────────────────────────────────────────────────────────
  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
      `🤖 *AA MD Bot — Features*\n\n` +
      `WhatsApp bot features right here on Telegram!\n\n` +
      `📋 Use /help to see all commands.`,
      md
    ).catch(() => {});
  });

  // ── /help ──────────────────────────────────────────────────────────────────
  bot.onText(/\/help/, (msg) => {
    bot.sendMessage(msg.chat.id,
      `📋 *AA MD Bot — Telegram Features*\n\n` +
      `🎵 *Downloads*\n` +
      `/play \\<song\\> — YouTube MP3\n` +
      `/video \\<query\\> — YouTube MP4\n` +
      `/tiktok \\<url\\> — TikTok video\n` +
      `/fb \\<url\\> — Facebook video\n\n` +
      `🔍 *Search & Info*\n` +
      `/wiki \\<query\\> — Wikipedia summary\n` +
      `/movie \\<title\\> — Movie details\n` +
      `/anime \\<title\\> — Anime details\n` +
      `/lyrics \\<song\\> — Song lyrics\n\n` +
      `🌐 *Utilities*\n` +
      `/weather \\<city\\> — Current weather\n` +
      `/translate \\<text\\> — Translate to English\n` +
      `/qr \\<text\\> — Generate QR code\n` +
      `/sticker \\<image\\_url\\> — URL → Sticker\n\n` +
      `🤖 *AI & Fun*\n` +
      `/ai \\<question\\> — AI chat\n` +
      `/joke — Random joke\n` +
      `/quote — Random quote\n` +
      `/fact — Random fact\n\n` +
      `💡 *Tips*\n` +
      `• /translate ur: Hello — translate to Urdu\n` +
      `• /play or /video accepts YouTube URLs too`,
      { parse_mode: 'MarkdownV2' }
    ).catch(() => {});
  });

  // ── /play ──────────────────────────────────────────────────────────────────
  bot.onText(/\/play(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query  = (match[1] || '').trim();
    if (!query) return bot.sendMessage(chatId, '❌ Usage: /play <song name or YouTube URL>');

    await uploading(chatId, 'upload_voice');
    try {
      let videoId, title = query;
      const ytMatch = query.match(YTID_RX);
      if (ytMatch) { videoId = ytMatch[1]; }
      else {
        const res = await ytSearch(query);
        if (!res) return bot.sendMessage(chatId, `❌ No results found for: *${query}*`, md);
        videoId = res.videoId; title = res.title;
        await bot.sendMessage(chatId, `🎵 *${title}*\n⏬ Downloading...`, md);
      }
      const audioUrl = await ytAudioUrl(videoId);
      if (!audioUrl) return bot.sendMessage(chatId, '❌ Audio download failed. Try again later.');
      await bot.sendAudio(chatId, audioUrl, { caption: `🎵 *${title}*\n\n> 🤖 AA MD Bot`, ...md });
    } catch (e) {
      bot.sendMessage(chatId, `❌ Error: ${e.message}`).catch(() => {});
    }
  });

  // ── /video ─────────────────────────────────────────────────────────────────
  bot.onText(/\/video(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query  = (match[1] || '').trim();
    if (!query) return bot.sendMessage(chatId, '❌ Usage: /video <video name or YouTube URL>');

    await uploading(chatId, 'upload_video');
    try {
      let videoId, title = query;
      const ytMatch = query.match(YTID_RX);
      if (ytMatch) { videoId = ytMatch[1]; }
      else {
        const res = await ytSearch(query);
        if (!res) return bot.sendMessage(chatId, `❌ No results found for: *${query}*`, md);
        videoId = res.videoId; title = res.title;
        await bot.sendMessage(chatId, `🎬 *${title}*\n⏬ Downloading...`, md);
      }
      const videoUrl = await ytVideoUrl(videoId);
      if (!videoUrl) return bot.sendMessage(chatId, '❌ Video download failed. Try /play for audio instead.');
      await bot.sendVideo(chatId, videoUrl, { caption: `🎬 *${title}*\n\n> 🤖 AA MD Bot`, ...md });
    } catch (e) {
      bot.sendMessage(chatId, `❌ Error: ${e.message}`).catch(() => {});
    }
  });

  // ── /tiktok ────────────────────────────────────────────────────────────────
  bot.onText(/\/tiktok(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url    = (match[1] || '').trim();
    if (!url || !TT_RX.test(url)) return bot.sendMessage(chatId, '❌ Usage: /tiktok <TikTok URL>');

    await uploading(chatId, 'upload_video');
    try {
      const d = await tikwmData(url);
      const cap = `🎵 @${d.author?.unique_id || 'unknown'}\n❤️ ${(d.digg_count||0).toLocaleString()} | 💬 ${(d.comment_count||0).toLocaleString()}\n\n> 🤖 AA MD Bot`;
      if (d.images?.length) {
        for (const img of d.images.slice(0, 5)) await bot.sendPhoto(chatId, img).catch(() => {});
        bot.sendMessage(chatId, cap).catch(() => {});
      } else if (d.play) {
        await bot.sendVideo(chatId, d.play, { caption: cap });
      } else bot.sendMessage(chatId, '❌ Could not extract video.');
    } catch (e) {
      bot.sendMessage(chatId, `❌ TikTok failed: ${e.message}`).catch(() => {});
    }
  });

  // ── /fb ────────────────────────────────────────────────────────────────────
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
      bot.sendMessage(chatId, `❌ Facebook failed: ${e.message}`).catch(() => {});
    }
  });

  // ── /weather ───────────────────────────────────────────────────────────────
  bot.onText(/\/weather(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const city   = (match[1] || '').trim();
    if (!city) return bot.sendMessage(chatId, '❌ Usage: /weather <city name>');

    await typing(chatId);
    try {
      const w = await weatherData(city);
      bot.sendMessage(chatId,
        `🌤 *Weather — ${w.city}, ${w.country}*\n\n` +
        `🌡 Temperature: *${w.temp_c}°C* / ${w.temp_f}°F\n` +
        `🤔 Feels like: ${w.feels}°C\n` +
        `☁️ Condition: ${w.desc}\n` +
        `💧 Humidity: ${w.humidity}%\n` +
        `💨 Wind: ${w.wind} km/h\n` +
        `👁 Visibility: ${w.visibility} km\n` +
        `☀️ UV Index: ${w.uv}\n\n` +
        `> 🤖 AA MD Bot`,
        md
      ).catch(() => {});
    } catch {
      bot.sendMessage(chatId, `❌ Weather not found for "${city}". Check the city name.`).catch(() => {});
    }
  });

  // ── /ai ────────────────────────────────────────────────────────────────────
  bot.onText(/\/ai(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const text   = (match[1] || '').trim();
    if (!text) return bot.sendMessage(chatId, '❌ Usage: /ai <your question>');

    await typing(chatId);
    try {
      const reply = await aiReply(text);
      bot.sendMessage(chatId, `🤖 ${reply}\n\n_— AA MD Bot AI_`).catch(() => {});
    } catch (e) {
      bot.sendMessage(chatId, `❌ AI error: ${e.message}`).catch(() => {});
    }
  });

  // ── /translate ─────────────────────────────────────────────────────────────
  bot.onText(/\/translate(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    let input    = (match[1] || '').trim();
    if (!input) return bot.sendMessage(chatId,
      '❌ Usage:\n/translate <text> → to English\n/translate ur: Hello → to Urdu\n/translate ar: Good morning → to Arabic'
    );

    await typing(chatId);
    let targetLang = 'en';
    if (/^[a-z]{2}:\s*/i.test(input)) {
      targetLang = input.slice(0, 2).toLowerCase();
      input      = input.slice(input.indexOf(':') + 1).trim();
    }
    try {
      const result = await translateText(input, targetLang);
      if (!result) return bot.sendMessage(chatId, '❌ Translation failed.');
      bot.sendMessage(chatId, `🌐 *Translation (→ ${targetLang.toUpperCase()})*\n\n${result}\n\n> 🤖 AA MD Bot`, md).catch(() => {});
    } catch (e) {
      bot.sendMessage(chatId, `❌ Translation error: ${e.message}`).catch(() => {});
    }
  });

  // ── /wiki ──────────────────────────────────────────────────────────────────
  bot.onText(/\/wiki(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query  = (match[1] || '').trim();
    if (!query) return bot.sendMessage(chatId, '❌ Usage: /wiki <search term>');

    await typing(chatId);
    try {
      const w = await wikiSearch(query);
      const extract = (w.extract || '').slice(0, 800);
      const img     = w.thumbnail?.source;
      const caption =
        `📖 *${w.title}*\n\n${extract}${extract.length >= 800 ? '...' : ''}\n\n` +
        `🔗 ${w.content_urls?.desktop?.page || ''}\n\n> 🤖 AA MD Bot`;
      if (img) {
        await bot.sendPhoto(chatId, img, { caption, ...md }).catch(() => bot.sendMessage(chatId, caption, md));
      } else {
        bot.sendMessage(chatId, caption, md).catch(() => {});
      }
    } catch {
      bot.sendMessage(chatId, `❌ Wikipedia: No article found for "${query}".`).catch(() => {});
    }
  });

  // ── /movie ─────────────────────────────────────────────────────────────────
  bot.onText(/\/movie(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query  = (match[1] || '').trim();
    if (!query) return bot.sendMessage(chatId, '❌ Usage: /movie <movie title>');

    await typing(chatId);
    try {
      const m = await movieInfo(query);
      const text =
        `🎬 *${m.Title}* (${m.Year})\n\n` +
        `⭐ Rating: ${m.imdbRating}/10\n` +
        `🏆 Awards: ${m.Awards}\n` +
        `🎭 Genre: ${m.Genre}\n` +
        `⏱ Runtime: ${m.Runtime}\n` +
        `🌐 Language: ${m.Language}\n` +
        `🎬 Director: ${m.Director}\n` +
        `🎭 Cast: ${m.Actors}\n\n` +
        `📖 _${m.Plot}_\n\n` +
        `> 🤖 AA MD Bot`;
      if (m.Poster && m.Poster !== 'N/A') {
        await bot.sendPhoto(chatId, m.Poster, { caption: text, ...md }).catch(() => bot.sendMessage(chatId, text, md));
      } else {
        bot.sendMessage(chatId, text, md).catch(() => {});
      }
    } catch (e) {
      bot.sendMessage(chatId, `❌ Movie not found: "${query}"`).catch(() => {});
    }
  });

  // ── /anime ─────────────────────────────────────────────────────────────────
  bot.onText(/\/anime(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query  = (match[1] || '').trim();
    if (!query) return bot.sendMessage(chatId, '❌ Usage: /anime <anime title>');

    await typing(chatId);
    try {
      const a = await animeSearch(query);
      if (!a) return bot.sendMessage(chatId, `❌ Anime not found: "${query}"`);
      const text =
        `🎌 *${a.title}* (${a.title_english || a.title})\n\n` +
        `⭐ Score: ${a.score || 'N/A'}/10\n` +
        `📺 Type: ${a.type || 'N/A'}\n` +
        `📋 Episodes: ${a.episodes || '?'}\n` +
        `📅 Status: ${a.status || 'N/A'}\n` +
        `🎭 Genre: ${(a.genres || []).map(g => g.name).join(', ') || 'N/A'}\n\n` +
        `📖 _${(a.synopsis || '').slice(0, 400)}${(a.synopsis || '').length > 400 ? '...' : ''}_\n\n` +
        `> 🤖 AA MD Bot`;
      const img = a.images?.jpg?.large_image_url;
      if (img) {
        await bot.sendPhoto(chatId, img, { caption: text, ...md }).catch(() => bot.sendMessage(chatId, text, md));
      } else {
        bot.sendMessage(chatId, text, md).catch(() => {});
      }
    } catch (e) {
      bot.sendMessage(chatId, `❌ Anime search failed: ${e.message}`).catch(() => {});
    }
  });

  // ── /lyrics ────────────────────────────────────────────────────────────────
  bot.onText(/\/lyrics(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query  = (match[1] || '').trim();
    if (!query) return bot.sendMessage(chatId, '❌ Usage: /lyrics <song name>');

    await typing(chatId);
    try {
      const res = await getLyrics(query);
      if (!res?.lyrics) return bot.sendMessage(chatId, `❌ Lyrics not found for "${query}"`);
      const lyrics = res.lyrics.slice(0, 3800);
      bot.sendMessage(chatId,
        `🎵 *${res.title}*\n👤 ${res.artist}\n\n${lyrics}${res.lyrics.length > 3800 ? '\n...' : ''}\n\n> 🤖 AA MD Bot`,
        md
      ).catch(() => {});
    } catch (e) {
      bot.sendMessage(chatId, `❌ Lyrics error: ${e.message}`).catch(() => {});
    }
  });

  // ── /joke ──────────────────────────────────────────────────────────────────
  bot.onText(/\/joke/, async (msg) => {
    await typing(msg.chat.id);
    try {
      const joke = await getJoke();
      if (!joke) return bot.sendMessage(msg.chat.id, '❌ No joke found, try again.');
      bot.sendMessage(msg.chat.id, `😂 ${joke}\n\n> 🤖 AA MD Bot`).catch(() => {});
    } catch (e) {
      bot.sendMessage(msg.chat.id, `❌ Joke error: ${e.message}`).catch(() => {});
    }
  });

  // ── /quote ─────────────────────────────────────────────────────────────────
  bot.onText(/\/quote/, async (msg) => {
    await typing(msg.chat.id);
    try {
      const q = await getQuote();
      bot.sendMessage(msg.chat.id,
        `💬 *"${q.content}"*\n\n— _${q.author}_\n\n> 🤖 AA MD Bot`, md
      ).catch(() => {});
    } catch (e) {
      bot.sendMessage(msg.chat.id, `❌ Quote error: ${e.message}`).catch(() => {});
    }
  });

  // ── /fact ──────────────────────────────────────────────────────────────────
  bot.onText(/\/fact/, async (msg) => {
    await typing(msg.chat.id);
    try {
      const fact = await getFact();
      if (!fact) return bot.sendMessage(msg.chat.id, '❌ No fact found, try again.');
      bot.sendMessage(msg.chat.id, `🧠 ${fact}\n\n> 🤖 AA MD Bot`).catch(() => {});
    } catch (e) {
      bot.sendMessage(msg.chat.id, `❌ Fact error: ${e.message}`).catch(() => {});
    }
  });

  // ── /qr ────────────────────────────────────────────────────────────────────
  bot.onText(/\/qr(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const text   = (match[1] || '').trim();
    if (!text) return bot.sendMessage(chatId, '❌ Usage: /qr <text or URL>');

    await uploading(chatId, 'upload_photo');
    try {
      const url = qrUrl(text);
      await bot.sendPhoto(chatId, url, { caption: `📱 QR Code\n\nContent: ${text.slice(0, 100)}\n\n> 🤖 AA MD Bot` });
    } catch (e) {
      bot.sendMessage(chatId, `❌ QR error: ${e.message}`).catch(() => {});
    }
  });

  // ── /sticker ───────────────────────────────────────────────────────────────
  bot.onText(/\/sticker(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;

    // Accept image URL from text, or use replied photo
    let imageUrl = (match[1] || '').trim();

    if (!imageUrl && msg.reply_to_message?.photo) {
      const photos = msg.reply_to_message.photo;
      const fileId = photos[photos.length - 1].file_id;
      const info   = await bot.getFile(fileId);
      imageUrl     = `https://api.telegram.org/file/bot${TOKEN}/${info.file_path}`;
    }

    if (!imageUrl) return bot.sendMessage(chatId,
      '❌ Usage:\n/sticker <image URL>\nOR reply to an image with /sticker'
    );

    await uploading(chatId, 'upload_photo');
    try {
      // Convert to sticker via telegram (send as webp sticker)
      await bot.sendSticker(chatId, imageUrl).catch(async () => {
        // If URL sticker fails, send as photo with sticker emojis
        await bot.sendPhoto(chatId, imageUrl, {
          caption: `✨ Here's your image! (Telegram requires WebP for stickers)\n\n> 🤖 AA MD Bot`
        });
      });
    } catch (e) {
      bot.sendMessage(chatId, `❌ Sticker error: ${e.message}`).catch(() => {});
    }
  });

  // ── Catch-all unknown commands ─────────────────────────────────────────────
  const KNOWN = /^\/(start|help|play|video|tiktok|fb|weather|ai|translate|wiki|movie|anime|lyrics|joke|quote|fact|qr|sticker)/;
  bot.on('message', (msg) => {
    if (msg.text?.startsWith('/') && !KNOWN.test(msg.text)) {
      bot.sendMessage(msg.chat.id, `❓ Unknown command. Use /help to see all available commands.`).catch(() => {});
    }
  });

  bot.on('polling_error', (err) => {
    logger.warn({ err: err.message }, '🤖 Telegram features bot polling error');
  });

  logger.info('🤖 Telegram features bot started');
  return bot;
}
