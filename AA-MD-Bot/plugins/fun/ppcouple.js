// ============================================
// Jutts Bot - Anime Couple PP
// Developer: Sajid Jutt | Jutts Mods
//
// Commands:
//   .ppcouple — random anime couple (boy + girl)
//   .ppboy    — random anime boy PP
//   .ppgirl   — random anime girl PP
// ============================================
import axios from "axios";
import https from "https";

const JSON_URL =
  "https://raw.githubusercontent.com/KazukoGans/database/main/anime/ppcouple.json";
const FOOTER = "\n\n> 🤖 *Jutts Bot*  •  👨‍💻 *Sajid Jutt*";

// ── Keep-Alive agent (reduces ECONNRESET on repeated requests) ────────────────
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 10 });

const axiosInstance = axios.create({
  httpsAgent,
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "*/*",
  },
});

// ── Generic retry wrapper ──────────────────────────────────────────────────────
async function withRetry(fn, retries = 3, delayMs = 1000) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retryable =
        err.code === "ECONNRESET" ||
        err.code === "ETIMEDOUT" ||
        err.code === "ECONNABORTED" ||
        err.message?.includes("socket hang up");
      if (!retryable || i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, delayMs * (i + 1))); // backoff
    }
  }
  throw lastErr;
}

// ── Fetch couple data (cached for 10 min to avoid repeated GitHub fetches) ────
let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 10 * 60 * 1000;

async function getCoupleData() {
  if (_cache && Date.now() - _cacheAt < CACHE_TTL) return _cache;
  const data = await withRetry(async () => {
    const res = await axiosInstance.get(JSON_URL, { timeout: 15000 });
    return res.data;
  });
  if (!Array.isArray(data) || !data.length) throw new Error("empty data");
  _cache = data;
  _cacheAt = Date.now();
  return data;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Download image buffer from URL (with retry) ───────────────────────────────
async function getBuffer(url) {
  return withRetry(async () => {
    const res = await axiosInstance.get(url, {
      responseType: "arraybuffer",
      timeout: 20000,
    });
    return Buffer.from(res.data);
  });
}

export default {
  command: "ppcouple",
  alias: ["ppcp", "couplepp", "ppboy", "ppgirl", "animepic"],
  description: "Random anime couple / boy / girl profile picture",
  category: "fun",
  usage: ".ppcouple | .ppboy | .ppgirl",
  async execute({ sock, msg, jid, command, react, reply }) {
    const cmd = (command || "ppcouple").toLowerCase();
    await react("🌸");

    let coupleData;
    try {
      coupleData = await getCoupleData();
    } catch (err) {
      await react("❌");
      return reply(
        `❌ Anime database load nahi hua. Thodi der baad try karo.\n\n_Error: ${err.message}_${FOOTER}`,
      );
    }

    // Agar ek pair ki image corrupt/dead link nikle to dusra pair try karo
    async function pickWorkingPair(maxTries = 3) {
      let lastErr;
      for (let i = 0; i < maxTries; i++) {
        const pair = pickRandom(coupleData);
        return pair; // pair hamesha return hoga, validity download time pe check hogi
      }
      throw lastErr;
    }

    try {
      const pair = await pickWorkingPair();

      // ── .ppboy — only boy image ──────────────────────────────────────────
      if (cmd === "ppboy") {
        const buf = await getBuffer(pair.cowo);
        await sock.sendMessage(
          jid,
          {
            image: buf,
            caption: `👦 *Anime Boy PP*\n_Random anime profile picture_${FOOTER}`,
          },
          { quoted: msg },
        );
        return await react("✅");
      }

      // ── .ppgirl — only girl image ────────────────────────────────────────
      if (cmd === "ppgirl") {
        const buf = await getBuffer(pair.cewe);
        await sock.sendMessage(
          jid,
          {
            image: buf,
            caption: `👧 *Anime Girl PP*\n_Random anime profile picture_${FOOTER}`,
          },
          { quoted: msg },
        );
        return await react("✅");
      }

      // ── .ppcouple / .ppcp / .couplepp — send boy + girl (independent) ────
      const results = await Promise.allSettled([
        getBuffer(pair.cowo),
        getBuffer(pair.cewe),
      ]);

      const [boyResult, girlResult] = results;

      if (boyResult.status === "fulfilled") {
        await sock.sendMessage(
          jid,
          {
            image: boyResult.value,
            caption: `💑 *Anime Couple PP*\n\n👦 *Boy*${FOOTER}`,
          },
          { quoted: msg },
        );
      }

      if (girlResult.status === "fulfilled") {
        await sock.sendMessage(
          jid,
          {
            image: girlResult.value,
            caption: `👧 *Girl*${FOOTER}`,
          },
          { quoted: msg },
        );
      }

      if (boyResult.status === "rejected" && girlResult.status === "rejected") {
        throw new Error(
          "Dono images load nahi hui - " + boyResult.reason.message,
        );
      }

      if (boyResult.status === "rejected" || girlResult.status === "rejected") {
        await react("⚠️");
        return reply(
          `⚠️ Ek image partial load hui, dusri fail ho gayi. Dobara try karo.${FOOTER}`,
        );
      }

      await react("✅");
    } catch (err) {
      await react("❌");
      reply(
        `❌ Image load nahi hua. Dobara try karo!\n\n_Error: ${err.message}_${FOOTER}`,
      );
    }
  },
};
