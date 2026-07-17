// ╔══════════════════════════════════════════════════════════════════╗
// ║   AA MD Bot — Telegram Features Bot                             ║
// ║   Token: TELEGRAM_FEATURES_BOT_TOKEN                           ║
// ║   All downloads use a multi-API race — single source = fragile  ║
// ╚══════════════════════════════════════════════════════════════════╝

import TelegramBot    from 'node-telegram-bot-api';
import axios          from 'axios';
import { execFile }   from 'child_process';
import { promisify }  from 'util';
import { logger }     from './logger.js';

const execFileAsync = promisify(execFile);
const TOKEN  = process.env.TELEGRAM_FEATURES_BOT_TOKEN;
const YTDLP  = '/home/runner/.local/bin/yt-dlp';
const HTML   = { parse_mode: 'HTML' };

// ── Style constants ─────────────────────────────────────────────────────────
const esc     = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const DIV     = '━━━━━━━━━━━━━━━━━━━━━━━';
const LOGO    = '🤖 <b>AA MD Bot</b>';
const FOOTER  = `\n${DIV}\n${LOGO}`;

function formatDur(sec) {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

// Per-user cooldown
const _cooldowns = new Map();
function applyCooldown(userId, ms = 4000) {
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
    return bot.sendMessage(chatId, text, { parse_mode: 'HTML', ...opts }).catch(() => {});
  }
}

const sendText = (bot, id, text, extra = {}) =>
  bot.sendMessage(id, text, { parse_mode: 'HTML', ...extra }).catch(() => {});

// ── Multi-API YouTube helpers ──────────────────────────────────────────────
const YTID_RX = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/;

async function ytSearchInfo(query) {
  const { stdout } = await execFileAsync(YTDLP, [
    `ytsearch1:${query}`,
    '--dump-json', '--no-download', '--no-playlist', '--quiet',
  ], { timeout: 20000 });
  return JSON.parse(stdout.trim().split('\n')[0]);
}

// Race first successful non-null result
function raceFirst(promises) {
  return new Promise((resolve) => {
    let left = promises.length;
    if (!left) return resolve(null);
    for (const p of promises) {
      Promise.resolve(p)
        .then(v => { if (v) resolve(v); })
        .catch(() => {})
        .finally(() => { if (--left === 0) resolve(null); });
    }
  });
}

// Returns the first URL that looks valid
function pickUrl(data, ...keys) {
  for (const k of keys) {
    const v = k.split('.').reduce((o, kk) => o?.[kk], data);
    if (v && typeof v === 'string' && v.startsWith('http')) return v;
  }
  return null;
}

async function fetchUrl(url, timeout = 15000) {
  const { data } = await axios.get(url, { timeout, headers: { 'User-Agent': 'Mozilla/5.0' } });
  return data;
}

// ── Audio API sources ────────────────────────────────────────────────────────
async function apiDavidMp3(ytUrl) {
  try {
    const d = await fetchUrl(`https://apis.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(ytUrl)}`, 30000);
    return pickUrl(d, 'result.download_url', 'result.downloadUrl', 'result.url', 'url', 'link');
  } catch { return null; }
}
async function apiKeithMp3(ytUrl) {
  try {
    const d = await fetchUrl(`https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(ytUrl)}`);
    return pickUrl(d, 'result.data.downloadUrl', 'result.downloadUrl', 'result.url');
  } catch { return null; }
}
async function apiFaaMp3(ytUrl) {
  try {
    const d = await fetchUrl(`https://api-faa.my.id/faa/ytmp3?url=${encodeURIComponent(ytUrl)}`);
    return pickUrl(d, 'result.mp3', 'result.url', 'url');
  } catch { return null; }
}
async function apiNexrayMp3(ytUrl) {
  try {
    const d = await fetchUrl(`https://api.nexray.web.id/downloader/ytmp3?url=${encodeURIComponent(ytUrl)}`);
    return pickUrl(d, 'result.url', 'data.url', 'url');
  } catch { return null; }
}

// ── Video API sources ────────────────────────────────────────────────────────
async function apiDavidMp4(ytUrl) {
  try {
    const d = await fetchUrl(`https://apis.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(ytUrl)}`, 30000);
    return pickUrl(d, 'result.download_url', 'result.downloadUrl', 'result.url', 'url', 'link');
  } catch { return null; }
}
async function apiKeithMp4(ytUrl) {
  try {
    const d = await fetchUrl(`https://apis-keith.vercel.app/download/dlmp4?url=${encodeURIComponent(ytUrl)}`);
    return pickUrl(d, 'result.data.downloadUrl', 'result.downloadUrl', 'result.url');
  } catch { return null; }
}
async function apiFaaMp4(ytUrl) {
  try {
    const d = await fetchUrl(`https://api-faa.my.id/faa/ytmp4?url=${encodeURIComponent(ytUrl)}`);
    return pickUrl(d, 'result.download_url', 'result.url', 'url');
  } catch { return null; }
}
async function apiNexrayMp4(ytUrl) {
  try {
    const d = await fetchUrl(`https://api.nexray.web.id/downloader/ytmp4?url=${encodeURIComponent(ytUrl)}`);
    return pickUrl(d, 'result.url', 'data.url', 'url');
  } catch { return null; }
}
async function apiAagatzMp4(ytUrl) {
  try {
    const d = await fetchUrl(`https://api.agatz.xyz/api/ytmp4?url=${encodeURIComponent(ytUrl)}`);
    return pickUrl(d, 'data.url', 'url', 'result');
  } catch { return null; }
}
async function apiGtechMp4(ytUrl) {
  try {
    const d = await fetchUrl(`https://gtech-api-xtp1.onrender.com/api/video/yt?url=${encodeURIComponent(ytUrl)}`);
    if (d?.status && d?.result?.media) {
      const hd = d.result.media.video_hd;
      const sd = d.result.media.video_sd;
      const u = (hd && hd !== 'No HD video URL available') ? hd : sd;
      if (u && typeof u === 'string') return u;
    }
  } catch {}
  return null;
}

// Combined resolvers — all sources race simultaneously
async function resolveAudioUrl(videoId) {
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
  return raceFirst([
    apiDavidMp3(ytUrl),
    apiKeithMp3(ytUrl),
    apiFaaMp3(ytUrl),
    apiNexrayMp3(ytUrl),
  ]);
}

async function resolveVideoUrl(videoId) {
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
  return raceFirst([
    apiDavidMp4(ytUrl),
    apiKeithMp4(ytUrl),
    apiFaaMp4(ytUrl),
    apiNexrayMp4(ytUrl),
    apiAagatzMp4(ytUrl),
    apiGtechMp4(ytUrl),
  ]);
}

// ── TikTok ──────────────────────────────────────────────────────────────────
const TT_RX = /https?:\/\/(www\.)?(vm\.|vt\.|m\.)?tiktok\.com\/\S+/i;

async function tikwm(url) {
  const { data } = await axios.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 25000,
  });
  if (data.code !== 0 || !data.data) throw new Error(data.msg || 'TikWM failed');
  return data.data;
}

async function tiklydown(url) {
  const { data } = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 25000,
  });
  if (!data?.videoUrl) throw new Error('Tiklydown: no video URL');
  return { play: data.videoUrl, title: data.title || 'TikTok', author: { unique_id: data.author || '' } };
}

// ── Facebook ────────────────────────────────────────────────────────────────
const FB_RX = /https?:\/\/(www\.|m\.|web\.)?facebook\.com\/\S+|https?:\/\/fb\.watch\/\S+/i;

async function fbVideo(url) {
  const { stdout } = await execFileAsync(YTDLP, [
    '--get-url', '-f', 'best[filesize<45M]/best',
    '--no-playlist', '--quiet', url,
  ], { timeout: 35000 });
  const link = stdout.trim().split('\n')[0];
  if (!link) throw new Error('No URL extracted');
  return link;
}

// ── Instagram ───────────────────────────────────────────────────────────────
const IG_RX = /https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+/i;

async function igDownload(url) {
  // Method 1: tikwm-style endpoint
  try {
    const { data } = await axios.get(`https://www.instagramsaver.io/api/ig?url=${encodeURIComponent(url)}`, { timeout: 20000 });
    const v = data?.data?.[0]?.url || data?.url;
    if (v) return { type: 'video', url: v, author: data?.owner?.username || 'instagram' };
  } catch {}
  // Method 2: yt-dlp
  const { stdout } = await execFileAsync(YTDLP, [
    '--get-url', '-f', 'best[filesize<45M]/best',
    '--no-playlist', '--quiet', url,
  ], { timeout: 30000 });
  const link = stdout.trim().split('\n')[0];
  if (!link) throw new Error('Could not extract Instagram URL');
  return { type: 'video', url: link, author: 'instagram' };
}

// ── Weather ─────────────────────────────────────────────────────────────────
async function weather(city) {
  const { data } = await axios.get(
    `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
    { timeout: 15000, headers: { Accept: 'application/json' } }
  );
  const cur  = data?.current_condition?.[0];
  const area = data?.nearest_area?.[0];
  if (!cur) throw new Error('No weather data returned');
  return {
    city:       area?.areaName?.[0]?.value || city,
    country:    area?.country?.[0]?.value  || '',
    region:     area?.region?.[0]?.value   || '',
    temp_c:     cur.temp_C,
    temp_f:     cur.temp_F,
    feels:      cur.FeelsLikeC,
    humidity:   cur.humidity,
    desc:       cur.weatherDesc?.[0]?.value || '',
    wind:       cur.windspeedKmph,
    uv:         cur.uvIndex,
    visibility: cur.visibility,
    pressure:   cur.pressure,
    cloud:      cur.cloudcover,
  };
}

// ── AI chat (OpenAI model via Pollinations) ──────────────────────────────────
async function aiChat(prompt) {
  const { data } = await axios.post('https://text.pollinations.ai/openai', {
    model:       'openai',
    messages: [
      { role: 'system', content: 'You are a helpful, smart, and friendly AI assistant. Reply clearly and concisely (max 250 words). Use plain text only, no markdown symbols.' },
      { role: 'user',   content: prompt },
    ],
    temperature: 0.7,
    max_tokens:  500,
  }, { headers: { 'Content-Type': 'application/json' }, timeout: 30000 });
  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error('Empty AI response');
  return reply;
}

// ── Translate ────────────────────────────────────────────────────────────────
const LANG_NAMES = {
  en:'English', ur:'Urdu', ar:'Arabic', fr:'French', de:'German',
  es:'Spanish', hi:'Hindi', tr:'Turkish', ru:'Russian', zh:'Chinese',
  ja:'Japanese', ko:'Korean', it:'Italian', pt:'Portuguese', fa:'Persian',
  bn:'Bengali', id:'Indonesian', ms:'Malay', nl:'Dutch', pl:'Polish',
};

async function translate(text, targetLang = 'en') {
  const { data } = await axios.get(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${targetLang}`,
    { timeout: 15000 }
  );
  if (data?.quotaFinished) throw new Error('Daily translation quota finished — try again tomorrow');
  const result = data?.responseData?.translatedText;
  if (!result || result === text) throw new Error('Translation unavailable for this text');
  return result;
}

// ── Wikipedia ────────────────────────────────────────────────────────────────
async function wiki(query) {
  const { data } = await axios.get(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
    { timeout: 15000 }
  );
  if (!data?.extract) throw new Error('No Wikipedia article found');
  return data;
}

// ── Movie (OMDB) ─────────────────────────────────────────────────────────────
async function movie(query) {
  // Try multiple OMDB keys — trilogy is the public demo key, also try others
  const keys = ['trilogy', 'thewdb', 'b9bd48a6'];
  for (const key of keys) {
    try {
      const { data } = await axios.get(
        `https://www.omdbapi.com/?t=${encodeURIComponent(query)}&type=movie&apikey=${key}`,
        { timeout: 15000 }
      );
      if (data?.Response === 'True') return data;
    } catch {}
  }
  // Fallback: TMDB open endpoint
  try {
    const { data: s } = await axios.get(
      `https://api.themoviedb.org/3/search/movie?api_key=8265bd1679663a7ea12ac168da84d2e8&query=${encodeURIComponent(query)}&page=1`,
      { timeout: 15000 }
    );
    const m = s?.results?.[0];
    if (m) {
      return {
        Title:      m.title,
        Year:       (m.release_date || '').slice(0, 4),
        imdbRating: (m.vote_average || 0).toFixed(1),
        imdbVotes:  (m.vote_count || 0).toLocaleString(),
        Genre:      'N/A',
        Runtime:    'N/A',
        Released:   m.release_date || 'N/A',
        Language:   'N/A',
        Director:   'N/A',
        Actors:     'N/A',
        Awards:     'N/A',
        Plot:       m.overview || 'No synopsis available.',
        Poster:     m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : 'N/A',
        Source:     'TMDB',
      };
    }
  } catch {}
  throw new Error('Movie not found');
}

// ── Anime (Jikan v4) ─────────────────────────────────────────────────────────
async function anime(query) {
  const { data } = await axios.get(
    `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1&sfw=true`,
    { timeout: 18000, headers: { 'User-Agent': 'AA-MD-Bot/3.0' } }
  );
  const result = data?.data?.[0];
  if (!result) throw new Error('Anime not found');
  return result;
}

// ── Lyrics ───────────────────────────────────────────────────────────────────
async function lyrics(query) {
  // Primary: lyrics.ovh
  try {
    const { data: s } = await axios.get(
      `https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`,
      { timeout: 12000 }
    );
    const song = s?.data?.[0];
    if (song) {
      const { data: l } = await axios.get(
        `https://api.lyrics.ovh/v1/${encodeURIComponent(song.artist.name)}/${encodeURIComponent(song.title)}`,
        { timeout: 12000 }
      );
      if (l?.lyrics) return { title: song.title, artist: song.artist.name, cover: song.album?.cover_medium, lyrics: l.lyrics };
    }
  } catch {}
  // Fallback: lrclib
  const { data } = await axios.get(
    `https://lrclib.net/api/search?q=${encodeURIComponent(query)}&limit=1`,
    { timeout: 12000 }
  );
  const r = data?.[0];
  if (!r) throw new Error('Lyrics not found');
  return { title: r.trackName, artist: r.artistName, cover: null, lyrics: r.plainLyrics || r.syncedLyrics || 'Lyrics unavailable' };
}

// ── Fun APIs ─────────────────────────────────────────────────────────────────
async function joke() {
  const { data } = await axios.get(
    'https://v2.jokeapi.dev/joke/Programming,Miscellaneous,Pun?blacklistFlags=nsfw,racist,sexist,explicit&type=single',
    { timeout: 12000 }
  );
  if (!data?.joke) throw new Error('No joke returned');
  return { joke: data.joke, category: data.category };
}

async function quote() {
  const { data } = await axios.get('https://zenquotes.io/api/random', { timeout: 12000 });
  const q = Array.isArray(data) ? data[0] : data;
  if (!q?.q) throw new Error('No quote returned');
  return { text: q.q, author: q.a };
}

async function fact() {
  // Primary: uselessfacts
  try {
    const { data } = await axios.get(
      'https://uselessfacts.jsph.pl/api/v2/facts/random?language=en',
      { timeout: 12000 }
    );
    if (data?.text) return data.text;
  } catch {}
  // Fallback: chucknorris
  const { data } = await axios.get('https://api.chucknorris.io/jokes/random', { timeout: 12000 });
  if (!data?.value) throw new Error('No fact returned');
  return data.value;
}

// ── QR Code ──────────────────────────────────────────────────────────────────
const qrUrl = (text) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=12&data=${encodeURIComponent(text)}`;

// ══════════════════════════════════════════════════════════════════════════════
// Bot init
// ══════════════════════════════════════════════════════════════════════════════
export function initTelegramFeatures() {
  if (!TOKEN) {
    logger.warn('⚡ TELEGRAM_FEATURES_BOT_TOKEN not set — features bot disabled');
    return;
  }

  const bot = new TelegramBot(TOKEN, { polling: true });

  // ── /start ──────────────────────────────────────────────────────────────────
  bot.onText(/\/start/, (msg) => {
    const name = esc(msg.from?.first_name || 'there');
    sendText(bot, msg.chat.id,
      `👋 <b>Hello, ${name}!</b>\n\n` +
      `🤖 <b>AA MD Bot — Telegram Edition</b>\n${DIV}\n\n` +
      `Your WhatsApp bot, now on Telegram.\n\n` +
      `📋 Type /help to see all commands.\n` +
      `💡 <i>Everything works right here — no WhatsApp needed!</i>` +
      FOOTER
    );
  });

  // ── /help ───────────────────────────────────────────────────────────────────
  bot.onText(/\/help/, (msg) => {
    sendText(bot, msg.chat.id,
      `📋 <b>AA MD Bot — Command List</b>\n${DIV}\n\n` +

      `🎵 <b>Downloads</b>\n` +
      `┣ /play <i>song name or URL</i>\n` +
      `┣ /video <i>title or YouTube URL</i>\n` +
      `┣ /tiktok <i>url</i> — TikTok video\n` +
      `┣ /ig <i>url</i> — Instagram reel/post\n` +
      `┗ /fb <i>url</i> — Facebook video\n\n` +

      `🔍 <b>Search & Info</b>\n` +
      `┣ /wiki <i>query</i> — Wikipedia\n` +
      `┣ /movie <i>title</i> — Movie details\n` +
      `┣ /anime <i>title</i> — Anime info\n` +
      `┗ /lyrics <i>song name</i> — Song lyrics\n\n` +

      `🌐 <b>Utilities</b>\n` +
      `┣ /weather <i>city</i> — Live weather\n` +
      `┣ /translate <i>text</i> — To English\n` +
      `┃   <i>or /translate ur: Hello → Urdu</i>\n` +
      `┗ /qr <i>text or URL</i> — QR code\n\n` +

      `🤖 <b>AI & Fun</b>\n` +
      `┣ /ai <i>question</i> — Ask AI anything\n` +
      `┣ /joke — Random joke\n` +
      `┣ /quote — Inspirational quote\n` +
      `┗ /fact — Random interesting fact\n\n` +

      `⚙️ <b>General</b>\n` +
      `┣ /ping — Check bot speed\n` +
      `┗ /id — Your Telegram info\n` +
      FOOTER
    );
  });

  // ── /ping ───────────────────────────────────────────────────────────────────
  bot.onText(/\/ping/, async (msg) => {
    const t0   = Date.now();
    const sent = await bot.sendMessage(msg.chat.id, '🏓 <i>Pinging...</i>', HTML).catch(() => null);
    if (!sent) return;
    const ms    = Date.now() - t0;
    const upSec = Math.floor(process.uptime());
    const upStr = upSec > 3600
      ? `${Math.floor(upSec/3600)}h ${Math.floor((upSec%3600)/60)}m`
      : `${Math.floor(upSec/60)}m ${upSec%60}s`;
    edit(bot, msg.chat.id, sent.message_id,
      `🏓 <b>Pong!</b>  <code>${ms}ms</code>\n${DIV}\n\n` +
      `⏱ Uptime: <b>${esc(upStr)}</b>\n` +
      `💾 RAM: ${Math.round(process.memoryUsage().heapUsed/1024/1024)} MB used\n` +
      `📦 Node: ${esc(process.version)}` +
      FOOTER
    );
  });

  // ── /id ─────────────────────────────────────────────────────────────────────
  bot.onText(/\/id/, (msg) => {
    const u = msg.from;
    sendText(bot, msg.chat.id,
      `🪪 <b>Your Telegram Info</b>\n${DIV}\n\n` +
      `👤 <b>User ID:</b> <code>${u?.id}</code>\n` +
      `📛 <b>Name:</b> ${esc((u?.first_name || '') + ' ' + (u?.last_name || '')).trim()}\n` +
      `🔖 <b>Username:</b> ${u?.username ? '@' + esc(u.username) : 'None'}\n` +
      `🌐 <b>Language:</b> ${esc(u?.language_code || 'N/A')}\n\n` +
      `💬 <b>Chat ID:</b> <code>${msg.chat.id}</code>\n` +
      `📂 <b>Chat type:</b> ${esc(msg.chat.type)}\n` +
      FOOTER
    );
  });

  // ── /play ───────────────────────────────────────────────────────────────────
  bot.onText(/\/play(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query  = (match[1] || '').trim();
    if (!query) return sendText(bot, chatId,
      `❌ <b>Usage:</b> <code>/play song name or YouTube link</code>\n\n` +
      `<i>Example: /play Noor-e-Muhammad</i>`
    );

    const wait = applyCooldown(msg.from.id, 5000);
    if (wait) return sendText(bot, chatId, `⏳ Please wait <b>${wait}s</b> before the next command.`);

    const sent = await bot.sendMessage(chatId, `🔍 <b>Searching...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      let videoId, title, thumb, duration;
      const ytMatch = query.match(YTID_RX);

      if (ytMatch) {
        videoId = ytMatch[1];
        title   = 'YouTube Audio';
      } else {
        await edit(bot, chatId, sent.message_id, `🔍 <b>Searching:</b> <i>${esc(query)}</i>...`);
        const info = await ytSearchInfo(query);
        videoId  = info.id;
        title    = info.title || query;
        thumb    = info.thumbnail;
        duration = formatDur(info.duration);
      }

      await edit(bot, chatId, sent.message_id,
        `⏬ <b>Downloading audio...</b>\n\n` +
        `🎵 <b>${esc(title)}</b>\n` +
        `${duration ? `⏱ ${esc(duration)}` : ''}\n\n` +
        `<i>Connecting to fastest source...</i>`
      );

      const audioUrl = await resolveAudioUrl(videoId);
      if (!audioUrl) throw new Error('All download sources failed');

      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});
      await bot.sendChatAction(chatId, 'upload_voice').catch(() => {});

      await bot.sendAudio(chatId, audioUrl, {
        caption:
          `🎵 <b>${esc(title)}</b>\n` +
          `${duration ? `⏱ ${esc(duration)}\n` : ''}` +
          FOOTER,
        parse_mode: 'HTML',
        title: title,
      }).catch(async () => {
        await bot.sendDocument(chatId, audioUrl, {
          caption: `🎵 <b>${esc(title)}</b>\n${FOOTER}`,
          parse_mode: 'HTML',
        }).catch(() => {});
      });

    } catch (e) {
      edit(bot, chatId, sent.message_id,
        `❌ <b>Audio download failed</b>\n\n` +
        `<i>${esc(e.message)}</i>\n\n` +
        `💡 Try a different song name or paste the YouTube URL directly.`
      );
    }
  });

  // ── /video ──────────────────────────────────────────────────────────────────
  bot.onText(/\/video(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query  = (match[1] || '').trim();
    if (!query) return sendText(bot, chatId,
      `❌ <b>Usage:</b> <code>/video title or YouTube URL</code>\n\n` +
      `<i>Example: /video Shape of You Ed Sheeran</i>`
    );

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
        await edit(bot, chatId, sent.message_id, `🔍 <b>Searching:</b> <i>${esc(query)}</i>...`);
        const info = await ytSearchInfo(query);
        videoId  = info.id;
        title    = info.title || query;
        duration = formatDur(info.duration);
      }

      await edit(bot, chatId, sent.message_id,
        `⏬ <b>Downloading video...</b>\n\n` +
        `🎬 <b>${esc(title)}</b>\n` +
        `${duration ? `⏱ ${esc(duration)}\n` : ''}` +
        `\n<i>Connecting to fastest source...</i>`
      );

      const videoUrl = await resolveVideoUrl(videoId);
      if (!videoUrl) throw new Error('All download sources failed — video may be unavailable');

      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});
      await bot.sendChatAction(chatId, 'upload_video').catch(() => {});

      await bot.sendVideo(chatId, videoUrl, {
        caption:
          `🎬 <b>${esc(title)}</b>\n` +
          `${duration ? `⏱ ${esc(duration)}\n` : ''}` +
          FOOTER,
        parse_mode: 'HTML',
        supports_streaming: true,
      }).catch(async () => {
        await bot.sendDocument(chatId, videoUrl, {
          caption: `🎬 <b>${esc(title)}</b>\n${FOOTER}`,
          parse_mode: 'HTML',
        }).catch(() => {});
      });

    } catch (e) {
      edit(bot, chatId, sent.message_id,
        `❌ <b>Video download failed</b>\n\n` +
        `<i>${esc(e.message)}</i>\n\n` +
        `💡 Try /play for audio-only, or paste the direct YouTube URL.`
      );
    }
  });

  // ── /tiktok ─────────────────────────────────────────────────────────────────
  bot.onText(/\/tiktok(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url    = (match[1] || '').trim();
    if (!url || !TT_RX.test(url))
      return sendText(bot, chatId,
        `❌ <b>Usage:</b> <code>/tiktok https://tiktok.com/...</code>\n\n` +
        `<i>Supports vt.tiktok.com short links too</i>`
      );

    const wait = applyCooldown(msg.from.id, 5000);
    if (wait) return sendText(bot, chatId, `⏳ Please wait <b>${wait}s</b>.`);

    const sent = await bot.sendMessage(chatId, `⏬ <b>Fetching TikTok...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      // Race both APIs
      let d = await raceFirst([tikwm(url).catch(() => null), tiklydown(url).catch(() => null)]);
      if (!d) throw new Error('All TikTok sources failed');

      const cap =
        `🎵 <b>${esc(d.title || 'TikTok')}</b>\n\n` +
        `👤 @${esc(d.author?.unique_id || 'unknown')}\n` +
        (d.digg_count ? `❤️ ${Number(d.digg_count).toLocaleString()}` : '') +
        (d.comment_count ? `  💬 ${Number(d.comment_count).toLocaleString()}` : '') +
        '\n' + FOOTER;

      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});

      if (d.images?.length) {
        const media = d.images.slice(0, 10).map((img, i) => ({
          type: 'photo', media: img,
          ...(i === 0 ? { caption: cap, parse_mode: 'HTML' } : {}),
        }));
        await bot.sendMediaGroup(chatId, media).catch(async () => {
          await bot.sendPhoto(chatId, d.images[0], { caption: cap, parse_mode: 'HTML' }).catch(() => {});
        });
      } else if (d.play) {
        await bot.sendVideo(chatId, d.play, { caption: cap, parse_mode: 'HTML' }).catch(async () => {
          await bot.sendDocument(chatId, d.play, { caption: cap, parse_mode: 'HTML' }).catch(() => {});
        });
      } else {
        sendText(bot, chatId, `❌ Could not extract media from this TikTok.`);
      }

    } catch (e) {
      edit(bot, chatId, sent.message_id,
        `❌ <b>TikTok failed</b>\n\n<i>${esc(e.message)}</i>\n\n` +
        `💡 Make sure the link is public and not expired.`
      );
    }
  });

  // ── /ig ─────────────────────────────────────────────────────────────────────
  bot.onText(/\/ig(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url    = (match[1] || '').trim();
    if (!url || !IG_RX.test(url))
      return sendText(bot, chatId,
        `❌ <b>Usage:</b> <code>/ig https://instagram.com/p/...</code>\n\n` +
        `<i>Supports posts, reels, and IGTV</i>`
      );

    const wait = applyCooldown(msg.from.id, 5000);
    if (wait) return sendText(bot, chatId, `⏳ Please wait <b>${wait}s</b>.`);

    const sent = await bot.sendMessage(chatId, `⏬ <b>Fetching Instagram...</b>\n<i>May take a moment...</i>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const result = await igDownload(url);
      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});
      const cap = `📸 <b>Instagram</b>\n👤 @${esc(result.author)}\n${FOOTER}`;
      await bot.sendVideo(chatId, result.url, { caption: cap, parse_mode: 'HTML' }).catch(async () => {
        await bot.sendDocument(chatId, result.url, { caption: cap, parse_mode: 'HTML' }).catch(() => {});
      });
    } catch (e) {
      edit(bot, chatId, sent.message_id,
        `❌ <b>Instagram download failed</b>\n\n<i>${esc(e.message)}</i>\n\n` +
        `💡 Make sure the post is public (not private or restricted).`
      );
    }
  });

  // ── /fb ─────────────────────────────────────────────────────────────────────
  bot.onText(/\/fb(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url    = (match[1] || '').trim();
    if (!url || !FB_RX.test(url))
      return sendText(bot, chatId,
        `❌ <b>Usage:</b> <code>/fb https://facebook.com/...</code>\n\n` +
        `<i>Video must be public</i>`
      );

    const wait = applyCooldown(msg.from.id, 5000);
    if (wait) return sendText(bot, chatId, `⏳ Please wait <b>${wait}s</b>.`);

    const sent = await bot.sendMessage(chatId, `⏬ <b>Downloading Facebook video...</b>\n<i>Please wait...</i>`, HTML).catch(() => null);
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
        }).catch(() => {});
      });
    } catch (e) {
      edit(bot, chatId, sent.message_id,
        `❌ <b>Facebook download failed</b>\n\n<i>${esc(e.message)}</i>\n\n` +
        `💡 Ensure the video is public.`
      );
    }
  });

  // ── /weather ────────────────────────────────────────────────────────────────
  bot.onText(/\/weather(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const city   = (match[1] || '').trim();
    if (!city) return sendText(bot, chatId, `❌ <b>Usage:</b> <code>/weather Karachi</code>`);

    const sent = await bot.sendMessage(chatId, `🌍 <b>Fetching weather for ${esc(city)}...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const w = await weather(city);
      const emoji =
        /thunder|storm/i.test(w.desc) ? '⛈' :
        /drizzle|shower|rain/i.test(w.desc) ? '🌧' :
        /snow|blizzard/i.test(w.desc) ? '❄️' :
        /fog|mist|haze/i.test(w.desc) ? '🌫' :
        /cloud|overcast/i.test(w.desc) ? '⛅' :
        /clear|sunny/i.test(w.desc) ? '☀️' : '🌤';

      edit(bot, chatId, sent.message_id,
        `${emoji} <b>Weather — ${esc(w.city)}, ${esc(w.country)}</b>\n${DIV}\n\n` +
        `🌡 <b>Temperature:</b> ${esc(w.temp_c)}°C  /  ${esc(w.temp_f)}°F\n` +
        `🤔 <b>Feels like:</b> ${esc(w.feels)}°C\n` +
        `☁️ <b>Condition:</b> ${esc(w.desc)}\n\n` +
        `💧 Humidity: <b>${esc(w.humidity)}%</b>\n` +
        `💨 Wind: <b>${esc(w.wind)} km/h</b>\n` +
        `☁ Cloud cover: <b>${esc(w.cloud)}%</b>\n` +
        `👁 Visibility: <b>${esc(w.visibility)} km</b>\n` +
        `🔵 Pressure: <b>${esc(w.pressure)} hPa</b>\n` +
        `☀️ UV Index: <b>${esc(w.uv)}</b>\n` +
        FOOTER
      );
    } catch {
      edit(bot, chatId, sent.message_id,
        `❌ Weather not found for "<b>${esc(city)}</b>".\n\nCheck the city name and try again.`
      );
    }
  });

  // ── /ai ─────────────────────────────────────────────────────────────────────
  bot.onText(/\/ai(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const prompt = (match[1] || '').trim();
    if (!prompt) return sendText(bot, chatId,
      `❌ <b>Usage:</b> <code>/ai your question</code>\n\n` +
      `<i>Example: /ai What is quantum computing?</i>`
    );

    const wait = applyCooldown(msg.from.id, 5000);
    if (wait) return sendText(bot, chatId, `⏳ Please wait <b>${wait}s</b>.`);

    const sent = await bot.sendMessage(chatId, `🤖 <b>Thinking...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      await bot.sendChatAction(chatId, 'typing').catch(() => {});
      const reply = await aiChat(prompt);
      edit(bot, chatId, sent.message_id,
        `🤖 <b>AI Reply</b>\n${DIV}\n\n` +
        esc(reply) +
        FOOTER
      );
    } catch (e) {
      edit(bot, chatId, sent.message_id,
        `❌ <b>AI error</b>\n\n<i>${esc(e.message)}</i>\n\n💡 Try rephrasing your question.`
      );
    }
  });

  // ── /translate ───────────────────────────────────────────────────────────────
  bot.onText(/\/translate(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    let input    = (match[1] || '').trim();
    if (!input) return sendText(bot, chatId,
      `❌ <b>Usage:</b>\n` +
      `<code>/translate Hello</code> → English\n` +
      `<code>/translate ur: Hello</code> → Urdu\n\n` +
      `<b>Language codes:</b> en ur ar hi fr de es tr ru zh ja ko pt id ms`
    );

    let targetLang = 'en';
    if (/^[a-z]{2}:\s*/i.test(input)) {
      targetLang = input.slice(0, 2).toLowerCase();
      input      = input.slice(input.indexOf(':') + 1).trim();
    }

    const sent = await bot.sendMessage(chatId, `🌐 <b>Translating...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const result   = await translate(input, targetLang);
      const langName = esc(LANG_NAMES[targetLang] || targetLang.toUpperCase());
      edit(bot, chatId, sent.message_id,
        `🌐 <b>Translation → ${langName}</b>\n${DIV}\n\n` +
        `<b>Original:</b>\n<i>${esc(input)}</i>\n\n` +
        `<b>Translated:</b>\n${esc(result)}\n` +
        FOOTER
      );
    } catch (e) {
      edit(bot, chatId, sent.message_id, `❌ Translation failed: <i>${esc(e.message)}</i>`);
    }
  });

  // ── /wiki ────────────────────────────────────────────────────────────────────
  bot.onText(/\/wiki(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query  = (match[1] || '').trim();
    if (!query) return sendText(bot, chatId, `❌ <b>Usage:</b> <code>/wiki Pakistan</code>`);

    const sent = await bot.sendMessage(chatId, `🔍 <b>Searching Wikipedia...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const w       = await wiki(query);
      const extract = esc(w.extract || '').slice(0, 900);
      const caption =
        `📖 <b>${esc(w.title)}</b>\n${DIV}\n\n` +
        extract +
        (w.extract?.length > 900 ? `...\n\n<a href="${esc(w.content_urls?.desktop?.page || '')}">Read more →</a>` : '') +
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
      edit(bot, chatId, sent.message_id,
        `❌ No Wikipedia article found for "<b>${esc(query)}</b>".\n\nCheck the spelling and try again.`
      );
    }
  });

  // ── /movie ───────────────────────────────────────────────────────────────────
  bot.onText(/\/movie(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query  = (match[1] || '').trim();
    if (!query) return sendText(bot, chatId, `❌ <b>Usage:</b> <code>/movie Inception</code>`);

    const sent = await bot.sendMessage(chatId, `🎬 <b>Looking up movie...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const m   = await movie(query);
      const src = m.Source === 'TMDB' ? ' <i>(via TMDB)</i>' : '';
      const cap =
        `🎬 <b>${esc(m.Title)}</b> <i>(${esc(m.Year)})</i>${src}\n${DIV}\n\n` +
        `⭐ <b>Rating:</b> ${esc(m.imdbRating)}/10  📊 Votes: ${esc(m.imdbVotes)}\n` +
        (m.Genre !== 'N/A' ? `🎭 <b>Genre:</b> ${esc(m.Genre)}\n` : '') +
        (m.Runtime !== 'N/A' ? `⏱ <b>Runtime:</b> ${esc(m.Runtime)}\n` : '') +
        `📅 <b>Released:</b> ${esc(m.Released)}\n` +
        (m.Director !== 'N/A' ? `🎬 <b>Director:</b> ${esc(m.Director)}\n` : '') +
        (m.Actors !== 'N/A' ? `🎭 <b>Cast:</b> ${esc(m.Actors)}\n` : '') +
        (m.Awards && m.Awards !== 'N/A' ? `🏆 <b>Awards:</b> ${esc(m.Awards)}\n` : '') +
        `\n📖 <i>${esc(m.Plot)}</i>\n` +
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
      edit(bot, chatId, sent.message_id,
        `❌ Movie not found: "<b>${esc(query)}</b>"\n\n<i>${esc(e.message)}</i>`
      );
    }
  });

  // ── /anime ───────────────────────────────────────────────────────────────────
  bot.onText(/\/anime(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query  = (match[1] || '').trim();
    if (!query) return sendText(bot, chatId, `❌ <b>Usage:</b> <code>/anime Naruto</code>`);

    const sent = await bot.sendMessage(chatId, `🎌 <b>Searching anime...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const a        = await anime(query);
      const synopsis = esc(a.synopsis || 'No synopsis available.').slice(0, 500);
      const genres   = (a.genres || []).map(g => g.name).join(', ') || 'N/A';
      const cap =
        `🎌 <b>${esc(a.title_english || a.title)}</b>\n` +
        `<i>${esc(a.title)}</i>\n${DIV}\n\n` +
        `⭐ <b>Score:</b> ${a.score || 'N/A'}/10  👥 ${(a.members||0).toLocaleString()} members\n` +
        `📺 <b>Type:</b> ${esc(a.type || 'N/A')}  📋 Episodes: <b>${a.episodes || '?'}</b>\n` +
        `📅 <b>Status:</b> ${esc(a.status || 'N/A')}\n` +
        `🎭 <b>Genres:</b> ${esc(genres)}\n` +
        `📅 <b>Aired:</b> ${esc(a.aired?.string || 'N/A')}\n\n` +
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
        `❌ Anime not found: "<b>${esc(query)}</b>"\n\n<i>${esc(e.message)}</i>\n\n💡 Try a more exact title.`
      );
    }
  });

  // ── /lyrics ──────────────────────────────────────────────────────────────────
  bot.onText(/\/lyrics(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query  = (match[1] || '').trim();
    if (!query) return sendText(bot, chatId, `❌ <b>Usage:</b> <code>/lyrics Shape of You</code>`);

    const sent = await bot.sendMessage(chatId, `🎵 <b>Finding lyrics...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const result    = await lyrics(query);
      const body      = esc(result.lyrics).slice(0, 3500);
      const truncated = result.lyrics.length > 3500;
      const cap =
        `🎵 <b>${esc(result.title)}</b>\n` +
        `👤 ${esc(result.artist)}\n${DIV}\n\n` +
        body +
        (truncated ? '\n\n<i>… (lyrics truncated)</i>' : '') +
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
        `❌ Lyrics not found for "<b>${esc(query)}</b>"\n\n<i>${esc(e.message)}</i>\n\n💡 Try: Artist + Song title`
      );
    }
  });

  // ── /joke ────────────────────────────────────────────────────────────────────
  bot.onText(/\/joke/, async (msg) => {
    const sent = await bot.sendMessage(msg.chat.id, `😂 <b>Getting a joke...</b>`, HTML).catch(() => null);
    if (!sent) return;
    try {
      const j = await joke();
      edit(bot, msg.chat.id, sent.message_id,
        `😂 <b>Joke</b> <i>(${esc(j.category)})</i>\n${DIV}\n\n${esc(j.joke)}` + FOOTER
      );
    } catch (e) {
      edit(bot, msg.chat.id, sent.message_id, `❌ ${esc(e.message)}`);
    }
  });

  // ── /quote ───────────────────────────────────────────────────────────────────
  bot.onText(/\/quote/, async (msg) => {
    const sent = await bot.sendMessage(msg.chat.id, `💬 <b>Getting a quote...</b>`, HTML).catch(() => null);
    if (!sent) return;
    try {
      const q = await quote();
      edit(bot, msg.chat.id, sent.message_id,
        `💬 <b>Quote of the Day</b>\n${DIV}\n\n` +
        `❝ ${esc(q.text)} ❞\n\n` +
        `— <i>${esc(q.author)}</i>` + FOOTER
      );
    } catch (e) {
      edit(bot, msg.chat.id, sent.message_id, `❌ ${esc(e.message)}`);
    }
  });

  // ── /fact ────────────────────────────────────────────────────────────────────
  bot.onText(/\/fact/, async (msg) => {
    const sent = await bot.sendMessage(msg.chat.id, `🧠 <b>Loading fact...</b>`, HTML).catch(() => null);
    if (!sent) return;
    try {
      const f = await fact();
      edit(bot, msg.chat.id, sent.message_id,
        `🧠 <b>Random Fact</b>\n${DIV}\n\n${esc(f)}` + FOOTER
      );
    } catch (e) {
      edit(bot, msg.chat.id, sent.message_id, `❌ ${esc(e.message)}`);
    }
  });

  // ── /qr ──────────────────────────────────────────────────────────────────────
  bot.onText(/\/qr(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const text   = (match[1] || '').trim();
    if (!text) return sendText(bot, chatId,
      `❌ <b>Usage:</b> <code>/qr your text or URL</code>\n\n<i>Example: /qr https://google.com</i>`
    );

    await bot.sendChatAction(chatId, 'upload_photo').catch(() => {});
    try {
      await bot.sendPhoto(chatId, qrUrl(text), {
        caption:
          `📱 <b>QR Code Generated</b>\n${DIV}\n\n` +
          `Content: <code>${esc(text.slice(0, 200))}</code>\n` +
          FOOTER,
        parse_mode: 'HTML',
      });
    } catch (e) {
      sendText(bot, chatId, `❌ QR generation failed: ${esc(e.message)}`);
    }
  });

  // ── Catch-all for unknown commands ───────────────────────────────────────────
  const KNOWN = /^\/(start|help|ping|id|play|video|tiktok|ig|fb|weather|ai|translate|wiki|movie|anime|lyrics|joke|quote|fact|qr)/;
  bot.on('message', (msg) => {
    if (msg.text?.startsWith('/') && !KNOWN.test(msg.text)) {
      sendText(bot, msg.chat.id,
        `❓ <b>Unknown command</b>\n\nType /help to see all available commands.`
      );
    }
  });

  bot.on('polling_error', (err) => {
    logger.warn({ code: err.code, msg: err.message }, '🤖 Telegram features polling error');
  });

  logger.info('🤖 Telegram features bot started');
  return bot;
}
