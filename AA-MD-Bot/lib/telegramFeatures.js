// ╔══════════════════════════════════════════════════════════════════╗
// ║   AA MD Bot — Telegram Features Bot  v2                         ║
// ║   Token: TELEGRAM_FEATURES_BOT_TOKEN                            ║
// ║   Downloads: multi-API race (6 sources, fastest wins)           ║
// ╚══════════════════════════════════════════════════════════════════╝

import TelegramBot    from 'node-telegram-bot-api';
import axios          from 'axios';
import { execFile }   from 'child_process';
import { promisify }  from 'util';
import { logger }     from './logger.js';
import playdl         from 'play-dl';

const execFileAsync = promisify(execFile);
const TOKEN  = process.env.TELEGRAM_FEATURES_BOT_TOKEN;
const YTDLP  = '/home/runner/.local/bin/yt-dlp';
const HTML   = { parse_mode: 'HTML' };

// ── Style ────────────────────────────────────────────────────────────────────
const esc    = (s) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const DIV    = '━━━━━━━━━━━━━━━━━━━━━━';
const FOOTER = `\n${DIV}\n🤖 <b>AA MD Bot</b>`;

function formatDur(sec) {
  if (!sec) return '';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

// Per-user cooldown
const _cd = new Map();
function cooldown(uid, ms = 4000) {
  const now = Date.now(), last = _cd.get(uid) || 0, wait = ms - (now - last);
  if (wait > 0) return Math.ceil(wait / 1000);
  _cd.set(uid, now);
  return 0;
}

// Edit-in-place fallback helper
async function edit(bot, chatId, msgId, text, opts = {}) {
  try { return await bot.editMessageText(text, { chat_id: chatId, message_id: msgId, parse_mode: 'HTML', ...opts }); }
  catch { return bot.sendMessage(chatId, text, { parse_mode: 'HTML', ...opts }).catch(() => {}); }
}

const sendText = (bot, id, text, extra = {}) =>
  bot.sendMessage(id, text, { parse_mode: 'HTML', ...extra }).catch(() => {});

// Race first non-null result
function raceFirst(promises) {
  return new Promise(resolve => {
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

function pickUrl(data, ...keys) {
  for (const k of keys) {
    const v = k.split('.').reduce((o, kk) => o?.[kk], data);
    if (v && typeof v === 'string' && v.startsWith('http')) return v;
  }
  return null;
}

async function fetchUrl(url, timeout = 18000) {
  const { data } = await axios.get(url, { timeout, headers: { 'User-Agent': 'Mozilla/5.0' } });
  return data;
}

// ── YouTube ──────────────────────────────────────────────────────────────────
const YTID_RX = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/;

async function ytSearchInfo(query) {
  try {
    // Use play-dl (no yt-dlp required)
    const results = await playdl.search(query, { source: { youtube: 'video' }, limit: 1 });
    if (!results?.length) throw new Error('No results');
    const v = results[0];
    return { id: v.id, title: v.title, duration: v.durationInSec };
  } catch (e) {
    // Fallback: try YouTube search via free API
    const { data } = await axios.get(
      `https://yt.lemnoslife.com/noKey/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=1`,
      { timeout: 15000, headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const item = data?.items?.[0];
    if (!item) throw new Error('No results found for: ' + query);
    return { id: item.id?.videoId, title: item.snippet?.title, duration: 0 };
  }
}

// ── Audio API sources ────────────────────────────────────────────────────────
const mkYtUrl = (id) => `https://www.youtube.com/watch?v=${id}`;

async function mp3David(id)  { try { const d = await fetchUrl(`https://apis.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(mkYtUrl(id))}`,30000); return pickUrl(d,'result.download_url','result.downloadUrl','result.url','url','link'); } catch { return null; } }
async function mp3Keith(id)  { try { const d = await fetchUrl(`https://apis-keith.vercel.app/download/dlmp3?url=${encodeURIComponent(mkYtUrl(id))}`); return pickUrl(d,'result.data.downloadUrl','result.downloadUrl','result.url'); } catch { return null; } }
async function mp3Faa(id)    { try { const d = await fetchUrl(`https://api-faa.my.id/faa/ytmp3?url=${encodeURIComponent(mkYtUrl(id))}`); return pickUrl(d,'result.mp3','result.url','url'); } catch { return null; } }
async function mp3Nexray(id) { try { const d = await fetchUrl(`https://api.nexray.web.id/downloader/ytmp3?url=${encodeURIComponent(mkYtUrl(id))}`); return pickUrl(d,'result.url','data.url','url'); } catch { return null; } }

// ── Video API sources ────────────────────────────────────────────────────────
async function mp4David(id)  { try { const d = await fetchUrl(`https://apis.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(mkYtUrl(id))}`,30000); return pickUrl(d,'result.download_url','result.downloadUrl','result.url','url','link'); } catch { return null; } }
async function mp4Keith(id)  { try { const d = await fetchUrl(`https://apis-keith.vercel.app/download/dlmp4?url=${encodeURIComponent(mkYtUrl(id))}`); return pickUrl(d,'result.data.downloadUrl','result.downloadUrl','result.url'); } catch { return null; } }
async function mp4Faa(id)    { try { const d = await fetchUrl(`https://api-faa.my.id/faa/ytmp4?url=${encodeURIComponent(mkYtUrl(id))}`); return pickUrl(d,'result.download_url','result.url','url'); } catch { return null; } }
async function mp4Nexray(id) { try { const d = await fetchUrl(`https://api.nexray.web.id/downloader/ytmp4?url=${encodeURIComponent(mkYtUrl(id))}`); return pickUrl(d,'result.url','data.url','url'); } catch { return null; } }
async function mp4Agatz(id)  { try { const d = await fetchUrl(`https://api.agatz.xyz/api/ytmp4?url=${encodeURIComponent(mkYtUrl(id))}`); return pickUrl(d,'data.url','url','result'); } catch { return null; } }
async function mp4Gtech(id)  {
  try {
    const d = await fetchUrl(`https://gtech-api-xtp1.onrender.com/api/video/yt?url=${encodeURIComponent(mkYtUrl(id))}`);
    if (d?.status && d?.result?.media) {
      const hd = d.result.media.video_hd, sd = d.result.media.video_sd;
      const u = (hd && hd !== 'No HD video URL available') ? hd : sd;
      if (u && typeof u === 'string') return u;
    }
  } catch {}
  return null;
}

const resolveAudio = (id) => raceFirst([mp3David(id), mp3Keith(id), mp3Faa(id), mp3Nexray(id)]);
const resolveVideo = (id) => raceFirst([mp4David(id), mp4Keith(id), mp4Faa(id), mp4Nexray(id), mp4Agatz(id), mp4Gtech(id)]);

// ── TikTok ───────────────────────────────────────────────────────────────────
const TT_RX = /https?:\/\/(www\.)?(vm\.|vt\.|m\.)?tiktok\.com\/\S+/i;

async function tikwm(url)  {
  const { data } = await axios.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}`, { headers: { 'User-Agent':'Mozilla/5.0' }, timeout: 25000 });
  if (data.code !== 0 || !data.data) throw new Error(data.msg || 'TikWM failed');
  return data.data;
}
async function tikly(url) {
  const { data } = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, { headers: { 'User-Agent':'Mozilla/5.0' }, timeout: 25000 });
  if (!data?.videoUrl) throw new Error('No video URL');
  return { play: data.videoUrl, title: data.title || 'TikTok', author: { unique_id: data.author || '' } };
}

// ── Facebook ─────────────────────────────────────────────────────────────────
const FB_RX = /https?:\/\/(www\.|m\.|web\.)?facebook\.com\/\S+|https?:\/\/fb\.watch\/\S+/i;
async function fbDl(url) {
  const { stdout } = await execFileAsync(YTDLP, ['--get-url','-f','best[filesize<45M]/best','--no-playlist','--quiet',url], { timeout: 35000 });
  const link = stdout.trim().split('\n')[0];
  if (!link) throw new Error('No URL extracted');
  return link;
}

// ── Instagram ────────────────────────────────────────────────────────────────
const IG_RX = /https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+/i;
async function igDl(url) {
  const { stdout } = await execFileAsync(YTDLP, ['--get-url','-f','best[filesize<45M]/best','--no-playlist','--quiet',url], { timeout: 32000 });
  const link = stdout.trim().split('\n')[0];
  if (!link) throw new Error('Could not extract URL — post may be private');
  return link;
}

// ── Weather ──────────────────────────────────────────────────────────────────
async function weather(city) {
  const { data } = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, { timeout: 15000, headers: { Accept:'application/json' } });
  const cur = data?.current_condition?.[0], area = data?.nearest_area?.[0];
  if (!cur) throw new Error('No data returned');
  return {
    city:    area?.areaName?.[0]?.value || city,
    country: area?.country?.[0]?.value  || '',
    temp_c:  cur.temp_C, temp_f: cur.temp_F, feels: cur.FeelsLikeC,
    humidity: cur.humidity, desc: cur.weatherDesc?.[0]?.value || '',
    wind: cur.windspeedKmph, uv: cur.uvIndex, vis: cur.visibility,
    pressure: cur.pressure, cloud: cur.cloudcover,
  };
}

// ── AI — per-user memory + multi-model fallback ───────────────────────────────
const AI_SYSTEM = `You are AA MD Bot — a highly intelligent AI assistant built by AA Mods (Ahsan Ali Wadani).

Your Expertise: Science, Technology, Programming, Mathematics, History, Islam, Culture, Medicine, Law basics, Business, and general knowledge.

FORMATTING (Telegram HTML — always follow):
- Use <b>bold</b> for headings and key terms
- Use <i>italics</i> for examples and emphasis
- Use numbered lists (1. 2. 3.) for steps
- Use • for bullet points
- Use <code>code</code> for code snippets
- Add blank lines between sections for readability

BEHAVIOR:
- Give COMPLETE, thorough answers — never vague or one-line for complex questions
- For code: provide full working code + explain each part
- For math: show every step of the working
- For Islam: answer accurately from Quran and Sunnah perspective
- Match the user's language automatically (Urdu, English, Roman Urdu, Arabic, etc.)
- Be warm, professional, and genuinely helpful — not robotic
- If unsure: say so clearly and give your best reasoning`;

const AI_MODELS   = ['openai', 'claude', 'unity'];
const _aiMemory   = new Map(); // userId → messages[]
const _aiLastUsed = new Map();
const AI_MAX_USERS = 500;
const AI_MAX_MSG   = 20;

function aiEvict() {
  if (_aiMemory.size <= AI_MAX_USERS) return;
  let oldest = null, oldestT = Infinity;
  for (const [id, t] of _aiLastUsed) { if (t < oldestT) { oldest = id; oldestT = t; } }
  if (oldest) { _aiMemory.delete(oldest); _aiLastUsed.delete(oldest); }
}

function aiGetHist(uid)  { return _aiMemory.get(uid) || []; }
function aiClearHist(uid){ _aiMemory.delete(uid); _aiLastUsed.delete(uid); }

function aiAddHist(uid, role, content) {
  const hist = aiGetHist(uid);
  hist.push({ role, content });
  if (hist.length > AI_MAX_MSG) hist.splice(0, hist.length - AI_MAX_MSG);
  _aiMemory.set(uid, hist);
  _aiLastUsed.set(uid, Date.now());
  aiEvict();
}

async function aiChat(userId, prompt) {
  aiAddHist(userId, 'user', prompt);
  const messages = [{ role:'system', content: AI_SYSTEM }, ...aiGetHist(userId)];
  let reply = null, lastErr = null;
  for (const model of AI_MODELS) {
    try {
      const { data } = await axios.post('https://text.pollinations.ai/openai', {
        model, messages, temperature: 0.4, max_tokens: 2048,
      }, { headers: { 'Content-Type':'application/json' }, timeout: 40000 });
      const r = data?.choices?.[0]?.message?.content?.trim();
      if (r) { reply = r; break; }
    } catch (e) { lastErr = e; }
  }
  if (!reply) throw lastErr || new Error('All AI models failed');
  // Convert WhatsApp-style markdown to Telegram HTML
  reply = reply
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.*?)\*/g,     '<b>$1</b>')
    .replace(/__(.*?)__/g,     '<i>$1</i>')
    .replace(/_(.*?)_/g,       '<i>$1</i>')
    .replace(/```[\w]*\n?([\s\S]*?)```/g, '<pre>$1</pre>')
    .replace(/`([^`]+)`/g,     '<code>$1</code>')
    .replace(/^#{1,6}\s+(.*)/gm, '<b>$1</b>')
    .trim();
  aiAddHist(userId, 'assistant', reply);
  return reply;
}

// ── AI Image — prompt enhancer + multi-model ──────────────────────────────────
const IMG_MODELS = {
  default:  { id: 'flux',         label: '✨ Quality',    w: 1024, h: 1024 },
  realistic:{ id: 'flux-realism', label: '📸 Realistic',  w: 1024, h: 1024 },
  anime:    { id: 'flux-anime',   label: '🎌 Anime',      w: 1024, h: 1024 },
  fast:     { id: 'turbo',        label: '⚡ Fast',       w: 1024, h: 1024 },
};

function parseImgFlags(text) {
  let m = 'default', w = 1024, h = 1024, clean = text;
  if (/--real(istic)?/i.test(clean)) { m='realistic'; clean=clean.replace(/--real(istic)?/gi,''); }
  else if (/--anime/i.test(clean))   { m='anime';     clean=clean.replace(/--anime/gi,''); }
  else if (/--fast/i.test(clean))    { m='fast';      clean=clean.replace(/--fast/gi,''); }
  if (/--portrait|--port/i.test(clean)) { w=832; h=1216; clean=clean.replace(/--portrait|--port/gi,''); }
  else if (/--wide|--landscape/i.test(clean)) { w=1216; h=832; clean=clean.replace(/--wide|--landscape/gi,''); }
  else {
    if (/\b(portrait|face|selfie|headshot|person|girl|boy|man|woman|character)\b/i.test(clean)) { w=832; h=1216; }
    else if (/\b(landscape|panorama|wide|mountain|city|skyline|horizon|banner)\b/i.test(clean)) { w=1216; h=832; }
  }
  return { model: m, w, h, prompt: clean.trim() };
}

async function enhanceImgPrompt(userPrompt, modelKey) {
  const hints = {
    default:   'high quality digital art, highly detailed, 8K, cinematic lighting, professional composition',
    realistic: 'photorealistic, DSLR photography, RAW photo, perfect exposure, bokeh, Canon EOS R5',
    anime:     'anime art style, Studio Ghibli quality, vibrant colors, detailed linework, manga illustration',
    fast:      'digital art, colorful, detailed',
  };
  try {
    const { data } = await axios.post('https://text.pollinations.ai/openai', {
      model: 'openai',
      messages: [
        { role:'system', content:`You are an expert AI art prompt engineer. Expand the user's simple description into a vivid, detailed image generation prompt. Add: "${hints[modelKey]||hints.default}". Keep under 120 words. Output ONLY the enhanced prompt — no quotes, no explanation.` },
        { role:'user',   content:`Enhance: "${userPrompt}"` },
      ],
      temperature: 0.8, max_tokens: 200,
    }, { headers: {'Content-Type':'application/json'}, timeout: 15000 });
    const r = data?.choices?.[0]?.message?.content?.trim();
    return (r && r.length > userPrompt.length) ? r : userPrompt;
  } catch { return userPrompt; }
}

function buildImgUrl(prompt, model, w, h) {
  const m = IMG_MODELS[model] || IMG_MODELS.default;
  const seed = Math.floor(Math.random() * 9999999);
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&model=${m.id}&seed=${seed}&nologo=true`;
}

// ── Translate ────────────────────────────────────────────────────────────────
const LANG_NAMES = {
  en:'English', ur:'Urdu', ar:'Arabic', fr:'French', de:'German', es:'Spanish',
  hi:'Hindi', tr:'Turkish', ru:'Russian', zh:'Chinese', ja:'Japanese', ko:'Korean',
  it:'Italian', pt:'Portuguese', fa:'Persian', bn:'Bengali', id:'Indonesian',
  ms:'Malay', nl:'Dutch', pl:'Polish', sv:'Swedish', fi:'Finnish', no:'Norwegian',
};
async function translate(text, lang = 'en') {
  const { data } = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${lang}`, { timeout: 15000 });
  if (data?.quotaFinished) throw new Error('Daily quota finished');
  const result = data?.responseData?.translatedText;
  if (!result || result === text) throw new Error('Translation unavailable');
  return result;
}

// ── Wikipedia ─────────────────────────────────────────────────────────────────
async function wiki(query) {
  const { data } = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`, { timeout: 15000 });
  if (!data?.extract) throw new Error('No article found');
  return data;
}

// ── Movie ─────────────────────────────────────────────────────────────────────
async function movie(query) {
  for (const key of ['trilogy','thewdb','b9bd48a6']) {
    try {
      const { data } = await axios.get(`https://www.omdbapi.com/?t=${encodeURIComponent(query)}&type=movie&apikey=${key}`, { timeout: 15000 });
      if (data?.Response === 'True') return data;
    } catch {}
  }
  // TMDB fallback
  const { data: s } = await axios.get(`https://api.themoviedb.org/3/search/movie?api_key=8265bd1679663a7ea12ac168da84d2e8&query=${encodeURIComponent(query)}&page=1`, { timeout: 15000 });
  const m = s?.results?.[0];
  if (!m) throw new Error('Movie not found');
  return { Title: m.title, Year: (m.release_date||'').slice(0,4), imdbRating: (m.vote_average||0).toFixed(1), imdbVotes: (m.vote_count||0).toLocaleString(), Genre:'N/A', Runtime:'N/A', Released: m.release_date||'N/A', Director:'N/A', Actors:'N/A', Awards:'N/A', Plot: m.overview||'No synopsis.', Poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : 'N/A', Source:'TMDB' };
}

// ── Anime ─────────────────────────────────────────────────────────────────────
async function anime(query) {
  const { data } = await axios.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1&sfw=true`, { timeout: 18000, headers: { 'User-Agent':'AA-MD-Bot/3.0' } });
  const r = data?.data?.[0];
  if (!r) throw new Error('Anime not found');
  return r;
}

// ── Lyrics ────────────────────────────────────────────────────────────────────
async function lyrics(query) {
  try {
    const { data: s } = await axios.get(`https://api.lyrics.ovh/suggest/${encodeURIComponent(query)}`, { timeout: 12000 });
    const song = s?.data?.[0];
    if (song) {
      const { data: l } = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(song.artist.name)}/${encodeURIComponent(song.title)}`, { timeout: 12000 });
      if (l?.lyrics) return { title: song.title, artist: song.artist.name, cover: song.album?.cover_medium, lyrics: l.lyrics };
    }
  } catch {}
  // Fallback: lrclib
  const { data } = await axios.get(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}&limit=1`, { timeout: 12000 });
  const r = data?.[0];
  if (!r) throw new Error('Lyrics not found');
  return { title: r.trackName, artist: r.artistName, cover: null, lyrics: r.plainLyrics || 'Unavailable' };
}

// ── News ──────────────────────────────────────────────────────────────────────
async function news(topic = 'latest') {
  const { data } = await axios.get(
    `https://gnews.io/api/v4/search?q=${encodeURIComponent(topic)}&lang=en&max=5&apikey=bb9ced0e7e57e2e0f9e7e7c7c14d1c93`,
    { timeout: 15000 }
  ).catch(async () => {
    // Fallback: BBC RSS
    const { data: rss } = await axios.get('https://feeds.bbci.co.uk/news/rss.xml', { timeout: 12000 });
    const items = [...rss.matchAll(/<title><!\[CDATA\[([^\]]+)\]]/g)].slice(1, 6).map(m => ({ title: m[1], url: '' }));
    return { data: { articles: items.map(i => ({ title: i.title, url: i.url, source: { name: 'BBC News' }, publishedAt: '' })) } };
  });
  return data.articles || [];
}

// ── Crypto ────────────────────────────────────────────────────────────────────
async function crypto(coins = ['bitcoin','ethereum','binancecoin','cardano','solana']) {
  const ids = coins.join(',');
  const { data } = await axios.get(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
    { timeout: 15000, headers: { 'User-Agent':'AA-MD-Bot/3.0' } }
  );
  return data;
}

// ── GitHub ────────────────────────────────────────────────────────────────────
async function github(username) {
  const [{ data: u }, { data: r }] = await Promise.all([
    axios.get(`https://api.github.com/users/${encodeURIComponent(username)}`, { timeout: 12000, headers: { 'User-Agent':'AA-MD-Bot/3.0' } }),
    axios.get(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=stars&per_page=3`, { timeout: 12000, headers: { 'User-Agent':'AA-MD-Bot/3.0' } }),
  ]);
  return { user: u, repos: r };
}

// ── URL Shortener ─────────────────────────────────────────────────────────────
async function shorten(url) {
  // TinyURL (no API key needed)
  const { data } = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`, { timeout: 10000 });
  if (!data || !data.startsWith('http')) throw new Error('Could not shorten URL');
  return data.trim();
}

// ── Screenshot ────────────────────────────────────────────────────────────────
function screenshotUrl(url) {
  return `https://api.screenshotmachine.com/?key=b11a46&url=${encodeURIComponent(url)}&dimension=1366x768&format=jpg&delay=2000`;
}

// ── Urban Dictionary ──────────────────────────────────────────────────────────
async function urban(query) {
  const { data } = await axios.get(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(query)}`, { timeout: 12000 });
  const entry = data?.list?.[0];
  if (!entry) throw new Error('No definition found');
  return { word: entry.word, definition: entry.definition?.replace(/\[|\]/g,'') || '', example: entry.example?.replace(/\[|\]/g,'') || '', thumbs_up: entry.thumbs_up };
}

// ── Fun APIs ──────────────────────────────────────────────────────────────────
async function joke() {
  const { data } = await axios.get('https://v2.jokeapi.dev/joke/Programming,Miscellaneous,Pun?blacklistFlags=nsfw,racist,sexist,explicit&type=single', { timeout: 12000 });
  if (!data?.joke) throw new Error('No joke');
  return { joke: data.joke, category: data.category };
}
async function quote() {
  const { data } = await axios.get('https://zenquotes.io/api/random', { timeout: 12000 });
  const q = Array.isArray(data) ? data[0] : data;
  if (!q?.q) throw new Error('No quote');
  return { text: q.q, author: q.a };
}
async function fact() {
  try {
    const { data } = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', { timeout: 10000 });
    if (data?.text) return data.text;
  } catch {}
  const { data } = await axios.get('https://api.chucknorris.io/jokes/random', { timeout: 10000 });
  if (!data?.value) throw new Error('No fact');
  return data.value;
}

// ── QR Code ───────────────────────────────────────────────────────────────────
const qrUrl = (t) => `https://api.qrserver.com/v1/create-qr-code/?size=400x400&margin=12&data=${encodeURIComponent(t)}`;

// ══════════════════════════════════════════════════════════════════════════════
// Bot init
// ══════════════════════════════════════════════════════════════════════════════
export function initTelegramFeatures() {
  if (!TOKEN) {
    logger.warn('⚡ TELEGRAM_FEATURES_BOT_TOKEN not set — features bot disabled');
    return;
  }

  const bot = new TelegramBot(TOKEN, { polling: true });

  // ── /start ───────────────────────────────────────────────────────────────────
  bot.onText(/\/start/, (msg) => {
    const name = esc(msg.from?.first_name || 'there');
    sendText(bot, msg.chat.id,
      `👋 <b>Hello, ${name}!</b>\n\n` +
      `🤖 <b>AA MD Bot — Telegram Features</b>\n${DIV}\n\n` +
      `Your WhatsApp bot's powers, right here on Telegram!\n\n` +
      `🎵 Download YouTube, TikTok, Instagram & more\n` +
      `🤖 Chat with AI, generate images\n` +
      `🌐 Search, translate, get news & crypto\n` +
      `🎬 Movies, anime, lyrics, weather & more\n\n` +
      `📋 Type /help to see all commands.` +
      FOOTER
    );
  });

  // ── /help ────────────────────────────────────────────────────────────────────
  bot.onText(/\/help/, (msg) => {
    sendText(bot, msg.chat.id,
      `📋 <b>AA MD Bot — All Commands</b>\n${DIV}\n\n` +

      `🎵 <b>Downloads</b>\n` +
      `┣ /play <i>song name or URL</i> — YouTube MP3\n` +
      `┣ /video <i>title or URL</i> — YouTube MP4\n` +
      `┣ /tiktok <i>url</i> — TikTok video\n` +
      `┣ /ig <i>url</i> — Instagram reel/post\n` +
      `┗ /fb <i>url</i> — Facebook video\n\n` +

      `🤖 <b>AI & Generation</b>\n` +
      `┣ /ai <i>question</i> — Chat with AI\n` +
      `┗ /imagine <i>description</i> — Generate AI image\n\n` +

      `🔍 <b>Search & Info</b>\n` +
      `┣ /wiki <i>query</i> — Wikipedia\n` +
      `┣ /movie <i>title</i> — Movie details\n` +
      `┣ /anime <i>title</i> — Anime info\n` +
      `┣ /lyrics <i>song</i> — Song lyrics\n` +
      `┣ /news <i>[topic]</i> — Latest news\n` +
      `┣ /crypto — Live crypto prices\n` +
      `┣ /github <i>username</i> — GitHub profile\n` +
      `┗ /urban <i>word</i> — Urban Dictionary\n\n` +

      `🌐 <b>Utilities</b>\n` +
      `┣ /weather <i>city</i> — Live weather\n` +
      `┣ /translate <i>text</i> — Translate to English\n` +
      `┃   <i>or: /translate ur: Hello → Urdu</i>\n` +
      `┣ /short <i>url</i> — Shorten a URL\n` +
      `┣ /ss <i>url</i> — Screenshot a website\n` +
      `┗ /qr <i>text or URL</i> — Generate QR code\n\n` +

      `😄 <b>Fun</b>\n` +
      `┣ /joke — Random joke\n` +
      `┣ /quote — Inspirational quote\n` +
      `┗ /fact — Random interesting fact\n\n` +

      `⚙️ <b>General</b>\n` +
      `┣ /ping — Bot speed check\n` +
      `┗ /id — Your Telegram info\n` +
      FOOTER
    );
  });

  // ── /ping ─────────────────────────────────────────────────────────────────────
  bot.onText(/\/ping/, async (msg) => {
    const t0 = Date.now();
    const sent = await bot.sendMessage(msg.chat.id, '🏓 <i>Pinging...</i>', HTML).catch(() => null);
    if (!sent) return;
    const ms = Date.now() - t0, upSec = Math.floor(process.uptime());
    const up = upSec > 3600 ? `${Math.floor(upSec/3600)}h ${Math.floor((upSec%3600)/60)}m` : `${Math.floor(upSec/60)}m ${upSec%60}s`;
    edit(bot, msg.chat.id, sent.message_id,
      `🏓 <b>Pong!</b>  <code>${ms}ms</code>\n${DIV}\n\n` +
      `⏱ Uptime: <b>${esc(up)}</b>\n` +
      `💾 RAM: <b>${Math.round(process.memoryUsage().heapUsed/1024/1024)}MB</b>\n` +
      `📦 Node: <b>${esc(process.version)}</b>` + FOOTER
    );
  });

  // ── /id ───────────────────────────────────────────────────────────────────────
  bot.onText(/\/id/, (msg) => {
    const u = msg.from;
    sendText(bot, msg.chat.id,
      `🪪 <b>Your Telegram Info</b>\n${DIV}\n\n` +
      `👤 <b>User ID:</b> <code>${u?.id}</code>\n` +
      `📛 <b>Name:</b> ${esc([(u?.first_name||''), (u?.last_name||'')].join(' ').trim())}\n` +
      `🔖 <b>Username:</b> ${u?.username ? '@'+esc(u.username) : 'None'}\n` +
      `🌐 <b>Language:</b> ${esc(u?.language_code || 'N/A')}\n` +
      `💬 <b>Chat ID:</b> <code>${msg.chat.id}</code>\n` +
      `📂 <b>Chat type:</b> ${esc(msg.chat.type)}` + FOOTER
    );
  });

  // ── /play ─────────────────────────────────────────────────────────────────────
  bot.onText(/\/play(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id, query = (match[1]||'').trim();
    if (!query) return sendText(bot, chatId, `❌ <b>Usage:</b> <code>/play song name or YouTube URL</code>\n<i>Example: /play Noor-e-Muhammad</i>`);

    const w = cooldown(msg.from.id, 5000);
    if (w) return sendText(bot, chatId, `⏳ Please wait <b>${w}s</b>.`);

    const sent = await bot.sendMessage(chatId, `🔍 <b>Searching...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      let id, title = query, duration = '';
      const ytMatch = query.match(YTID_RX);
      if (ytMatch) { id = ytMatch[1]; }
      else {
        await edit(bot, chatId, sent.message_id, `🔍 <b>Searching:</b> <i>${esc(query)}</i>...`);
        const info = await ytSearchInfo(query);
        id = info.id; title = info.title || query; duration = formatDur(info.duration);
      }

      await edit(bot, chatId, sent.message_id,
        `⏬ <b>Downloading audio...</b>\n🎵 <b>${esc(title)}</b>\n${duration ? `⏱ ${esc(duration)}\n` : ''}\n<i>Connecting to fastest source...</i>`
      );

      const audioUrl = await resolveAudio(id);
      if (!audioUrl) throw new Error('All download sources failed');

      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});
      await bot.sendChatAction(chatId, 'upload_voice').catch(() => {});
      await bot.sendAudio(chatId, audioUrl, {
        caption: `🎵 <b>${esc(title)}</b>\n${duration ? `⏱ ${esc(duration)}\n` : ''}` + FOOTER,
        parse_mode: 'HTML', title,
      }).catch(async () => {
        await bot.sendDocument(chatId, audioUrl, { caption: `🎵 <b>${esc(title)}</b>\n${FOOTER}`, parse_mode: 'HTML' }).catch(() => {});
      });
    } catch (e) {
      edit(bot, chatId, sent.message_id,
        `❌ <b>Audio download failed</b>\n\n<i>${esc(e.message)}</i>\n\n💡 Try a different song name or paste the YouTube URL.`
      );
    }
  });

  // ── /video ────────────────────────────────────────────────────────────────────
  bot.onText(/\/video(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id, query = (match[1]||'').trim();
    if (!query) return sendText(bot, chatId, `❌ <b>Usage:</b> <code>/video title or YouTube URL</code>\n<i>Example: /video Shape of You</i>`);

    const w = cooldown(msg.from.id, 5000);
    if (w) return sendText(bot, chatId, `⏳ Please wait <b>${w}s</b>.`);

    const sent = await bot.sendMessage(chatId, `🔍 <b>Searching...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      let id, title = query, duration = '';
      const ytMatch = query.match(YTID_RX);
      if (ytMatch) { id = ytMatch[1]; }
      else {
        await edit(bot, chatId, sent.message_id, `🔍 <b>Searching:</b> <i>${esc(query)}</i>...`);
        const info = await ytSearchInfo(query);
        id = info.id; title = info.title || query; duration = formatDur(info.duration);
      }

      await edit(bot, chatId, sent.message_id,
        `⏬ <b>Downloading video...</b>\n🎬 <b>${esc(title)}</b>\n${duration ? `⏱ ${esc(duration)}\n` : ''}\n<i>Connecting to fastest source...</i>`
      );

      const videoUrl = await resolveVideo(id);
      if (!videoUrl) throw new Error('All download sources failed');

      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});
      await bot.sendChatAction(chatId, 'upload_video').catch(() => {});
      await bot.sendVideo(chatId, videoUrl, {
        caption: `🎬 <b>${esc(title)}</b>\n${duration ? `⏱ ${esc(duration)}\n` : ''}` + FOOTER,
        parse_mode: 'HTML', supports_streaming: true,
      }).catch(async () => {
        await bot.sendDocument(chatId, videoUrl, { caption: `🎬 <b>${esc(title)}</b>\n${FOOTER}`, parse_mode: 'HTML' }).catch(() => {});
      });
    } catch (e) {
      edit(bot, chatId, sent.message_id,
        `❌ <b>Video download failed</b>\n\n<i>${esc(e.message)}</i>\n\n💡 Try /play for audio only, or paste the direct YouTube URL.`
      );
    }
  });

  // ── /tiktok ───────────────────────────────────────────────────────────────────
  bot.onText(/\/tiktok(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id, url = (match[1]||'').trim();
    if (!url || !TT_RX.test(url)) return sendText(bot, chatId, `❌ <b>Usage:</b> <code>/tiktok https://tiktok.com/...</code>\n<i>Supports vt.tiktok.com short links</i>`);

    const w = cooldown(msg.from.id, 5000);
    if (w) return sendText(bot, chatId, `⏳ Please wait <b>${w}s</b>.`);

    const sent = await bot.sendMessage(chatId, `⏬ <b>Fetching TikTok...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const d = await raceFirst([tikwm(url).catch(()=>null), tikly(url).catch(()=>null)]);
      if (!d) throw new Error('All TikTok sources failed');

      const cap =
        `🎵 <b>${esc(d.title || 'TikTok')}</b>\n\n` +
        `👤 @${esc(d.author?.unique_id || 'unknown')}\n` +
        (d.digg_count ? `❤️ ${Number(d.digg_count).toLocaleString()}` : '') +
        (d.comment_count ? `  💬 ${Number(d.comment_count).toLocaleString()}` : '') + '\n' + FOOTER;

      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});

      if (d.images?.length) {
        const media = d.images.slice(0, 10).map((img, i) => ({ type:'photo', media:img, ...(i===0 ? { caption:cap, parse_mode:'HTML' } : {}) }));
        await bot.sendMediaGroup(chatId, media).catch(async () => {
          await bot.sendPhoto(chatId, d.images[0], { caption:cap, parse_mode:'HTML' }).catch(() => {});
        });
      } else if (d.play) {
        await bot.sendVideo(chatId, d.play, { caption:cap, parse_mode:'HTML' }).catch(async () => {
          await bot.sendDocument(chatId, d.play, { caption:cap, parse_mode:'HTML' }).catch(() => {});
        });
      } else {
        sendText(bot, chatId, `❌ Could not extract media from this TikTok.`);
      }
    } catch (e) {
      edit(bot, chatId, sent.message_id, `❌ <b>TikTok failed</b>\n\n<i>${esc(e.message)}</i>\n\n💡 Make sure the link is public.`);
    }
  });

  // ── /ig ───────────────────────────────────────────────────────────────────────
  bot.onText(/\/ig(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id, url = (match[1]||'').trim();
    if (!url || !IG_RX.test(url)) return sendText(bot, chatId, `❌ <b>Usage:</b> <code>/ig https://instagram.com/p/...</code>\n<i>Supports posts, reels, IGTV</i>`);

    const w = cooldown(msg.from.id, 5000);
    if (w) return sendText(bot, chatId, `⏳ Please wait <b>${w}s</b>.`);

    const sent = await bot.sendMessage(chatId, `⏬ <b>Fetching Instagram...</b>\n<i>May take a moment...</i>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const videoUrl = await igDl(url);
      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});
      const cap = `📸 <b>Instagram</b>\n${FOOTER}`;
      await bot.sendVideo(chatId, videoUrl, { caption:cap, parse_mode:'HTML' }).catch(async () => {
        await bot.sendDocument(chatId, videoUrl, { caption:cap, parse_mode:'HTML' }).catch(() => {});
      });
    } catch (e) {
      edit(bot, chatId, sent.message_id, `❌ <b>Instagram failed</b>\n\n<i>${esc(e.message)}</i>\n\n💡 Post must be public.`);
    }
  });

  // ── /fb ───────────────────────────────────────────────────────────────────────
  bot.onText(/\/fb(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id, url = (match[1]||'').trim();
    if (!url || !FB_RX.test(url)) return sendText(bot, chatId, `❌ <b>Usage:</b> <code>/fb https://facebook.com/...</code>\n<i>Video must be public</i>`);

    const w = cooldown(msg.from.id, 5000);
    if (w) return sendText(bot, chatId, `⏳ Please wait <b>${w}s</b>.`);

    const sent = await bot.sendMessage(chatId, `⏬ <b>Downloading Facebook video...</b>\n<i>Please wait...</i>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const videoUrl = await fbDl(url);
      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});
      await bot.sendVideo(chatId, videoUrl, { caption:`📘 <b>Facebook Video</b>\n${FOOTER}`, parse_mode:'HTML' }).catch(async () => {
        await bot.sendDocument(chatId, videoUrl, { caption:`📘 <b>Facebook Video</b>\n${FOOTER}`, parse_mode:'HTML' }).catch(() => {});
      });
    } catch (e) {
      edit(bot, chatId, sent.message_id, `❌ <b>Facebook failed</b>\n\n<i>${esc(e.message)}</i>\n\n💡 Ensure the video is public.`);
    }
  });

  // ── /ai ───────────────────────────────────────────────────────────────────────
  bot.onText(/\/ai(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const prompt = (match[1]||'').trim();

    if (!prompt) return sendText(bot, chatId,
      `🤖 <b>AA MD Bot AI — Powered</b>\n${DIV}\n\n` +
      `<b>Usage:</b> <code>/ai your question</code>\n\n` +
      `<b>Examples:</b>\n` +
      `• <code>/ai Explain quantum entanglement</code>\n` +
      `• <code>/ai Python mein fibonacci sequence kaise banayein</code>\n` +
      `• <code>/ai Namaz ki rakat kitni hain detail mein</code>\n` +
      `• <code>/ai Write a professional email for a job application</code>\n\n` +
      `<b>Commands:</b>\n` +
      `• <code>/ai clear</code> — Reset your chat history\n\n` +
      `<b>Features:</b>\n` +
      `• Multi-model AI (GPT-4o → Mistral → Claude fallback)\n` +
      `• Remembers your last 10 exchanges\n` +
      `• Answers in your language (Urdu/English/Arabic)\n` +
      `• Expert-level, thorough responses` +
      FOOTER
    );

    if (prompt.toLowerCase() === 'clear') {
      aiClearHist(userId);
      return sendText(bot, chatId, `🧹 <b>Chat history cleared.</b>\n\n<i>Fresh start — ask me anything!</i>` + FOOTER);
    }

    const w = cooldown(userId, 4000);
    if (w) return sendText(bot, chatId, `⏳ Please wait <b>${w}s</b>.`);

    const sent = await bot.sendMessage(chatId,
      `🤖 <b>Thinking...</b>\n<i>${esc(prompt.slice(0, 80))}${prompt.length > 80 ? '…' : ''}</i>`, HTML
    ).catch(() => null);
    if (!sent) return;

    try {
      await bot.sendChatAction(chatId, 'typing').catch(() => {});
      const reply = await aiChat(userId, prompt);
      edit(bot, chatId, sent.message_id,
        `🤖 <b>AI Reply</b>\n${DIV}\n\n${reply}` + FOOTER
      );
    } catch (e) {
      edit(bot, chatId, sent.message_id,
        `❌ <b>AI Error</b>\n\n<i>${esc(e.message)}</i>\n\n💡 Try rephrasing your question.`
      );
    }
  });

  // ── /imagine ──────────────────────────────────────────────────────────────────
  bot.onText(/\/imagine(?:\s+([\s\S]+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const raw    = (match[1]||'').trim();

    if (!raw) return sendText(bot, chatId,
      `🎨 <b>AI Image Generator — Powered</b>\n${DIV}\n\n` +
      `<b>Usage:</b> <code>/imagine your description</code>\n\n` +
      `<b>Examples:</b>\n` +
      `• <code>/imagine Pakistani village at golden hour</code>\n` +
      `• <code>/imagine anime girl in cherry blossom forest --anime</code>\n` +
      `• <code>/imagine futuristic Karachi city at night --wide</code>\n` +
      `• <code>/imagine lion portrait in savanna --real --portrait</code>\n\n` +
      `<b>Style Flags (add to your prompt):</b>\n` +
      `• <code>--real</code> — 📸 Photorealistic (DSLR quality)\n` +
      `• <code>--anime</code> — 🎌 Anime/manga style\n` +
      `• <code>--fast</code> — ⚡ Faster generation\n` +
      `• <code>--portrait</code> — 🖼 Tall/portrait ratio\n` +
      `• <code>--wide</code> — 🌄 Wide/landscape ratio\n\n` +
      `✨ <i>AI auto-enhances your prompt for best results</i>` +
      FOOTER
    );

    const w = cooldown(msg.from.id, 10000);
    if (w) return sendText(bot, chatId, `⏳ Please wait <b>${w}s</b>.`);

    const flags = parseImgFlags(raw);
    const mInfo = IMG_MODELS[flags.model] || IMG_MODELS.default;
    const ratio  = flags.w === 832 ? '🖼 Portrait' : flags.w === 1216 ? '🌄 Landscape' : '⬛ Square';

    const sent = await bot.sendMessage(chatId,
      `🎨 <b>Generating image...</b>\n` +
      `${mInfo.label}  •  ${ratio}\n` +
      `<i>✨ Enhancing prompt...</i>`,
      HTML
    ).catch(() => null);
    if (!sent) return;

    try {
      await bot.sendChatAction(chatId, 'upload_photo').catch(() => {});

      // Step 1: enhance prompt
      const enhanced = await enhanceImgPrompt(flags.prompt, flags.model);

      // Step 2: update status
      edit(bot, chatId, sent.message_id,
        `🎨 <b>Generating image...</b>\n${mInfo.label}  •  ${ratio}\n<i>⚙️ Rendering...</i>`, HTML
      );

      // Step 3: fetch image buffer (more reliable than URL send in Telegram)
      const imgUrl = buildImgUrl(enhanced, flags.model, flags.w, flags.h);
      const { data: imgBuf } = await axios.get(imgUrl, {
        responseType: 'arraybuffer',
        timeout: 90000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});
      await bot.sendPhoto(chatId, Buffer.from(imgBuf), {
        caption:
          `🎨 <b>AI Generated Image</b>\n${DIV}\n\n` +
          `📝 <i>${esc(flags.prompt.slice(0, 150))}${flags.prompt.length > 150 ? '…' : ''}</i>\n` +
          `${mInfo.label}  •  ${ratio}` +
          FOOTER,
        parse_mode: 'HTML',
      });
    } catch (e) {
      edit(bot, chatId, sent.message_id,
        `❌ <b>Image generation failed</b>\n\n<i>${esc(e.message)}</i>\n\n💡 Try a simpler description or add <code>--fast</code>.`
      );
    }
  });

  // ── /weather ──────────────────────────────────────────────────────────────────
  bot.onText(/\/weather(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id, city = (match[1]||'').trim();
    if (!city) return sendText(bot, chatId, `❌ <b>Usage:</b> <code>/weather Karachi</code>`);

    const sent = await bot.sendMessage(chatId, `🌍 <b>Fetching weather for ${esc(city)}...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const w = await weather(city);
      const emoji = /thunder|storm/i.test(w.desc)?'⛈':/drizzle|shower|rain/i.test(w.desc)?'🌧':/snow|blizzard/i.test(w.desc)?'❄️':/fog|mist|haze/i.test(w.desc)?'🌫':/cloud|overcast/i.test(w.desc)?'⛅':/clear|sunny/i.test(w.desc)?'☀️':'🌤';
      edit(bot, chatId, sent.message_id,
        `${emoji} <b>Weather — ${esc(w.city)}, ${esc(w.country)}</b>\n${DIV}\n\n` +
        `🌡 <b>Temp:</b> ${esc(w.temp_c)}°C  /  ${esc(w.temp_f)}°F\n` +
        `🤔 <b>Feels like:</b> ${esc(w.feels)}°C\n` +
        `☁️ <b>Condition:</b> ${esc(w.desc)}\n\n` +
        `💧 Humidity: <b>${esc(w.humidity)}%</b>\n` +
        `💨 Wind: <b>${esc(w.wind)} km/h</b>\n` +
        `☁ Cloud: <b>${esc(w.cloud)}%</b>\n` +
        `👁 Visibility: <b>${esc(w.vis)} km</b>\n` +
        `🔵 Pressure: <b>${esc(w.pressure)} hPa</b>\n` +
        `☀️ UV Index: <b>${esc(w.uv)}</b>` + FOOTER
      );
    } catch {
      edit(bot, chatId, sent.message_id, `❌ No weather data for "<b>${esc(city)}</b>".\n\nCheck the city name spelling.`);
    }
  });

  // ── /translate ────────────────────────────────────────────────────────────────
  bot.onText(/\/translate(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    let input = (match[1]||'').trim();
    if (!input) return sendText(bot, chatId,
      `❌ <b>Usage:</b>\n<code>/translate Hello</code> → English\n<code>/translate ur: Hello</code> → Urdu\n\n<b>Codes:</b> en ur ar hi fr de es tr ru zh ja ko pt id ms`
    );

    let lang = 'en';
    if (/^[a-z]{2}:\s*/i.test(input)) { lang = input.slice(0,2).toLowerCase(); input = input.slice(input.indexOf(':')+1).trim(); }

    const sent = await bot.sendMessage(chatId, `🌐 <b>Translating...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const result = await translate(input, lang);
      const langName = esc(LANG_NAMES[lang] || lang.toUpperCase());
      edit(bot, chatId, sent.message_id,
        `🌐 <b>Translation → ${langName}</b>\n${DIV}\n\n` +
        `<b>Original:</b>\n<i>${esc(input)}</i>\n\n` +
        `<b>Translated:</b>\n${esc(result)}` + FOOTER
      );
    } catch (e) {
      edit(bot, chatId, sent.message_id, `❌ Translation failed: <i>${esc(e.message)}</i>`);
    }
  });

  // ── /wiki ─────────────────────────────────────────────────────────────────────
  bot.onText(/\/wiki(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id, query = (match[1]||'').trim();
    if (!query) return sendText(bot, chatId, `❌ <b>Usage:</b> <code>/wiki Pakistan</code>`);

    const sent = await bot.sendMessage(chatId, `🔍 <b>Searching Wikipedia...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const w = await wiki(query);
      const extract = esc(w.extract||'').slice(0, 900);
      const caption = `📖 <b>${esc(w.title)}</b>\n${DIV}\n\n${extract}${w.extract?.length > 900 ? `...\n\n<a href="${esc(w.content_urls?.desktop?.page||'')}">Read more →</a>` : ''}` + FOOTER;

      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});
      const thumb = w.thumbnail?.source;
      if (thumb) {
        await bot.sendPhoto(chatId, thumb, { caption, parse_mode:'HTML' }).catch(() => sendText(bot, chatId, caption));
      } else {
        sendText(bot, chatId, caption);
      }
    } catch {
      edit(bot, chatId, sent.message_id, `❌ No Wikipedia article for "<b>${esc(query)}</b>".`);
    }
  });

  // ── /movie ────────────────────────────────────────────────────────────────────
  bot.onText(/\/movie(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id, query = (match[1]||'').trim();
    if (!query) return sendText(bot, chatId, `❌ <b>Usage:</b> <code>/movie Inception</code>`);

    const sent = await bot.sendMessage(chatId, `🎬 <b>Looking up movie...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const m = await movie(query);
      const cap =
        `🎬 <b>${esc(m.Title)}</b> <i>(${esc(m.Year)})</i>${m.Source==='TMDB'?' <i>(TMDB)</i>':''}\n${DIV}\n\n` +
        `⭐ <b>Rating:</b> ${esc(m.imdbRating)}/10  📊 ${esc(m.imdbVotes)} votes\n` +
        (m.Genre!=='N/A'?`🎭 ${esc(m.Genre)}\n`:'') +
        (m.Runtime!=='N/A'?`⏱ ${esc(m.Runtime)}\n`:'') +
        `📅 ${esc(m.Released)}\n` +
        (m.Director!=='N/A'?`🎬 ${esc(m.Director)}\n`:'') +
        (m.Actors!=='N/A'?`🎭 ${esc(m.Actors)}\n`:'') +
        `\n📖 <i>${esc(m.Plot)}</i>` + FOOTER;

      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});
      if (m.Poster && m.Poster !== 'N/A') {
        await bot.sendPhoto(chatId, m.Poster, { caption:cap, parse_mode:'HTML' }).catch(() => sendText(bot, chatId, cap));
      } else {
        sendText(bot, chatId, cap);
      }
    } catch (e) {
      edit(bot, chatId, sent.message_id, `❌ Movie not found: "<b>${esc(query)}</b>"\n\n<i>${esc(e.message)}</i>`);
    }
  });

  // ── /anime ────────────────────────────────────────────────────────────────────
  bot.onText(/\/anime(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id, query = (match[1]||'').trim();
    if (!query) return sendText(bot, chatId, `❌ <b>Usage:</b> <code>/anime Naruto</code>`);

    const sent = await bot.sendMessage(chatId, `🎌 <b>Searching anime...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const a = await anime(query);
      const genres = (a.genres||[]).map(g=>g.name).join(', ') || 'N/A';
      const cap =
        `🎌 <b>${esc(a.title_english||a.title)}</b>\n<i>${esc(a.title)}</i>\n${DIV}\n\n` +
        `⭐ <b>Score:</b> ${a.score||'N/A'}/10  👥 ${(a.members||0).toLocaleString()}\n` +
        `📺 <b>Type:</b> ${esc(a.type||'N/A')}  📋 Episodes: <b>${a.episodes||'?'}</b>\n` +
        `📅 <b>Status:</b> ${esc(a.status||'N/A')}\n` +
        `🎭 <b>Genres:</b> ${esc(genres)}\n` +
        `📅 <b>Aired:</b> ${esc(a.aired?.string||'N/A')}\n\n` +
        `📖 <i>${esc((a.synopsis||'No synopsis.').slice(0,500))}${(a.synopsis||'').length>500?'...':''}</i>` + FOOTER;

      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});
      const img = a.images?.jpg?.large_image_url;
      if (img) {
        await bot.sendPhoto(chatId, img, { caption:cap, parse_mode:'HTML' }).catch(() => sendText(bot, chatId, cap));
      } else {
        sendText(bot, chatId, cap);
      }
    } catch (e) {
      edit(bot, chatId, sent.message_id, `❌ Anime not found: "<b>${esc(query)}</b>"\n\n<i>${esc(e.message)}</i>\n\n💡 Try a more exact title.`);
    }
  });

  // ── /lyrics ───────────────────────────────────────────────────────────────────
  bot.onText(/\/lyrics(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id, query = (match[1]||'').trim();
    if (!query) return sendText(bot, chatId, `❌ <b>Usage:</b> <code>/lyrics Shape of You</code>`);

    const sent = await bot.sendMessage(chatId, `🎵 <b>Finding lyrics...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const r = await lyrics(query);
      const body = esc(r.lyrics).slice(0, 3500);
      const cap = `🎵 <b>${esc(r.title)}</b>\n👤 ${esc(r.artist)}\n${DIV}\n\n${body}${r.lyrics.length>3500?'\n\n<i>… truncated</i>':''}` + FOOTER;

      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});
      if (r.cover) {
        await bot.sendPhoto(chatId, r.cover, { caption:cap, parse_mode:'HTML' }).catch(() => sendText(bot, chatId, cap));
      } else {
        sendText(bot, chatId, cap);
      }
    } catch (e) {
      edit(bot, chatId, sent.message_id, `❌ Lyrics not found for "<b>${esc(query)}</b>"\n\n<i>${esc(e.message)}</i>\n\n💡 Try: Artist + Song title`);
    }
  });

  // ── /news ─────────────────────────────────────────────────────────────────────
  bot.onText(/\/news(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id, topic = (match[1]||'world').trim();
    const sent = await bot.sendMessage(chatId, `📰 <b>Fetching ${esc(topic)} news...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const articles = await news(topic);
      if (!articles.length) throw new Error('No articles found');

      let text = `📰 <b>Latest News — ${esc(topic)}</b>\n${DIV}\n\n`;
      for (let i = 0; i < Math.min(articles.length, 5); i++) {
        const a = articles[i];
        text += `<b>${i+1}.</b> ${esc(a.title)}\n`;
        if (a.url) text += `   <a href="${esc(a.url)}">Read more →</a>\n`;
        if (a.source?.name) text += `   📡 ${esc(a.source.name)}\n`;
        text += '\n';
      }
      text += FOOTER;
      edit(bot, chatId, sent.message_id, text);
    } catch (e) {
      edit(bot, chatId, sent.message_id, `❌ Could not fetch news: <i>${esc(e.message)}</i>`);
    }
  });

  // ── /crypto ───────────────────────────────────────────────────────────────────
  bot.onText(/\/crypto/, async (msg) => {
    const sent = await bot.sendMessage(msg.chat.id, `📈 <b>Fetching crypto prices...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const data = await crypto();
      const COIN_EMOJI = { bitcoin:'₿', ethereum:'Ξ', binancecoin:'BNB', cardano:'ADA', solana:'SOL' };
      let text = `📈 <b>Live Crypto Prices</b>\n${DIV}\n\n`;
      for (const [coin, d] of Object.entries(data)) {
        const price  = d.usd?.toLocaleString('en-US', { style:'currency', currency:'USD', maximumFractionDigits: coin==='bitcoin'?0:4 }) || 'N/A';
        const change = d.usd_24h_change?.toFixed(2);
        const arrow  = change > 0 ? '🟢 ▲' : '🔴 ▼';
        text += `${COIN_EMOJI[coin]||'💰'} <b>${coin.toUpperCase()}</b>\n`;
        text += `   💵 ${price}  ${change ? `${arrow} ${Math.abs(change)}%` : ''}\n\n`;
      }
      text += `<i>Source: CoinGecko</i>` + FOOTER;
      edit(bot, msg.chat.id, sent.message_id, text);
    } catch (e) {
      edit(bot, msg.chat.id, sent.message_id, `❌ Crypto prices unavailable: <i>${esc(e.message)}</i>`);
    }
  });

  // ── /github ───────────────────────────────────────────────────────────────────
  bot.onText(/\/github(?:\s+(\S+))?/, async (msg, match) => {
    const chatId = msg.chat.id, username = (match[1]||'').trim();
    if (!username) return sendText(bot, chatId, `❌ <b>Usage:</b> <code>/github username</code>\n<i>Example: /github torvalds</i>`);

    const sent = await bot.sendMessage(chatId, `🐙 <b>Looking up GitHub user...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const { user: u, repos: r } = await github(username);
      const cap =
        `🐙 <b>${esc(u.name || u.login)}</b>\n` +
        `<code>@${esc(u.login)}</code>\n${DIV}\n\n` +
        (u.bio ? `📝 ${esc(u.bio)}\n\n` : '') +
        `👥 <b>Followers:</b> ${u.followers?.toLocaleString()}  Following: ${u.following?.toLocaleString()}\n` +
        `📦 <b>Public Repos:</b> ${u.public_repos}\n` +
        (u.location ? `📍 ${esc(u.location)}\n` : '') +
        (u.company ? `🏢 ${esc(u.company)}\n` : '') +
        (u.blog ? `🔗 ${esc(u.blog)}\n` : '') +
        `📅 Joined: ${new Date(u.created_at).toDateString()}\n\n` +
        (r.length ? `⭐ <b>Top Repos:</b>\n` + r.map(repo => `  • <b>${esc(repo.name)}</b> ⭐${repo.stargazers_count} — <i>${esc((repo.description||'').slice(0,60))}</i>`).join('\n') : '') +
        FOOTER;

      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});
      if (u.avatar_url) {
        await bot.sendPhoto(chatId, u.avatar_url, { caption:cap, parse_mode:'HTML' }).catch(() => sendText(bot, chatId, cap));
      } else {
        sendText(bot, chatId, cap);
      }
    } catch (e) {
      edit(bot, chatId, sent.message_id, `❌ GitHub user not found: "<b>${esc(username)}</b>"\n\n<i>${esc(e.message)}</i>`);
    }
  });

  // ── /urban ────────────────────────────────────────────────────────────────────
  bot.onText(/\/urban(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id, query = (match[1]||'').trim();
    if (!query) return sendText(bot, chatId, `❌ <b>Usage:</b> <code>/urban slay</code>`);

    const sent = await bot.sendMessage(chatId, `📚 <b>Looking up definition...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const d = await urban(query);
      edit(bot, chatId, sent.message_id,
        `📚 <b>Urban Dictionary</b>\n${DIV}\n\n` +
        `📌 <b>${esc(d.word)}</b>\n\n` +
        `📖 ${esc(d.definition.slice(0, 600))}\n\n` +
        (d.example ? `💬 <i>${esc(d.example.slice(0, 300))}</i>\n\n` : '') +
        `👍 ${d.thumbs_up?.toLocaleString() || 0}` + FOOTER
      );
    } catch (e) {
      edit(bot, chatId, sent.message_id, `❌ No definition for "<b>${esc(query)}</b>"\n\n<i>${esc(e.message)}</i>`);
    }
  });

  // ── /short ────────────────────────────────────────────────────────────────────
  bot.onText(/\/short(?:\s+(\S+))?/, async (msg, match) => {
    const chatId = msg.chat.id, url = (match[1]||'').trim();
    if (!url || !url.startsWith('http')) return sendText(bot, chatId, `❌ <b>Usage:</b> <code>/short https://yourlong.url/here</code>`);

    const sent = await bot.sendMessage(chatId, `🔗 <b>Shortening URL...</b>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      const short = await shorten(url);
      edit(bot, chatId, sent.message_id,
        `🔗 <b>URL Shortened</b>\n${DIV}\n\n` +
        `📎 <b>Short URL:</b>\n<code>${esc(short)}</code>\n\n` +
        `🔍 <b>Original:</b>\n<i>${esc(url.slice(0, 100))}${url.length>100?'...':''}</i>` + FOOTER
      );
    } catch (e) {
      edit(bot, chatId, sent.message_id, `❌ Could not shorten: <i>${esc(e.message)}</i>`);
    }
  });

  // ── /ss ───────────────────────────────────────────────────────────────────────
  bot.onText(/\/ss(?:\s+(\S+))?/, async (msg, match) => {
    const chatId = msg.chat.id, url = (match[1]||'').trim();
    if (!url || !url.startsWith('http')) return sendText(bot, chatId, `❌ <b>Usage:</b> <code>/ss https://google.com</code>`);

    const w = cooldown(msg.from.id, 6000);
    if (w) return sendText(bot, chatId, `⏳ Please wait <b>${w}s</b>.`);

    const sent = await bot.sendMessage(chatId, `📸 <b>Taking screenshot...</b>\n<i>${esc(url.slice(0,60))}</i>`, HTML).catch(() => null);
    if (!sent) return;

    try {
      await bot.sendChatAction(chatId, 'upload_photo').catch(() => {});
      const imgUrl = screenshotUrl(url);
      await bot.deleteMessage(chatId, sent.message_id).catch(() => {});
      await bot.sendPhoto(chatId, imgUrl, {
        caption: `📸 <b>Screenshot</b>\n🔗 ${esc(url.slice(0,80))}${url.length>80?'...':''}` + FOOTER,
        parse_mode: 'HTML',
      });
    } catch (e) {
      edit(bot, chatId, sent.message_id, `❌ Screenshot failed: <i>${esc(e.message)}</i>`);
    }
  });

  // ── /joke ─────────────────────────────────────────────────────────────────────
  bot.onText(/\/joke/, async (msg) => {
    const sent = await bot.sendMessage(msg.chat.id, `😂 <b>Getting a joke...</b>`, HTML).catch(() => null);
    if (!sent) return;
    try {
      const j = await joke();
      edit(bot, msg.chat.id, sent.message_id, `😂 <b>Joke</b> <i>(${esc(j.category)})</i>\n${DIV}\n\n${esc(j.joke)}` + FOOTER);
    } catch (e) { edit(bot, msg.chat.id, sent.message_id, `❌ ${esc(e.message)}`); }
  });

  // ── /quote ────────────────────────────────────────────────────────────────────
  bot.onText(/\/quote/, async (msg) => {
    const sent = await bot.sendMessage(msg.chat.id, `💬 <b>Getting a quote...</b>`, HTML).catch(() => null);
    if (!sent) return;
    try {
      const q = await quote();
      edit(bot, msg.chat.id, sent.message_id, `💬 <b>Quote</b>\n${DIV}\n\n❝ ${esc(q.text)} ❞\n\n— <i>${esc(q.author)}</i>` + FOOTER);
    } catch (e) { edit(bot, msg.chat.id, sent.message_id, `❌ ${esc(e.message)}`); }
  });

  // ── /fact ─────────────────────────────────────────────────────────────────────
  bot.onText(/\/fact/, async (msg) => {
    const sent = await bot.sendMessage(msg.chat.id, `🧠 <b>Loading fact...</b>`, HTML).catch(() => null);
    if (!sent) return;
    try {
      const f = await fact();
      edit(bot, msg.chat.id, sent.message_id, `🧠 <b>Random Fact</b>\n${DIV}\n\n${esc(f)}` + FOOTER);
    } catch (e) { edit(bot, msg.chat.id, sent.message_id, `❌ ${esc(e.message)}`); }
  });

  // ── /qr ───────────────────────────────────────────────────────────────────────
  bot.onText(/\/qr(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id, text = (match[1]||'').trim();
    if (!text) return sendText(bot, chatId, `❌ <b>Usage:</b> <code>/qr your text or URL</code>`);
    await bot.sendChatAction(chatId, 'upload_photo').catch(() => {});
    try {
      await bot.sendPhoto(chatId, qrUrl(text), {
        caption: `📱 <b>QR Code</b>\n${DIV}\n\nContent: <code>${esc(text.slice(0,200))}</code>` + FOOTER,
        parse_mode: 'HTML',
      });
    } catch (e) { sendText(bot, chatId, `❌ QR generation failed: ${esc(e.message)}`); }
  });

  // ── Catch-all ─────────────────────────────────────────────────────────────────
  const KNOWN = /^\/(start|help|ping|id|play|video|tiktok|ig|fb|ai|imagine|weather|translate|wiki|movie|anime|lyrics|news|crypto|github|urban|short|ss|joke|quote|fact|qr)/;
  bot.on('message', (msg) => {
    if (msg.text?.startsWith('/') && !KNOWN.test(msg.text)) {
      sendText(bot, msg.chat.id, `❓ Unknown command.\n\nType /help to see all commands.`);
    }
  });

  bot.on('polling_error', (err) => {
    logger.warn({ code: err.code, msg: err.message }, '🤖 Telegram features polling error');
  });

  logger.info('🤖 Telegram features bot started (v2 — advanced)');
  return bot;
}
