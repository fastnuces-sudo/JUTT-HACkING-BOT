// ╔══════════════════════════════════════════════╗
// ║   AA MD Bot — Telegram Features Bot         ║
// ║   Token: TELEGRAM_FEATURES_BOT_TOKEN        ║
// ║   Parse mode: HTML (most reliable)          ║
// ╚══════════════════════════════════════════════╝

import TelegramBot    from 'node-telegram-bot-api';
import axios          from 'axios';
import { execFile }   from 'child_process';
import { promisify }  from 'util';
import { logger }     from './logger.js';

const execFileAsync = promisify(execFile);
const TOKEN  = process.env.TELEGRAM_FEATURES_BOT_TOKEN;
const YTDLP  = '/home/runner/.local/bin/yt-dlp';
const HTML   = { parse_mode: 'HTML' };

// ── Helpers ────────────────────────────────────────────────────────────────────
const esc     = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const DIVIDER = '━━━━━━━━━━━━━━━━━━━━━━━';
const FOOTER  = `\n${DIVIDER}\n🤖 <b>AA MD Bot</b>`;

function formatDur(sec) {
  if (!sec) return '';
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2,'0')}`;
}

// Per-user cooldown (3 s between commands)
const _cooldowns = new Map();
function applyCooldown(userId, ms = 3000) {
  const now  = Date.now();
  const last = _cooldowns.get(userId) || 0;
  const wait = ms - (now - last);
  if (wait > 0) return Math.ceil(wait / 1000);
  _cooldowns.set(userId, now);
  return 0;
}

// Edit-in-place helper — falls back to new message on failure
async function edit(bot, chatId, msgId, text, opts = {}) {
  try {
    return await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', ...opts });
  } catch {
    return bot.sendMessage(chatId, text, { parse_mode: 'HTML', ...opts });
  }
}

// Safe send helpers
const sendText = (bot, id, text, extra = {}) =>
  bot.sendMessage(id, text, { parse_mode: 'HTML', ...extra }).catch(() => {});

const sendPhoto = (bot, id, photo, caption, extra = {}) =>
  bot.sendPhoto(id, photo, { caption, parse_mode: 'HTML', ...extra }).catch(() => {});

// ── YouTube ────────────────────────────────────────────────────────────────────
const YTID_RX = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/;

async function ytSearchInfo(query) {
  // Use yt-dlp for search metadata (reliable, no nsig needed for metadata)
  const { stdout } = await execFileAsync(YTDLP, [
    `ytsearch1:${query}`,
    '--dump-json', '--no-download', '--no-playlist', '--quiet',
  ], { timeout: 18000 });
  return JSON.parse(stdout.trim().split('\n')[0]);
}

async function ytAudio(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const { data } = await axios.get(
    `https://apis.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(url)}`,
    { timeout: 35000, headers: { 'User-Agent': 'Mozilla/5.0' } }
  );
  if (!data?.success) throw new Error(data?.message || 'Download API failed');
  const dlUrl = data?.result?.download_url || data?.result?.downloadUrl || data?.result?.url;
  if (!dlUrl) throw new Error('No audio URL returned');
  return {
    url:      dlUrl,
    title:    data?.result?.title || 'Audio',
    duration: formatDur(data?.result?.duration),
    size:     data?.result?.filesize || '',
  };
}

async function ytVideo(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const { data } = await axios.get(
    `https://apis.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(url)}`,
    { timeout: 35000, headers: { 'User-Agent': 'Mozilla/5.0' } }
  );
  if (!data?.success) throw new Error(data?.message || 'Download API failed');
  const dlUrl = data?.result?.download_url || data?.result?.downloadUrl || data?.result?.url;
  if (!dlUrl) throw new Error('No video URL returned');
  return {
    url:      dlUrl,
    title:    data?.result?.title || 'Video',
    duration: formatDur(data?.result?.duration),
  };
}

// ── TikTok ─────────────────────────────────────────────────────────────────────
const TT_RX = /https?:\/\/(www\.)?(vm\.|vt\.|m\.)?tiktok\.com\/\S+/i;

async function tikwm(url) {
  const { data } = await axios.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000,
  });
  if (data.code !== 0 || !data.data) throw new Error(data.msg || 'TikWM failed');
  return data.data;
}

// ── Facebook ───────────────────────────────────────────────────────────────────
const FB_RX = /https?:\/\/(www\.|m\.|web\.)?facebook\.com\/\S+|https?:\/\/fb\.watch\/\S+/i;

async function fbVideo(url) {
  // Use yt-dlp (most reliable for public FB videos)
  const { stdout } = await execFileAsync(YTDLP, [
    '--get-url', '-f', 'best[filesize<45M]/best',
    '--no-playlist', '--quiet', url,
  ], { timeout: 30000 });
  const link = stdout.trim().split('\n')[0];
  if (!link) throw new Error('No URL extracted');
  return link;
}

// ── Weather ────────────────────────────────────────────────────────────────────
async function weather(city) {
  const { data } = await axios.get(
    `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
    { timeout: 12000, headers: { Accept: 'application/json' } }
  );
  const cur = data?.current_condition?.[0];
  const area = data?.nearest_area?.[0];
  if (!cur) throw new Error('No weather data');
  return {
    city:       area?.areaName?.[0]?.value || city,
    country:    area?.country?.[0]?.value || '',
    temp_c:     cur.temp_C,
    temp_f:     cur.temp_F,
    feels:      cur.FeelsLikeC,
    humidity:   cur.humidity,
    desc:       cur.weatherDesc?.[0]?.value || '',
    wind:       cur.windspeedKmph,
    uv:         cur.uvIndex,
    visibility: cur.visibility,
    pressure:   cur.pressure,
  };
}

// ── AI ─────────────────────────────────────────────────────────────────────────
async function aiChat(prompt) {
  const { data } = await axios.post('https://text.pollinations.ai/openai', {
    model: 'openai',
    messages: [
      { role: 'system', content: 'You are a helpful and friendly assistant. Reply concisely (max 300 words). Use plain text, no markdown.' },
      { role: 'user',   content: prompt },
    ],
    temperature: 0.7,
    max_tokens:  500,
  }, { headers: { 'Content-Type': 'application/json' }, timeout: 25000 });
  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error('Empty AI response');
  return reply;
}

// ── Translate ──────────────────────────────────────────────────────────────────
const LANG_NAMES = { en:'English', ur:'Urdu', ar:'Arabic', fr:'French', de:'German', es:'Spanish', hi:'Hindi', tr:'Turkish', ru:'Russian', zh:'Chinese', ja:'Japanese', ko:'Korean', it:'Italian', pt:'Portuguese' };

async function translate(text, targetLang = 'en') {
  const { data } = await axios.get(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${targetLang}`,
    { timeout: 12000 }
  );
  if (data?.quotaFinished) throw new Error('Daily translation quota finished');
  const result = data?.responseData?.translatedText;
  if (!result || result === text) throw new Error('Translation unavailable');
  return result;
}

// ── Wikipedia ──────────────────────────────────────────────────────────────────
async function wiki(query) {
  const { data } = await axios.get(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
    { timeout: 12000 }
  );
  if (!data?.extract) throw new Error('No article found');
  return data;
}

// ── Movie (OMDB) ───────────────────────────────────────────────────────────────
async function movie(query) {
  const { data } = await axios.get(
    `https://www.omdbapi.com/?t=${encodeURIComponent(query)}&type=movie&apikey=trilogy`,
    { timeout: 12000 }
  );
  if (data?.Response === 'False') throw new Error(data?.Error || 'Movie not found');
  return data;
}

// ── Anime (Jikan v4) ───────────────────────────────────────────────────────────
async function anime(query) {
  const { data } = await axios.get(
    `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1&sfw=true`,
    { timeout: 15000, headers: { 'User-Agent': 'AA-MD-Bot/3.0' } }
  );
  const result = data?.data?.[0];
  if (!result) throw new Error('Anime not found');
  return result;
}

// ── Lyrics (lyrics.ovh, 2-step) ────────────────────────────────────────────────
async function lyrics(query) {
  // Step 1: search
  const { data: s } = await axios.get(
    `https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`,
    { timeout: 12000 }
  );
  const song = s?.data?.[0];
  if (!song) throw new Error('Song not found');
  // Step 2: fetch lyrics
  const { data: l } = await axios.get(
    `https://api.lyrics.ovh/v1/${encodeURIComponent(song.artist.name)}/${encodeURIComponent(song.title)}`,
    { timeout: 12000 }
  );
  if (!l?.lyrics) throw new Error('Lyrics not available for this song');
  return { title: song.title, artist: song.artist.name, cover: song.album?.cover_medium, lyrics: l.lyrics };
}

// ── Fun APIs ───────────────────────────────────────────────────────────────────
async function joke() {
  const { data } = await axios.get(
    'https://v2.jokeapi.dev/joke/Programming,Miscellaneous,Pun?blacklistFlags=nsfw,racist,sexist,explicit&type=single',
    { timeout: 10000 }
  );
  if (!data?.joke) throw new Error('No joke');
  return { joke: data.joke, category: data.category };
}

async function quote() {
  const { data } = await axios.get('https://zenquotes.io/api/random', { timeout: 10000 });
  const q = Array.isArray(data) ? data[0] : data;
  if (!q?.q) throw new Error('No quote');
  return { text: q.q, author: q.a };
}

async function fact() {
  const { data } = await axios.get(
    'https://uselessfacts.jsph.pl/api/v2/facts/random?language=en',
    { timeout: 10000 }
  );
  if (!data?.text) throw new Error('No fact');
  return data.text;
}

// ── QR Code ────────────────────────────────────────────────────────────────────
function qrUrl(text) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(text)}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// Bot init
// ══════════════════════════════════════════════════════════════════════════════
export function initTelegramFeatures() {
  if (!TOKEN) {
    logger.warn('⚡ TELEGRAM_FEATURES_BOT_TOKEN not set — features bot disabled');
    return;
  }

  const bot = new TelegramBot(TOKEN, { polling: true });

  // ── /start ─────────────────────────────────────────────────────────────────
  bot.onText(/\/start/, (msg) => {
    sendText(bot, msg.chat.id,
      `🤖 <b>AA MD Bot — Telegram Features</b>\n\n` +
      `WhatsApp bot powers — right here on Telegram!\n\n` +
      `📋 Type /help to see all commands.\n` +
      FOOTER
    );
  });

  // ── /help ──────────────────────────────────────────────────────────────────
  bot.onText(/\/help/, (msg) => {
    sendText(bot, msg.chat.id,
      `📋 <b>AA MD Bot — Commands</b>\n${DIVIDER}\n\n` +

      `🎵 <b>Downloads</b>\n` +
      `/play <i>song name or URL</i> — YouTube MP3\n` +
      `/video <i>title or URL</i> — YouTube MP4\n` +
      `/tiktok <i>url</i> — TikTok video/slideshow\n` +
      `/fb <i>url</i> — Facebook video\n\n` +

      `🔍 <b>Search & Info</b>\n` +
      `/wiki <i>query</i> — Wikipedia summary\n` +
      `/movie <i>title</i> — Movie details + poster\n` +
      `/anime <i>title</i> — Anime info + cover\n` +
      `/lyrics <i>song</i> — Song lyrics\n\n` +

      `🌐 <b>Utilities</b>\n` +
      `/weather <i>city</i> — Live weather report\n` +
      `/translate <i>text</i> — Translate to English\n` +
      `  ╰ /translate ur: Hello → to Urdu\n` +
      `/qr <i>text or URL</i> — Generate QR code\n\n` +

      `🤖 <b>AI & Fun</b>\n` +
      `/ai <i>question</i> — Chat with AI\n` +
      `/joke — Random joke\n` +
      `/quote — Inspirational quote\n` +
      `/fact — Random interesting fact\n\n` +

      `⚙️ <b>General</b>\n` +
      `/ping — Check bot speed\n` +
      `/id — Your Telegram IDs\n` +
      FOOTER
    );
  });

  // ── /ping ──────────────────────────────────────────────────────────────────
  bot.onText(/\/ping/, async (msg) => {
    const start = Date.now();
    const sent  = await bot.sendMessage(msg.chat.id, '🏓 Pinging...').catch(() => null);
    if (!sent) return;
    const ms = Date.now() - start;
    const upSec = Math.floor(process.uptime());
    const upStr = upSec > 3600
      ? `${Math.floor(upSec/3600)}h ${Math.floor((upSec%3600)/60)}m`
      : `${Math.floor(upSec/60)}m ${upSec%60}s`;
    edit(bot, msg.chat.id, sent.message_id,
      `🏓 <b>Pong!</b>  <code>${ms}ms</code>\n\n` +
      `⏱ Uptime: ${esc(upStr)}\n` +
      `💾 RAM: ${Math.round(process.memoryUsage().heapUsed/1024/1024)}MB\n` +
      FOOTER
    );
  });

  // ── /id ────────────────────────────────────────────────────────────────────
  bot.onText(/\/id/, (msg) => {
    const u = msg.from;
    sendText(bot, msg.chat.id,
      `🪪 <b>Your Telegram IDs</b>\n${DIVIDER}\n\n` +
      `👤 User ID: <code>${u?.id}</code>\n` +
      `📛 Name: ${esc(u?.first_name || '')} ${esc(u?.last_name || '')}\n` +
      `🔖 Username: ${u?.username ? '@' + esc(u.username) : 'None'}\n\n` +
      `💬 Chat ID: <code>${msg.chat.id}</code>\n` +
      `📂 Chat type: ${esc(msg.chat.type)}\n` +
      FOOTER
    );
  });

  // ── /play ──────────────────────────────────────────────────────────────────
  bot.onText(/\/play(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query  = (match[1] || '').trim();
    if (!query) return sendText(bot, chatId, `❌ Usage: <code>/play song name</code>\nExample: /play Noor-e-Muhammad`);

    const wait = applyCooldown(msg.from.id, 5000);
    if (wait) return sendText(bot, chatId, `⏳ Please wait <b>${wait}s</b> before the next command.`);

    const sent = await bot.sendMessage(chatId, `🔍 <b>Searching...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      // Resolve video ID
      let videoId, title, thumb, duration;
      const ytMatch = query.match(YTID_RX);
      if (ytMatch) {
        videoId = ytMatch[1];
        title   = 'YouTube Audio';
      } else {
        await edit(bot, chatId, sent.message_id, `🔍 <b>Searching:</b> ${esc(query)}...`);
        const info = await ytSearchInfo(query);
        videoId  = info.id;
        title    = info.title || query;
        thumb    = info.thumbnail;
        duration = formatDur(info.duration);
      }

      await edit(bot, chatId, sent.message_id,
        `⏬ <b>Downloading audio...</b>\n\n` +
        `🎵 ${esc(title)}\n` +
        `${duration ? `⏱ ${duration}` : ''}`
      );

      const audio = await ytAudio(videoId);
      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});

      await bot.sendAudio(chatId, audio.url, {
        caption:
          `🎵 <b>${esc(audio.title || title)}</b>\n` +
          `${audio.duration ? `⏱ ${esc(audio.duration)}` : ''}\n` +
          FOOTER,
        parse_mode: 'HTML',
        title: audio.title || title,
      }).catch(async () => {
        // Fallback: send as document
        await bot.sendDocument(chatId, audio.url, {
          caption: `🎵 <b>${esc(audio.title || title)}</b>\n${FOOTER}`,
          parse_mode: 'HTML',
        });
      });
    } catch (e) {
      edit(bot, chatId, sent.message_id,
        `❌ <b>Download failed</b>\n\n${esc(e.message)}\n\n💡 Try a different song name or YouTube URL.`
      );
    }
  });

  // ── /video ─────────────────────────────────────────────────────────────────
  bot.onText(/\/video(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query  = (match[1] || '').trim();
    if (!query) return sendText(bot, chatId, `❌ Usage: <code>/video title or YouTube URL</code>`);

    const wait = applyCooldown(msg.from.id, 5000);
    if (wait) return sendText(bot, chatId, `⏳ Please wait <b>${wait}s</b> before the next command.`);

    const sent = await bot.sendMessage(chatId, `🔍 <b>Searching...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      let videoId, title, duration;
      const ytMatch = query.match(YTID_RX);
      if (ytMatch) {
        videoId = ytMatch[1];
        title   = 'YouTube Video';
      } else {
        const info = await ytSearchInfo(query);
        videoId  = info.id;
        title    = info.title || query;
        duration = formatDur(info.duration);
      }

      await edit(bot, chatId, sent.message_id,
        `⏬ <b>Downloading video...</b>\n\n` +
        `🎬 ${esc(title)}\n` +
        `${duration ? `⏱ ${duration}` : ''}\n\n` +
        `<i>This may take a moment...</i>`
      );

      const vid = await ytVideo(videoId);
      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});

      await bot.sendVideo(chatId, vid.url, {
        caption:
          `🎬 <b>${esc(vid.title || title)}</b>\n` +
          `${vid.duration ? `⏱ ${esc(vid.duration)}` : ''}\n` +
          FOOTER,
        parse_mode: 'HTML',
      }).catch(async () => {
        await bot.sendDocument(chatId, vid.url, {
          caption: `🎬 <b>${esc(vid.title || title)}</b>\n${FOOTER}`,
          parse_mode: 'HTML',
        });
      });
    } catch (e) {
      edit(bot, chatId, sent.message_id,
        `❌ <b>Download failed</b>\n\n${esc(e.message)}\n\n💡 Try /play for audio-only.`
      );
    }
  });

  // ── /tiktok ────────────────────────────────────────────────────────────────
  bot.onText(/\/tiktok(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url    = (match[1] || '').trim();
    if (!url || !TT_RX.test(url))
      return sendText(bot, chatId, `❌ Usage: <code>/tiktok https://tiktok.com/...</code>`);

    const wait = applyCooldown(msg.from.id, 5000);
    if (wait) return sendText(bot, chatId, `⏳ Please wait <b>${wait}s</b>.`);

    const sent = await bot.sendMessage(chatId, `⏬ <b>Fetching TikTok...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const d   = await tikwm(url);
      const cap =
        `🎵 <b>${esc(d.title || 'TikTok')}</b>\n\n` +
        `👤 @${esc(d.author?.unique_id || 'unknown')}\n` +
        `❤️ ${Number(d.digg_count||0).toLocaleString()}  ` +
        `💬 ${Number(d.comment_count||0).toLocaleString()}  ` +
        `▶️ ${Number(d.play_count||0).toLocaleString()}\n` +
        FOOTER;

      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});

      if (d.images?.length) {
        // Slideshow — send as album
        const media = d.images.slice(0, 10).map((img, i) => ({
          type: 'photo', media: img,
          ...(i === 0 ? { caption: cap, parse_mode: 'HTML' } : {}),
        }));
        await bot.sendMediaGroup(chatId, media).catch(async () => {
          // Fallback: send first image only
          await bot.sendPhoto(chatId, d.images[0], { caption: cap, parse_mode: 'HTML' });
        });
      } else if (d.play) {
        await bot.sendVideo(chatId, d.play, { caption: cap, parse_mode: 'HTML' }).catch(async () => {
          await bot.sendDocument(chatId, d.play, { caption: cap, parse_mode: 'HTML' });
        });
      } else {
        sendText(bot, chatId, `❌ Could not extract media from this TikTok.`);
      }
    } catch (e) {
      edit(bot, chatId, sent.message_id,
        `❌ <b>TikTok failed</b>\n\n${esc(e.message)}\n\n💡 Make sure the link is public.`
      );
    }
  });

  // ── /fb ────────────────────────────────────────────────────────────────────
  bot.onText(/\/fb(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url    = (match[1] || '').trim();
    if (!url || !FB_RX.test(url))
      return sendText(bot, chatId, `❌ Usage: <code>/fb https://facebook.com/...</code>\n<i>Video must be public</i>`);

    const wait = applyCooldown(msg.from.id, 5000);
    if (wait) return sendText(bot, chatId, `⏳ Please wait <b>${wait}s</b>.`);

    const sent = await bot.sendMessage(chatId, `⏬ <b>Downloading Facebook video...</b>\n<i>This may take a moment...</i>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const videoUrl = await fbVideo(url);
      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});
      await bot.sendVideo(chatId, videoUrl, {
        caption: `📘 <b>Facebook Video</b>\n${FOOTER}`,
        parse_mode: 'HTML',
      }).catch(async () => {
        await bot.sendDocument(chatId, videoUrl, {
          caption: `📘 <b>Facebook Video</b>\n${FOOTER}`,
          parse_mode: 'HTML',
        });
      });
    } catch (e) {
      edit(bot, chatId, sent.message_id,
        `❌ <b>Facebook download failed</b>\n\n${esc(e.message)}\n\n💡 Ensure the post/video is public.`
      );
    }
  });

  // ── /weather ───────────────────────────────────────────────────────────────
  bot.onText(/\/weather(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const city   = (match[1] || '').trim();
    if (!city) return sendText(bot, chatId, `❌ Usage: <code>/weather Karachi</code>`);

    const sent = await bot.sendMessage(chatId, `🌍 <b>Fetching weather...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const w = await weather(city);
      const emoji =
        w.desc.toLowerCase().includes('rain') ? '🌧' :
        w.desc.toLowerCase().includes('cloud') ? '⛅' :
        w.desc.toLowerCase().includes('snow') ? '❄️' :
        w.desc.toLowerCase().includes('storm') ? '⛈' :
        w.desc.toLowerCase().includes('fog') ? '🌫' : '☀️';

      edit(bot, chatId, sent.message_id,
        `${emoji} <b>Weather — ${esc(w.city)}, ${esc(w.country)}</b>\n${DIVIDER}\n\n` +
        `🌡 Temperature: <b>${esc(w.temp_c)}°C</b> / ${esc(w.temp_f)}°F\n` +
        `🤔 Feels like: <b>${esc(w.feels)}°C</b>\n` +
        `☁️ Condition: <b>${esc(w.desc)}</b>\n\n` +
        `💧 Humidity: ${esc(w.humidity)}%\n` +
        `💨 Wind: ${esc(w.wind)} km/h\n` +
        `👁 Visibility: ${esc(w.visibility)} km\n` +
        `🔵 Pressure: ${esc(w.pressure)} hPa\n` +
        `☀️ UV Index: ${esc(w.uv)}\n` +
        FOOTER
      );
    } catch {
      edit(bot, chatId, sent.message_id,
        `❌ Weather not found for "<b>${esc(city)}</b>".\n\nCheck the city name spelling.`
      );
    }
  });

  // ── /ai ────────────────────────────────────────────────────────────────────
  bot.onText(/\/ai(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const prompt = (match[1] || '').trim();
    if (!prompt) return sendText(bot, chatId, `❌ Usage: <code>/ai your question here</code>`);

    const wait = applyCooldown(msg.from.id, 4000);
    if (wait) return sendText(bot, chatId, `⏳ Please wait <b>${wait}s</b>.`);

    const sent = await bot.sendMessage(chatId, `🤖 <b>Thinking...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const reply = await aiChat(prompt);
      edit(bot, chatId, sent.message_id,
        `🤖 <b>AI Reply</b>\n${DIVIDER}\n\n` +
        esc(reply) +
        FOOTER
      );
    } catch (e) {
      edit(bot, chatId, sent.message_id, `❌ AI error: ${esc(e.message)}`);
    }
  });

  // ── /translate ─────────────────────────────────────────────────────────────
  bot.onText(/\/translate(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    let input    = (match[1] || '').trim();
    if (!input) return sendText(bot, chatId,
      `❌ Usage:\n<code>/translate Hello</code> → to English\n<code>/translate ur: Hello</code> → to Urdu\n\nLanguage codes: en ur ar hi fr de es tr ru zh ja ko`
    );

    let targetLang = 'en';
    if (/^[a-z]{2}:\s*/i.test(input)) {
      targetLang = input.slice(0,2).toLowerCase();
      input      = input.slice(input.indexOf(':') + 1).trim();
    }

    const sent = await bot.sendMessage(chatId, `🌐 <b>Translating...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const result   = await translate(input, targetLang);
      const langName = esc(LANG_NAMES[targetLang] || targetLang.toUpperCase());
      edit(bot, chatId, sent.message_id,
        `🌐 <b>Translation → ${langName}</b>\n${DIVIDER}\n\n` +
        `<i>${esc(input)}</i>\n\n` +
        `<b>${esc(result)}</b>\n` +
        FOOTER
      );
    } catch (e) {
      edit(bot, chatId, sent.message_id, `❌ Translation failed: ${esc(e.message)}`);
    }
  });

  // ── /wiki ──────────────────────────────────────────────────────────────────
  bot.onText(/\/wiki(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query  = (match[1] || '').trim();
    if (!query) return sendText(bot, chatId, `❌ Usage: <code>/wiki Pakistan</code>`);

    const sent = await bot.sendMessage(chatId, `🔍 <b>Searching Wikipedia...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const w       = await wiki(query);
      const extract = esc(w.extract || '').slice(0, 900);
      const caption =
        `📖 <b>${esc(w.title)}</b>\n${DIVIDER}\n\n` +
        extract +
        (w.extract?.length > 900 ? `...\n\n<i>Read more:</i> ${esc(w.content_urls?.desktop?.page || '')}` : '') +
        FOOTER;

      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});

      const thumb = w.thumbnail?.source;
      if (thumb) {
        await bot.sendPhoto(chatId, thumb, { caption, parse_mode: 'HTML' }).catch(() => {
          sendText(bot, chatId, caption);
        });
      } else {
        sendText(bot, chatId, caption);
      }
    } catch {
      edit(bot, chatId, sent.message_id, `❌ No Wikipedia article found for "<b>${esc(query)}</b>".`);
    }
  });

  // ── /movie ─────────────────────────────────────────────────────────────────
  bot.onText(/\/movie(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query  = (match[1] || '').trim();
    if (!query) return sendText(bot, chatId, `❌ Usage: <code>/movie Inception</code>`);

    const sent = await bot.sendMessage(chatId, `🎬 <b>Looking up movie...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const m   = await movie(query);
      const cap =
        `🎬 <b>${esc(m.Title)}</b> <i>(${esc(m.Year)})</i>\n${DIVIDER}\n\n` +
        `⭐ IMDB: <b>${esc(m.imdbRating)}/10</b>  📊 Votes: ${esc(m.imdbVotes)}\n` +
        `🎭 Genre: ${esc(m.Genre)}\n` +
        `⏱ Runtime: ${esc(m.Runtime)}\n` +
        `📅 Released: ${esc(m.Released)}\n` +
        `🌐 Language: ${esc(m.Language)}\n` +
        `🎬 Director: ${esc(m.Director)}\n` +
        `🎭 Cast: ${esc(m.Actors)}\n` +
        `🏆 Awards: ${esc(m.Awards)}\n\n` +
        `📖 <i>${esc(m.Plot)}</i>\n` +
        FOOTER;

      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});

      if (m.Poster && m.Poster !== 'N/A') {
        await bot.sendPhoto(chatId, m.Poster, { caption: cap, parse_mode: 'HTML' }).catch(() => {
          sendText(bot, chatId, cap);
        });
      } else {
        sendText(bot, chatId, cap);
      }
    } catch (e) {
      edit(bot, chatId, sent.message_id, `❌ Movie not found: <b>${esc(query)}</b>\n\n<i>${esc(e.message)}</i>`);
    }
  });

  // ── /anime ─────────────────────────────────────────────────────────────────
  bot.onText(/\/anime(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query  = (match[1] || '').trim();
    if (!query) return sendText(bot, chatId, `❌ Usage: <code>/anime Naruto</code>`);

    const sent = await bot.sendMessage(chatId, `🎌 <b>Searching anime...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const a     = await anime(query);
      const synopsis = esc(a.synopsis || 'No synopsis available.').slice(0, 500);
      const genres   = (a.genres || []).map(g => g.name).join(', ') || 'N/A';
      const cap =
        `🎌 <b>${esc(a.title_english || a.title)}</b>\n` +
        `<i>${esc(a.title)}</i>\n${DIVIDER}\n\n` +
        `⭐ Score: <b>${a.score || 'N/A'}/10</b>  👥 ${(a.members||0).toLocaleString()} members\n` +
        `📺 Type: ${esc(a.type || 'N/A')}  📋 Episodes: <b>${a.episodes || '?'}</b>\n` +
        `📅 Status: ${esc(a.status || 'N/A')}\n` +
        `🎭 Genres: ${esc(genres)}\n` +
        `📅 Aired: ${esc(a.aired?.string || 'N/A')}\n\n` +
        `📖 <i>${synopsis}${(a.synopsis||'').length > 500 ? '...' : ''}</i>\n` +
        FOOTER;

      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});
      const img = a.images?.jpg?.large_image_url;
      if (img) {
        await bot.sendPhoto(chatId, img, { caption: cap, parse_mode: 'HTML' }).catch(() => {
          sendText(bot, chatId, cap);
        });
      } else {
        sendText(bot, chatId, cap);
      }
    } catch (e) {
      edit(bot, chatId, sent.message_id,
        `❌ Anime not found: <b>${esc(query)}</b>\n\n<i>${esc(e.message)}</i>\n\n💡 Try a more exact title.`
      );
    }
  });

  // ── /lyrics ────────────────────────────────────────────────────────────────
  bot.onText(/\/lyrics(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query  = (match[1] || '').trim();
    if (!query) return sendText(bot, chatId, `❌ Usage: <code>/lyrics Shape of You</code>`);

    const sent = await bot.sendMessage(chatId, `🎵 <b>Finding lyrics...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const result    = await lyrics(query);
      const body      = esc(result.lyrics).slice(0, 3500);
      const truncated = result.lyrics.length > 3500;
      const cap =
        `🎵 <b>${esc(result.title)}</b>\n` +
        `👤 ${esc(result.artist)}\n${DIVIDER}\n\n` +
        body +
        (truncated ? '\n\n<i>... (lyrics truncated)</i>' : '') +
        FOOTER;

      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});

      if (result.cover) {
        await bot.sendPhoto(chatId, result.cover, { caption: cap, parse_mode: 'HTML' }).catch(() => {
          sendText(bot, chatId, cap);
        });
      } else {
        sendText(bot, chatId, cap);
      }
    } catch (e) {
      edit(bot, chatId, sent.message_id,
        `❌ Lyrics not found for "<b>${esc(query)}</b>".\n\n<i>${esc(e.message)}</i>\n\n💡 Try: Artist name + Song title`
      );
    }
  });

  // ── /joke ──────────────────────────────────────────────────────────────────
  bot.onText(/\/joke/, async (msg) => {
    const sent = await bot.sendMessage(msg.chat.id, `😂 <b>Getting a joke...</b>`, HTML).catch(() => null);
    if (!sent) return;
    try {
      const j = await joke();
      edit(bot, msg.chat.id, sent.message_id,
        `😂 <b>Joke</b> <i>(${esc(j.category)})</i>\n${DIVIDER}\n\n` +
        esc(j.joke) + FOOTER
      );
    } catch (e) {
      edit(bot, msg.chat.id, sent.message_id, `❌ ${esc(e.message)}`);
    }
  });

  // ── /quote ─────────────────────────────────────────────────────────────────
  bot.onText(/\/quote/, async (msg) => {
    const sent = await bot.sendMessage(msg.chat.id, `💬 <b>Getting a quote...</b>`, HTML).catch(() => null);
    if (!sent) return;
    try {
      const q = await quote();
      edit(bot, msg.chat.id, sent.message_id,
        `💬 <b>Quote</b>\n${DIVIDER}\n\n` +
        `❝ ${esc(q.text)} ❞\n\n` +
        `— <i>${esc(q.author)}</i>` + FOOTER
      );
    } catch (e) {
      edit(bot, msg.chat.id, sent.message_id, `❌ ${esc(e.message)}`);
    }
  });

  // ── /fact ──────────────────────────────────────────────────────────────────
  bot.onText(/\/fact/, async (msg) => {
    const sent = await bot.sendMessage(msg.chat.id, `🧠 <b>Loading fact...</b>`, HTML).catch(() => null);
    if (!sent) return;
    try {
      const f = await fact();
      edit(bot, msg.chat.id, sent.message_id,
        `🧠 <b>Random Fact</b>\n${DIVIDER}\n\n` +
        esc(f) + FOOTER
      );
    } catch (e) {
      edit(bot, msg.chat.id, sent.message_id, `❌ ${esc(e.message)}`);
    }
  });

  // ── /qr ────────────────────────────────────────────────────────────────────
  bot.onText(/\/qr(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const text   = (match[1] || '').trim();
    if (!text) return sendText(bot, chatId, `❌ Usage: <code>/qr your text or URL</code>`);

    bot.sendChatAction(chatId, 'upload_photo').catch(() => {});
    try {
      await bot.sendPhoto(chatId, qrUrl(text), {
        caption:
          `📱 <b>QR Code</b>\n${DIVIDER}\n\n` +
          `Content: <code>${esc(text.slice(0, 200))}</code>\n` +
          FOOTER,
        parse_mode: 'HTML',
      });
    } catch (e) {
      sendText(bot, chatId, `❌ QR generation failed: ${esc(e.message)}`);
    }
  });

  // ── Catch-all for unknown commands ─────────────────────────────────────────
  const KNOWN_CMDS = /^\/(start|help|ping|id|play|video|tiktok|fb|weather|ai|translate|wiki|movie|anime|lyrics|joke|quote|fact|qr)/;
  bot.on('message', (msg) => {
    if (msg.text?.startsWith('/') && !KNOWN_CMDS.test(msg.text)) {
      sendText(bot, msg.chat.id,
        `❓ Unknown command.\n\n` +
        `Type /help to see all available commands.`
      );
    }
  });

  bot.on('polling_error', (err) => {
    logger.warn({ code: err.code, msg: err.message }, '🤖 Telegram features polling error');
  });

  logger.info('🤖 Telegram features bot started');
  return bot;
}
