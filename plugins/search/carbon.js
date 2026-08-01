// ============================================
// AA MD Bot - Code to Beautiful Image
// Uses carbon.now.sh via thum.io screenshot
// Commands: .carbon .codeimg .code2img
// ============================================
import axios from 'axios';

const THEMES = {
  monokai:   'monokai',
  dracula:   'dracula',
  nord:      'nord',
  solarized: 'solarized%20dark',
  github:    'github',
  vscode:    'vscode',
};

export default {
  command: 'carbon',
  alias: ['codeimg', 'code2img', 'codeshot', 'codepic'],
  description: 'Convert code to a beautiful image (Carbon style)',
  category: 'search',

  async execute({ text, args, reply, react, sock, jid, msg, prefix }) {
    if (!text) return reply(
      `💻 *Code to Image*\n\n` +
      `*Usage:* ${prefix}carbon <code>\n\n` +
      `*Examples:*\n` +
      `• ${prefix}carbon console.log("Hello")\n` +
      `• ${prefix}carbon print("Hello World") --theme=dracula\n\n` +
      `*Themes:* monokai, dracula, nord, solarized, github, vscode\n\n` +
      `> 💻 *AA MD Bot*`
    );

    // Extract optional --theme= flag
    const themeMatch = text.match(/--theme=(\w+)/i);
    const themeKey   = themeMatch ? themeMatch[1].toLowerCase() : 'monokai';
    const theme      = THEMES[themeKey] || 'monokai';
    const code       = text.replace(/--theme=\w+/i, '').trim();

    if (!code) return reply(`❌ Please provide code to convert.\n\n${prefix}carbon console.log("Hi")`);

    await react('💻');

    const carbonUrl = `https://carbon.now.sh/?bg=rgba%28171%2C184%2C195%2C1%29&t=${theme}&wt=none&l=auto&ds=true&dsyoff=20px&dsblur=68px&wc=true&wa=true&pv=56px&ph=56px&ln=false&fl=1&fm=Hack&fs=14px&lh=133%25&si=false&es=2x&wm=false&code=${encodeURIComponent(code)}`;

    try {
      // Try thum.io screenshot
      const screenshotUrl = `https://image.thum.io/get/width/1200/crop/700/noanimate/${carbonUrl}`;
      const { data: imgBuf } = await axios.get(screenshotUrl, {
        responseType: 'arraybuffer',
        timeout: 35000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      if (imgBuf?.byteLength > 5000) {
        await sock.sendMessage(jid, {
          image:   Buffer.from(imgBuf),
          caption: `💻 *Code Image*\n🎨 Theme: ${themeKey}\n\n> 💻 *AA MD Bot*`,
        }, { quoted: msg });
        await react('✅');
        return;
      }
    } catch {}

    // Fallback: send link
    await react('❌');
    reply(
      `💻 *Code Image — Link*\n\n` +
      `Screenshot failed. Open this link to view your code image:\n\n` +
      `${carbonUrl}\n\n` +
      `> 💻 *AA MD Bot*`
    );
  },
};
