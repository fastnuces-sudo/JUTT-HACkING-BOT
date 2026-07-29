// ============================================
// AA MD Bot - YouTube Downloader (FINAL)
// Flow: command → INSTANT info card (thumbnail+title+author+duration+views)
//       → download in background → send audio/video
// Audio : DavidCyrilTech → ABZTech (ytdlv3) → EliteProTech
// Video : DavidCyrilTech → EliteProTech → ABZTech ytdl4
// Search: DavidCyrilTech  (+ YouTube oEmbed as fallback for direct links)
// ============================================

import axios from "axios";

const YT_REGEX =
  /(https?:\/\/(?:(?:www|m|music)\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]+\S*)/i;

const extractUrl = (t) => {
  if (!t) return null;
  const m = t.match(YT_REGEX);
  return m ? m[1] : null;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// ── Generic buffer downloader (audio/video files — these NEED spoofed headers) ─
async function fetchBuf(url, timeout = 90000) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    timeout,
    maxContentLength: 300 * 1024 * 1024,
    headers: {
      "User-Agent": UA,
      Referer: "https://www.youtube.com/",
    },
  });
  return Buffer.from(res.data);
}

// ── Format helpers ─────────────────────────────────────────────────────────────
function formatViews(v) {
  if (v === undefined || v === null || v === "") return "N/A";
  let n = v;
  if (typeof n === "string") n = Number(n.toString().replace(/[^0-9.]/g, ""));
  if (!n || isNaN(n)) return typeof v === "string" ? v : "N/A"; // API sometimes already sends "1.2M"
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B views";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M views";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K views";
  return n + " views";
}

function formatDuration(d) {
  if (!d) return "N/A";
  if (typeof d === "object") return d.timestamp || d.seconds || "N/A";
  if (typeof d === "number") {
    const h = Math.floor(d / 3600),
      m = Math.floor((d % 3600) / 60),
      s = Math.floor(d % 60);
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${m}:${String(s).padStart(2, "0")}`;
  }
  return String(d);
}

// ── Search (DavidCyrilTech) — gives title, thumbnail, duration, views, author ──
async function searchYT(query) {
  const { data } = await axios.get(
    `https://apis.davidcyriltech.my.id/youtube/search?query=${encodeURIComponent(query)}`,
    { timeout: 15000 },
  );

  // DEBUG: if any field still shows "N/A"/missing after testing, uncomment
  // the next line once, run a .play command, check console/PM2 logs, and send
  // me that raw JSON — I'll map the exact field names for you.
  // console.log('[YT SEARCH RAW]', JSON.stringify(data, null, 2));

  const results = data?.result || data?.results || data?.data || [];
  if (!Array.isArray(results) || !results.length) return null;
  const r = results[0];

  return {
    url: r.url || r.link || r.videoUrl || "",
    title: r.title || query,
    thumbnail:
      r.thumbnail ||
      r.image ||
      r.thumbnails?.[0]?.url ||
      r.thumbnails?.[0] ||
      "",
    duration: r.duration || r.timestamp || r.length || "",
    views: r.views || r.viewCount || r.view_count || r.viewsCount || "",
    author:
      r.channel ||
      r.channelTitle ||
      r.author?.name ||
      r.author ||
      r.uploader ||
      "",
  };
}

// ── YouTube oEmbed fallback — used when a direct link is given and/or search
// API doesn't return enough. Free, official, public endpoint — no key needed.
// Gives: title, author_name, thumbnail_url. (No duration/views — YT doesn't
// expose those via oEmbed.)
async function oEmbedInfo(ytUrl) {
  try {
    const { data } = await axios.get(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(ytUrl)}&format=json`,
      { timeout: 8000 },
    );
    return {
      title: data?.title || "",
      author: data?.author_name || "",
      thumbnail: data?.thumbnail_url || "",
      duration: "",
      views: "",
    };
  } catch {
    return null;
  }
}

// ── Resolve query → { ytUrl, meta } (search-by-name OR direct link) ───────────
async function resolveMeta(query) {
  const directUrl = extractUrl(query);

  if (directUrl) {
    // Direct link: try oEmbed (fast + reliable) first, then search API as backup
    let meta = await oEmbedInfo(directUrl);
    if (!meta?.title) {
      try {
        const found = await searchYT(query);
        if (found?.title) meta = found;
      } catch {}
    }
    if (!meta)
      meta = {
        title: query,
        author: "",
        duration: "",
        views: "",
        thumbnail: "",
      };
    return { ytUrl: directUrl, meta };
  }

  // Name search
  let found;
  try {
    found = await searchYT(query);
  } catch {}
  if (!found?.url) return { ytUrl: null, meta: null };
  return { ytUrl: found.url, meta: found };
}

// ── Audio APIs: DavidCyrilTech → ABZTech ytdlv3 → EliteProTech ────────────────
async function getAudio(ytUrl) {
  const enc = encodeURIComponent(ytUrl);

  try {
    const { data: d } = await axios.get(
      `https://apis.davidcyriltech.my.id/download/ytmp3?url=${enc}`,
      { timeout: 30000 },
    );
    const r = d?.result || d;
    const url = r?.download_url || r?.downloadUrl || r?.url || d?.url;
    if (typeof url === "string" && url.startsWith("http")) {
      return {
        url,
        title: r?.title || d?.title || "",
        filename: r?.filename || "audio.mp3",
      };
    }
  } catch {}

  try {
    const { data: d } = await axios.get(
      `https://api-abztech.zone.id/download/ytdlv3?url=${enc}`,
      { timeout: 30000 },
    );
    const url = d?.downloadUrl || d?.download_url || d?.url || d?.result?.url;
    if (
      d?.status !== false &&
      typeof url === "string" &&
      url.startsWith("http")
    ) {
      return {
        url,
        title: d?.title || "",
        filename: d?.filename || "audio.mp3",
      };
    }
  } catch {}

  try {
    const { data: d } = await axios.get(
      `https://eliteprotech-apis.zone.id/ytdown?url=${enc}&format=mp3`,
      { timeout: 30000 },
    );
    const url =
      d?.downloadURL ||
      d?.download_url ||
      d?.url ||
      d?.result?.url ||
      d?.result?.download_url;
    if (typeof url === "string" && url.startsWith("http")) {
      return {
        url,
        title: d?.title || "",
        filename: d?.filename || "audio.mp3",
      };
    }
  } catch {}

  return null;
}

// ── Video APIs: DavidCyrilTech → EliteProTech → ABZTech ytdl4 ─────────────────
async function getVideo(ytUrl) {
  const enc = encodeURIComponent(ytUrl);

  try {
    const { data: d } = await axios.get(
      `https://apis.davidcyriltech.my.id/download/ytmp4?url=${enc}`,
      { timeout: 30000 },
    );
    const r = d?.result || d;
    const url = r?.download_url || r?.downloadUrl || r?.url || d?.url;
    if (typeof url === "string" && url.startsWith("http")) {
      return {
        url,
        title: r?.title || d?.title || "",
        filename: r?.filename || "video.mp4",
      };
    }
  } catch {}

  try {
    const { data: d } = await axios.get(
      `https://eliteprotech-apis.zone.id/ytdown?url=${enc}&format=mp4`,
      { timeout: 30000 },
    );
    const url =
      d?.downloadURL ||
      d?.download_url ||
      d?.url ||
      d?.result?.url ||
      d?.result?.download_url;
    if (typeof url === "string" && url.startsWith("http")) {
      return {
        url,
        title: d?.title || "",
        filename: d?.filename || "video.mp4",
      };
    }
  } catch {}

  try {
    const { data: d } = await axios.get(
      `https://api-abztech.zone.id/download/ytdl4?url=${enc}`,
      { timeout: 30000 },
    );
    const url = d?.downloadUrl || d?.download_url || d?.url || d?.result?.url;
    if (
      d?.status !== false &&
      typeof url === "string" &&
      url.startsWith("http")
    ) {
      return {
        url,
        title: d?.title || "",
        filename: d?.filename || "video.mp4",
      };
    }
  } catch {}

  return null;
}

// ── Quick INFO CARD (sent within 1-2 sec, before any download starts) ─────────
// Sends thumbnail as an image with title/author/duration/views in the caption.
// Uses the thumbnail URL directly (YouTube's own CDN — fast & not bot-blocked),
// so this doesn't wait on any slow download and shows up almost instantly.
async function sendInfoCard(sock, jid, msg, meta, botName, type) {
  const label = type === "video" ? "🎬 VIDEO" : "🎵 AUDIO";
  const caption =
    `✦✦✦✦✦✦✦✦✦✦\n${label} • ${botName}\n✦✦✦✦✦✦✦✦✦✦\n\n` +
    `📌 *${meta.title || "Unknown"}*\n` +
    `👤 Channel : ${meta.author || "N/A"}\n` +
    `⏱ Duration : ${formatDuration(meta.duration)}\n` +
    `👁 Views    : ${formatViews(meta.views)}\n\n` +
    `⏳ _Downloading, thoda ruko..._`;

  try {
    if (meta.thumbnail) {
      await sock.sendMessage(
        jid,
        { image: { url: meta.thumbnail }, caption },
        { quoted: msg },
      );
    } else {
      await sock.sendMessage(jid, { text: caption }, { quoted: msg });
    }
  } catch {
    // Never let the info card break the main flow
    try {
      await sock.sendMessage(jid, { text: caption }, { quoted: msg });
    } catch {}
  }
}

// ── Final media captions ───────────────────────────────────────────────────────
function mediaCaption(meta, botName, type) {
  const label = type === "video" ? "🎬 VIDEO" : "🎵 MUSIC";
  return (
    `✦✦✦✦✦✦✦✦✦✦\n${label} • ${botName}\n✦✦✦✦✦✦✦✦✦✦\n\n` +
    `🎙 *${meta.title || "Unknown"}*\n` +
    `🎤 ${meta.author || "Unknown"}\n` +
    `⏱ ${formatDuration(meta.duration)}\n\n` +
    `> 🤖 Powered by ${botName}\n> 👨‍💻 Ahsan Ali Wadani`
  );
}

// clean contextInfo — no mediaUrl/sourceUrl, so no auto-attached clickable link
function cleanCtx(title) {
  return {
    externalAdReply: {
      title: title || "YouTube",
      body: "AA MD Bot",
      mediaType: 1,
      renderLargerThumbnail: false,
      showAdAttribution: false,
    },
  };
}

// ── Plugin ────────────────────────────────────────────────────────────────────
export default {
  command: "play",
  alias: ["song", "yt", "ytmp3", "mp3", "ytmp4", "video", "mp4"],
  description: "Download YouTube audio or video",
  category: "download",

  execute: async ({
    sock,
    msg,
    jid,
    text,
    command,
    react,
    reply,
    sendMedia,
    prefix,
    config,
  }) => {
    const botName = config?.botName || "AA MD Bot";
    let query = text?.trim();

    if (!query) {
      const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      if (q)
        query = (q.conversation || q.extendedTextMessage?.text || "").trim();
    }

    if (!query) {
      return reply(
        `🎬 *YouTube Downloader*\n\n` +
          `📌 *Usage:*\n` +
          `• *${prefix}play* <song name or YT link> — audio\n` +
          `• *${prefix}video* <name or YT link> — video\n` +
          `• *${prefix}mp3* <YT link> — direct audio\n` +
          `• *${prefix}mp4* <YT link> — direct video\n\n` +
          `💡 Reply to any message containing a YT link also works`,
      );
    }

    const isVideoCmd =
      command === "mp4" || command === "ytmp4" || command === "video";
    const isDirectOnly =
      command === "mp3" ||
      command === "ytmp3" ||
      command === "mp4" ||
      command === "ytmp4";

    try {
      await react(isVideoCmd ? "🎥" : "🎶");

      // mp3/mp4 commands require a direct link (no name search) — keep original behaviour
      if (isDirectOnly && !extractUrl(query)) {
        await react("❌");
        return reply(
          `❌ *Valid YouTube link do*\n\n` +
            `Naam se search karne ke liye:\n` +
            `• *${prefix}play* <song name>\n` +
            `• *${prefix}video* <song name>`,
        );
      }

      // 1) Resolve URL + metadata (fast: search API / oEmbed)
      const { ytUrl, meta } = await resolveMeta(query);
      if (!ytUrl) {
        await react("❌");
        return reply(
          `❌ *No results found for: "${query}"*\n\n` +
            `💡 Try a different name or a YouTube link:\n` +
            `• *${prefix}${isVideoCmd ? "video" : "play"}* Shape of You\n` +
            `• *${prefix}${isVideoCmd ? "video" : "play"}* https://youtu.be/...`,
        );
      }

      // 2) INSTANT info card — fires immediately, before any file download
      await sendInfoCard(
        sock,
        jid,
        msg,
        meta,
        botName,
        isVideoCmd ? "video" : "audio",
      );

      // 3) Get the actual download link from the API chain
      const apiResult = isVideoCmd
        ? await getVideo(ytUrl)
        : await getAudio(ytUrl);
      if (!apiResult?.url) {
        await react("❌");
        return reply(
          `❌ *${isVideoCmd ? "Video" : "Audio"} download failed*\n\n` +
            `All 3 ${isVideoCmd ? "video" : "audio"} APIs unavailable right now — try again later.` +
            (isVideoCmd
              ? ""
              : `\n💡 Want video instead? *${prefix}video* ${query}`),
        );
      }
      if (apiResult.title) meta.title = meta.title || apiResult.title;

      // 4) Download the real file ourselves (with spoofed headers — this is
      // what makes it actually work instead of silently failing)
      let buf;
      try {
        buf = await fetchBuf(apiResult.url, isVideoCmd ? 120000 : 90000);
      } catch {}
      const minSize = isVideoCmd ? 50000 : 10000;
      if (!buf || buf.length < minSize) {
        await react("❌");
        return reply(
          `❌ *${isVideoCmd ? "Video" : "Audio"} file download failed*\n\n` +
            `Link mila API se, magar file download nahi ho payi (expired/blocked link).\n` +
            `Try again or a different ${isVideoCmd ? "video" : "song"}.`,
        );
      }

      // 5) Send the actual media
      if (isVideoCmd) {
        await sock.sendMessage(
          jid,
          {
            video: buf,
            mimetype: "video/mp4",
            fileName: apiResult.filename || `${meta.title || "video"}.mp4`,
            caption: mediaCaption(meta, botName, "video"),
            contextInfo: cleanCtx(meta.title),
          },
          { quoted: msg },
        );
      } else {
        await sendMedia({
          audio: buf,
          mimetype: "audio/mpeg",
          fileName: apiResult.filename || "audio.mp3",
          ptt: false,
          contextInfo: cleanCtx(meta.title),
        });
      }

      await react("✅");
    } catch (err) {
      console.error("[ YouTube ]", err.message);
      await react("❌").catch(() => {});
      reply(
        `❌ *YouTube download failed*\n\n` +
          `Please try again or use a different YouTube link.\n` +
          `💡 You can also try: *${prefix}play* <song name>`,
      ).catch(() => {});
    }
  },
};
