// ============================================
// AA MD Bot - AI Auto Reply
// Owner sets a brief context/persona once →
// bot uses AI to reply naturally as if the owner
// themselves were typing — not as a bot or assistant.
// ============================================

import axios from 'axios';

const CHAT_URL = 'https://text.pollinations.ai/openai';

// One-shot AI call — instructions are persona context, NOT the reply
export async function aiAutoReply(userMsg, instructions) {
  const systemPrompt =
    `You are playing the role of a real person based on this context:\n\n` +
    `"""${instructions}"""\n\n` +
    `Rules:\n` +
    `- Reply AS THAT PERSON, not as an AI or assistant. Never say you are an AI.\n` +
    `- Keep replies short, natural, and conversational — like a real WhatsApp message.\n` +
    `- Match the language the sender is using (Urdu, English, Roman Urdu, etc.).\n` +
    `- If someone says "hello" just say hello back and be warm. If someone asks a question, answer based on the context provided.\n` +
    `- Do NOT repeat the context or instructions back. Do NOT explain yourself.\n` +
    `- Do NOT use markdown, asterisks, hashtags, or formatting. Plain text only.\n` +
    `- Be polite, human, and brief. Max 2-3 sentences.`;

  const { data } = await axios.post(CHAT_URL, {
    model: 'openai',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMsg },
    ],
    temperature: 0.75,
    max_tokens: 200,
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 25000,
  });

  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error('No response');

  // Strip any leftover markdown the AI snuck in
  return reply
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/`{1,3}(.*?)`{1,3}/gs, '$1')
    .replace(/_{1,2}(.*?)_{1,2}/g, '$1')
    .trim();
}

export default {
  command: 'autoai',
  alias: ['aireply', 'aiautoreply'],
  description: 'Auto-reply to DMs using AI — replies naturally as if you are online',
  category: 'gb',
  ownerOnly: true,
  usage: '.autoai on | .autoai off | .autoai instructions <context> | .autoai status',

  async execute({ args, reply, react, sessionSettings }) {
    const sub = (args[0] || '').toLowerCase();

    // ── STATUS ─────────────────────────────────────────────────────────────────
    if (!sub || sub === 'status' || sub === 'info') {
      const on   = sessionSettings.get('aiAutoReply');
      const inst = sessionSettings.get('aiInstructions');
      return reply(
        `🤖 *AI Auto-Reply Status*\n\n` +
        `Status: *${on ? 'ON ✅' : 'OFF ❌'}*\n\n` +
        `Instructions:\n${inst ? `_"${inst.slice(0, 200)}${inst.length > 200 ? '…' : ''}"_` : '_Not set yet_'}\n\n` +
        `━━━━━━━━━━━━━━\n` +
        `*Commands:*\n` +
        `▸ .autoai on — Enable\n` +
        `▸ .autoai off — Disable\n` +
        `▸ .autoai instructions <context> — Set persona context\n` +
        `▸ .autoai status — Check status\n\n` +
        `*How it works:*\n` +
        `Give a short context about yourself. The AI replies *as you* — naturally, in the sender's language, not as a robot.\n\n` +
        `*Example:*\n` +
        `_.autoai instructions My name is Ahsan. I am a developer from Pakistan. I am currently busy but I will reply later._\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    // ── ON ─────────────────────────────────────────────────────────────────────
    if (sub === 'on' || sub === 'enable') {
      const inst = sessionSettings.get('aiInstructions');
      if (!inst) {
        return reply(
          `⚠️ *Set your context first!*\n\n` +
          `Give the AI a short description of yourself:\n\n` +
          `*.autoai instructions* My name is Ahsan. I am busy right now and will reply soon.\n\n` +
          `> 🤖 *AA MD Bot*`
        );
      }
      sessionSettings.set('aiAutoReply', true);
      await react('✅');
      return reply(
        `✅ *AI Auto-Reply ENABLED*\n\n` +
        `Anyone who DMs you will get a natural reply as if you're typing.\n` +
        `Use *.autoai off* to stop.\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    // ── OFF ────────────────────────────────────────────────────────────────────
    if (sub === 'off' || sub === 'disable') {
      sessionSettings.set('aiAutoReply', false);
      await react('✅');
      return reply(`❌ *AI Auto-Reply DISABLED.*\n\n> 🤖 *AA MD Bot*`);
    }

    // ── SET INSTRUCTIONS ───────────────────────────────────────────────────────
    if (sub === 'instructions' || sub === 'inst' || sub === 'set') {
      const text = args.slice(1).join(' ').trim();
      if (!text) {
        return reply(
          `❌ *Provide a short context about yourself.*\n\n` +
          `Example:\n` +
          `_.autoai instructions I am Ahsan, a developer. I am currently in a meeting and will reply later. I speak Urdu and English._\n\n` +
          `> 🤖 *AA MD Bot*`
        );
      }
      sessionSettings.set('aiInstructions', text);
      await react('✅');
      return reply(
        `✅ *Context saved!*\n\n` +
        `"${text.slice(0, 200)}${text.length > 200 ? '…' : ''}"\n\n` +
        `The AI will now reply as *you* — naturally and in the sender's language.\n` +
        `Run *.autoai on* to enable.\n\n` +
        `> 🤖 *AA MD Bot*`
      );
    }

    return reply(`❓ Unknown option. Use: *.autoai on/off/instructions/status*\n\n> 🤖 *AA MD Bot*`);
  },
};
