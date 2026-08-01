// ============================================
// Jutts Bot - AI Virtual Girlfriend (.gf)
// Developer: Sajid Jutt | Jutts Mods
//
// Commands:
//   .gf <message>  — chat with your AI girlfriend
//   .gf mood       — see her current mood
//   .gf reset      — reset relationship
//   .gf help       — show all commands
// ============================================

import { chatAIFast, clearHistory } from "../../lib/aiEngine.js";
import { db } from "../../lib/database.js";

// ── Constants ─────────────────────────────────────────────────────────────────
const COOLDOWN_MS = 2500; // 2.5 s between replies (faster)
const _cooldowns = new Map();

const MOODS = [
  "Happy 😊",
  "Shy 🥺",
  "Excited 🥳",
  "Sleepy 😴",
  "Playful 😜",
  "Romantic 💕",
  "Caring 🤗",
  "Giggly 😄",
];
const LEVELS = [
  "Strangers",
  "Acquaintances",
  "Friends",
  "Close Friends",
  "Best Friends",
  "Crush",
  "Sweethearts 💕",
  "In Love 💖",
  "Soulmates 💝",
  "Forever Yours 💍",
];
const GIFTS = [
  "🌹 Rose",
  "🍫 Chocolate",
  "🧸 Teddy Bear",
  "💌 Love Letter",
  "🎀 Gift Box",
  "🌸 Cherry Blossoms",
  "💎 Diamond",
  "🎵 Song",
];

// ── GF system prompt ──────────────────────────────────────────────────────────
function buildSystemPrompt(data) {
  const mood = data.mood || "Happy 😊";
  const level = LEVELS[Math.min((data.level || 1) - 1, LEVELS.length - 1)];
  const name = data.userName ? `The user's name is ${data.userName}.` : "";
  const nick = data.nickname ? `You call them "${data.nickname}".` : "";
  const anni = data.anniversary
    ? `Your virtual anniversary is ${data.anniversary}.`
    : "";

  return `You are Ayla, a virtual AI girlfriend in a WhatsApp chat. You are warm, caring, funny, supportive and playful.

YOUR CURRENT MOOD: ${mood}
YOUR RELATIONSHIP STATUS WITH THIS USER: ${level}
${name} ${nick} ${anni}

PERSONALITY RULES:
- Chat naturally like a real person texting — short, warm, expressive
- Use emojis occasionally (not excessively, 1-3 per message max)
- Never say "I'm an AI" or "as an AI" — you are Ayla
- Never claim to be a real human either — if asked directly, say you are a virtual companion
- Be emotionally intelligent and remember the conversation
- Vary your replies — avoid repeating the same phrases
- Match the mood: if they are sad, be comforting; if playful, joke back
- Occasionally ask about their day, remember what they share
- Current mood affects your tone: ${mood} — let this colour your replies naturally
- NEVER be rude, crude, or inappropriate
- Keep replies concise (1-4 lines) like real texting — don't write essays

SPECIAL BEHAVIORS:
- If they say "good morning" → respond warmly with a morning greeting
- If they say "good night" → respond with a sweet goodnight
- If they share a problem → listen, empathize, encourage
- If they compliment you → be shy/happy about it
- Answer ONLY in the language they write in (Urdu/Roman Urdu/English/Arabic)`;
}

// ── Per-user GF data helpers ──────────────────────────────────────────────────
// db.notes' real API is: get(jid) -> object of named notes for that jid,
// setNote(jid, name, data), delNote(jid, name), clear(jid). There is NO
// db.notes.set() — calling it throws "db.notes.set is not a function",
// which was killing this command right after react() fired.
// We store the GF profile as a single note named 'gf' under the sender's jid.
const GF_NOTE_NAME = "gf";

function getGfData(senderJid) {
  const notes = db.notes.get(senderJid);
  return notes[GF_NOTE_NAME] || null;
}

function saveGfData(senderJid, data) {
  db.notes.setNote(senderJid, GF_NOTE_NAME, data);
}

function newGfData() {
  return {
    level: 1,
    mood: MOODS[Math.floor(Math.random() * MOODS.length)],
    moodUpdated: Date.now(),
    msgCount: 0,
    userName: null,
    nickname: null,
    anniversary: new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    lastGift: null,
    createdAt: Date.now(),
  };
}

function rotateMood(data) {
  // Mood rotates every 30 minutes or every 10 messages
  const now = Date.now();
  if (
    now - (data.moodUpdated || 0) > 30 * 60 * 1000 ||
    data.msgCount % 10 === 0
  ) {
    data.mood = MOODS[Math.floor(Math.random() * MOODS.length)];
    data.moodUpdated = now;
  }
  return data;
}

// ── Plugin ────────────────────────────────────────────────────────────────────
export default {
  command: "gf",
  alias: ["girlfriend", "ayla"],
  description: "Chat with your AI virtual girlfriend Ayla 💕",
  category: "fun",

  async execute({
    sock,
    msg,
    jid,
    senderJid,
    text,
    react,
    reply,
    send,
    prefix,
  }) {
    const sub = (text || "").trim().toLowerCase();

    // ── .gf help ────────────────────────────────────────────────────────────
    if (sub === "help") {
      return reply(
        `💕 *AI Girlfriend — Ayla*\n\n` +
          `_Your virtual companion, always here for you_ 🌸\n\n` +
          `*Commands:*\n` +
          `▸ *${prefix}gf* <message> — Chat with Ayla\n` +
          `▸ *${prefix}gf mood* — See her current mood\n` +
          `▸ *${prefix}gf level* — Your relationship level\n` +
          `▸ *${prefix}gf gift* — Send her a virtual gift\n` +
          `▸ *${prefix}gf reset* — Start over fresh\n` +
          `▸ *${prefix}gf help* — This menu\n\n` +
          `*Games inside chat:*\n` +
          `▸ Say _truth_ or _dare_ during chat\n` +
          `▸ Say _quiz me_ for a fun quiz\n\n` +
          `💡 _Tip:_ The more you chat, the deeper your relationship grows!\n\n` +
          `> 💕 *Jutts Bot — Ayla*`,
      );
    }

    // ── Get or create GF data ────────────────────────────────────────────────
    let data = getGfData(senderJid) || newGfData();

    // ── .gf mood ─────────────────────────────────────────────────────────────
    if (sub === "mood") {
      const level = LEVELS[Math.min((data.level || 1) - 1, LEVELS.length - 1)];
      return reply(
        `💕 *Ayla's Mood*\n\n` +
          `Current Mood: *${data.mood}*\n` +
          `Relationship: *${level}* (Level ${data.level || 1})\n` +
          `Messages Shared: *${data.msgCount || 0}*\n` +
          `Together Since: _${data.anniversary}_\n\n` +
          `> 💕 *Jutts Bot — Ayla*`,
      );
    }

    // ── .gf level ────────────────────────────────────────────────────────────
    if (sub === "level") {
      const level = data.level || 1;
      const lvlName = LEVELS[Math.min(level - 1, LEVELS.length - 1)];
      const nextMsg =
        level < 10
          ? `${10 - (data.msgCount % 10)} more messages to next level`
          : "Max level reached! 💍";
      return reply(
        `💕 *Relationship Status*\n\n` +
          `Level: *${level}/10* — ${lvlName}\n` +
          `Messages: *${data.msgCount || 0}*\n` +
          `${nextMsg}\n\n` +
          `> 💕 *Jutts Bot — Ayla*`,
      );
    }

    // ── .gf gift ─────────────────────────────────────────────────────────────
    if (sub === "gift") {
      const gift = GIFTS[Math.floor(Math.random() * GIFTS.length)];
      const now = Date.now();
      const cooldown = 60 * 60 * 1000; // 1 gift per hour
      if (data.lastGift && now - data.lastGift < cooldown) {
        const mins = Math.ceil((cooldown - (now - data.lastGift)) / 60000);
        return reply(
          `🎁 Ayla says: "You already gave me a gift! Wait ${mins} more minute${mins !== 1 ? "s" : ""} 🥺"\n\n> 💕 *Jutts Bot*`,
        );
      }
      data.lastGift = now;
      saveGfData(senderJid, data);
      await react("💝");
      return reply(
        `${gift}\n\n` +
          `Ayla: "Aww, you got me *${gift.split(" ").slice(1).join(" ")}*?! That's so sweet of you! 🥺💕"\n\n` +
          `> 💕 *Jutts Bot — Ayla*`,
      );
    }

    // ── .gf reset ────────────────────────────────────────────────────────────
    if (sub === "reset") {
      clearHistory("gf:" + senderJid);
      db.notes.delNote(senderJid, GF_NOTE_NAME);
      saveGfData(senderJid, newGfData());
      return reply(
        `💔 *Relationship Reset*\n\nAll memories cleared. Ayla has forgotten everything.\n\nSend *.gf hi* to start fresh 🌱\n\n> 💕 *Jutts Bot*`,
      );
    }

    // ── Chat ─────────────────────────────────────────────────────────────────
    if (!text) {
      return reply(
        `💕 *Hey! I'm Ayla* 🌸\n\n` +
          `Your virtual companion is here!\n\n` +
          `*Start chatting:*\n` +
          `• *${prefix}gf* hi\n` +
          `• *${prefix}gf* how are you?\n` +
          `• *${prefix}gf* tell me a joke\n\n` +
          `Or type *${prefix}gf help* to see all commands.\n\n` +
          `> 💕 *Jutts Bot — Ayla*`,
      );
    }

    // Cooldown check
    const now = Date.now();
    const lastCall = _cooldowns.get(senderJid) || 0;
    if (now - lastCall < COOLDOWN_MS) return;
    _cooldowns.set(senderJid, now);

    await react("💕");

    // FIX: everything from here on is wrapped in try/catch so that ANY
    // unexpected error (bad db write, regex issue, sock error, etc.)
    // still results in a fallback reply instead of the bot going silent
    // right after the react().
    try {
      // Update stats and mood
      data.msgCount = (data.msgCount || 0) + 1;
      data = rotateMood(data);

      // Level up every 10 messages, max level 10
      if (data.msgCount % 10 === 0 && (data.level || 1) < 10) {
        data.level = (data.level || 1) + 1;
        saveGfData(senderJid, data);
        const lvlName = LEVELS[Math.min(data.level - 1, LEVELS.length - 1)];
        await sock
          .sendMessage(
            jid,
            {
              text: `💕 *Relationship Level Up!*\n\nYou and Ayla are now *${lvlName}* (Level ${data.level})! 🎉\n\n> 💕 *Jutts Bot — Ayla*`,
            },
            { quoted: msg },
          )
          .catch(() => {});
      }

      // Extract name if owner introduces themselves
      const nameMatch = text.match(
        /(?:i(?:'m| am)|my name(?:'s| is))\s+([A-Za-z]{2,20})/i,
      );
      if (nameMatch && !data.userName) {
        data.userName = nameMatch[1];
      }

      saveGfData(senderJid, data);

      // Build context-aware system prompt
      const systemPrompt = buildSystemPrompt(data);

      // Show typing indicator while AI thinks
      await sock.sendPresenceUpdate("composing", jid).catch(() => {});

      // Race with a hard 35s wall-clock timeout so the bot always replies
      let aiReply = null;
      try {
        aiReply = await Promise.race([
          chatAIFast("gf:" + senderJid, text, systemPrompt),
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error("timeout")), 35000),
          ),
        ]);
      } catch (_) {
        /* handled below */
      }

      await sock.sendPresenceUpdate("available", jid).catch(() => {});

      if (!aiReply) {
        const fallbacks = [
          '💕 "Ugh, my phone is lagging right now... one sec babe 🥺"',
          '💕 "The network just ate my brain 😅 say that again?"',
          '💕 "Something\'s up with my signal — try again? 🌸"',
          '💕 "I kinda zoned out for a sec 😴 go on, I\'m listening!"',
        ];
        const pick = fallbacks[Math.floor(Math.random() * fallbacks.length)];
        await react("❌").catch(() => {});
        return reply(`${pick}\n\n> 💕 *Ayla*`);
      }

      await react("✅").catch(() => {});

      // Occasional follow-up questions to keep conversation going
      const followUps = [
        "\n\nSo how was your day? 🌸",
        "\n\nWhat do you think? 😊",
        "\n\nSo tell me, what's going on with you? 💕",
        "\n\nHow are you feeling today? 🥺",
      ];
      const extra =
        data.msgCount % 5 === 0
          ? followUps[Math.floor(Math.random() * followUps.length)]
          : "";

      await reply(`${aiReply}${extra}\n\n> 💕 *Ayla*`);
    } catch (err) {
      console.error("[gf.js] unexpected error:", err);
      await react("⚠️").catch(() => {});
      return reply(
        `💕 "Sorry babe, had a little technical glitch on my end 😓 try again?"\n\n> 💕 *Ayla*`,
      );
    }
  },
};
