// ============================================
// AA MD Bot - AI Summarizer
// Summarizes long text, articles, quoted msgs
// Uses Pollinations AI → extractive fallback
// Commands: .summarize .tldr .brief .summary
// ============================================
import axios from 'axios';

async function aiSummarize(text) {
  const { data } = await axios.post('https://text.pollinations.ai/openai', {
    model: 'openai',
    messages: [
      { role: 'system', content: 'You are an expert summarizer. Summarize the provided text into clear, concise bullet points. Cover ALL key points. Be brief but complete. Use • for bullets. Plain text only, no markdown symbols.' },
      { role: 'user',   content: `Summarize this:\n\n${text.slice(0, 4000)}` },
    ],
    temperature: 0.5,
    max_tokens: 500,
  }, { headers: { 'Content-Type': 'application/json' }, timeout: 25000 });
  const r = data?.choices?.[0]?.message?.content?.trim();
  if (!r) throw new Error('Empty response');
  return r;
}

function extractiveSummary(text) {
  const sentences = text.replace(/\s+/g,' ').split(/(?<=[.!?])\s+/).filter(s => s.length > 20);
  const take = Math.min(5, Math.max(3, Math.ceil(sentences.length * 0.25)));
  return sentences.slice(0, take).join(' ');
}

export default {
  command: 'summarize',
  alias: ['tldr', 'brief', 'summary', 'sum'],
  description: 'AI summarizes any long text or quoted message',
  category: 'search',

  async execute({ text, args, msg, reply, react, prefix }) {
    // Get text from args OR from quoted message
    const quotedText = msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation
      || msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.extendedTextMessage?.text
      || '';

    const input = (args.join(' ').trim() || quotedText).trim();

    if (!input) return reply(
      `📝 *AI Summarizer*\n\n` +
      `*Usage:*\n` +
      `• Reply to a long message with \`${prefix}tldr\`\n` +
      `• Or: \`${prefix}summarize <long text here>\`\n\n` +
      `*Aliases:* .tldr  .brief  .summary\n\n` +
      `> 📝 *AA MD Bot*`
    );

    if (input.length < 80) return reply(`⚠️ Text is too short to summarize (${input.length} chars).\n\nProvide a longer piece of text.\n\n> 📝 *AA MD Bot*`);

    await react('📝');

    let summary = null;
    let method  = 'AI';

    try {
      summary = await aiSummarize(input);
    } catch {
      summary = extractiveSummary(input);
      method  = 'Extracted';
    }

    reply(
      `📝 *Summary* _(${method})_\n\n` +
      summary +
      `\n\n_Original: ${input.length} chars_\n\n` +
      `> 📝 *AA MD Bot*`
    );
    await react('✅');
  },
};
