// ============================================
// AA MD Bot - Encoder / Decoder
// Commands: .base64 .binary .hex2text .rot13 .encode
// No external API — all built-in
// ============================================

function toBinary(str) { return str.split('').map(c => c.charCodeAt(0).toString(2).padStart(8,'0')).join(' '); }
function fromBinary(str) { try { return str.trim().split(/\s+/).map(b => String.fromCharCode(parseInt(b,2))).join(''); } catch { throw new Error('Invalid binary string'); } }
function toHex(str) { return Buffer.from(str,'utf8').toString('hex'); }
function fromHex(str) { try { return Buffer.from(str.trim(),'hex').toString('utf8'); } catch { throw new Error('Invalid hex string'); } }
function rot13(str) { return str.replace(/[a-zA-Z]/g, c => String.fromCharCode(c.charCodeAt(0) + (c.toLowerCase() < 'n' ? 13 : -13))); }

export default {
  command: 'base64',
  alias: ['b64', 'encode', 'decode', 'binary', 'hex2text', 'rot13'],
  description: 'Encode/decode text: Base64, Binary, Hex, ROT13',
  category: 'tools',

  async execute({ command, args, text, reply, prefix }) {
    // ── base64 / b64 ──────────────────────────────────────
    if (command === 'base64' || command === 'b64') {
      const mode = (args[0] || '').toLowerCase();
      if (!['encode','decode','enc','dec'].includes(mode) || args.length < 2) {
        return reply(
          `🔐 *Base64 Encoder/Decoder*\n\n` +
          `• ${prefix}base64 encode <text>\n` +
          `• ${prefix}base64 decode <base64>\n\n` +
          `*Example:*\n\`${prefix}base64 encode Hello World\`\n\n> 🔐 *AA MD Bot*`
        );
      }
      const input = args.slice(1).join(' ');
      const isEnc = mode === 'encode' || mode === 'enc';
      try {
        const result = isEnc
          ? Buffer.from(input,'utf8').toString('base64')
          : Buffer.from(input,'base64').toString('utf8');
        return reply(
          `🔐 *Base64 ${isEnc ? 'Encoded' : 'Decoded'}*\n\n` +
          `📥 *Input:* \`${input.slice(0,80)}${input.length>80?'…':''}\`\n\n` +
          `📤 *Result:*\n\`\`\`${result}\`\`\`` +
          `\n\n> 🔐 *AA MD Bot*`
        );
      } catch { return reply(`❌ Invalid Base64 string.\n\n> 🔐 *AA MD Bot*`); }
    }

    // ── binary ────────────────────────────────────────────
    if (command === 'binary') {
      if (!text) return reply(`*Usage:* ${prefix}binary <text>\n*Example:* ${prefix}binary Hello`);
      const isBin = /^[01\s]+$/.test(text.trim());
      try {
        if (isBin) {
          const decoded = fromBinary(text);
          return reply(`🔢 *Binary → Text*\n\n\`${text.slice(0,60)}…\`\n\n*Result:* ${decoded}\n\n> 🔐 *AA MD Bot*`);
        } else {
          const encoded = toBinary(text);
          return reply(`🔢 *Text → Binary*\n\n\`${text.slice(0,40)}\`\n\n\`\`\`${encoded.slice(0,800)}\`\`\`\n\n> 🔐 *AA MD Bot*`);
        }
      } catch(e) { return reply(`❌ ${e.message}`); }
    }

    // ── hex2text ──────────────────────────────────────────
    if (command === 'hex2text') {
      if (!text) return reply(`*Usage:* ${prefix}hex2text <hex>\n*Example:* ${prefix}hex2text 48656c6c6f`);
      try {
        const mode = args[0]?.toLowerCase();
        if (mode === 'encode') {
          const hex = toHex(args.slice(1).join(' '));
          return reply(`🔡 *Text → Hex*\n\n\`\`\`${hex}\`\`\`\n\n> 🔐 *AA MD Bot*`);
        }
        const decoded = fromHex(text);
        return reply(`🔡 *Hex → Text*\n\n*Result:* ${decoded}\n\n> 🔐 *AA MD Bot*`);
      } catch(e) { return reply(`❌ ${e.message}\n\n> 🔐 *AA MD Bot*`); }
    }

    // ── rot13 ─────────────────────────────────────────────
    if (command === 'rot13') {
      if (!text) return reply(`*Usage:* ${prefix}rot13 <text>\n*Example:* ${prefix}rot13 Hello`);
      return reply(`🔄 *ROT13*\n\n\`${text}\` → \`${rot13(text)}\`\n\n_Apply ROT13 again to decode._\n\n> 🔐 *AA MD Bot*`);
    }

    // ── encode (general) ──────────────────────────────────
    if (!text) return reply(
      `🔐 *Encoder/Decoder*\n\n` +
      `• ${prefix}base64 encode/decode <text>\n` +
      `• ${prefix}binary <text or binary>\n` +
      `• ${prefix}hex2text <hex> | ${prefix}hex2text encode <text>\n` +
      `• ${prefix}rot13 <text>\n\n> 🔐 *AA MD Bot*`
    );

    const mode = (args[0] || '').toLowerCase();
    const input = args.slice(1).join(' ') || text;
    if (!input) return reply(`*Usage:* ${prefix}encode <base64|binary|hex|rot13> <text>`);

    const results = [];
    if (mode === 'base64') { results.push(`Base64: ${Buffer.from(input).toString('base64')}`); }
    else if (mode === 'hex') { results.push(`Hex: ${toHex(input)}`); }
    else if (mode === 'binary') { results.push(`Binary: ${toBinary(input).slice(0,400)}`); }
    else if (mode === 'rot13') { results.push(`ROT13: ${rot13(input)}`); }
    else {
      results.push(`Base64: ${Buffer.from(text).toString('base64')}`);
      results.push(`Hex: ${toHex(text)}`);
      results.push(`ROT13: ${rot13(text)}`);
    }
    reply(`🔐 *Encode Results*\n\n📝 Input: \`${text.slice(0,50)}\`\n\n${results.join('\n')}\n\n> 🔐 *AA MD Bot*`);
  },
};
