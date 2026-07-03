// ============================================
// AA MD Bot - NPM Package Search
// Uses public npm registry API (no API key needed)
// ============================================
import axios from 'axios';

export default {
  command: 'npm',
  alias: ['npmstalk', 'npmsearch', 'npmlook'],
  description: 'Get information about an NPM package',
  category: 'search',

  async execute({ sock, msg, jid, text, react, reply, prefix }) {
    if (!text) {
      await react('❔');
      return reply(
        `📦 *NPM Package Search*\n\n` +
        `Example: *${prefix}npm axios*\n` +
        `Example: *${prefix}npm express*`
      );
    }

    await react('🤔');

    try {
      const pkgName = text.trim().toLowerCase();

      // Fetch from official npm registry
      const [regRes, dlRes] = await Promise.allSettled([
        axios.get(`https://registry.npmjs.org/${encodeURIComponent(pkgName)}`, { timeout: 12000 }),
        axios.get(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(pkgName)}`, { timeout: 8000 }),
      ]);

      if (regRes.status === 'rejected' || !regRes.value?.data) {
        await react('❌');
        return reply(`❌ Package *${pkgName}* not found on npm.\n\nCheck spelling and try again.`);
      }

      const pkg     = regRes.value.data;
      const latest  = pkg['dist-tags']?.latest || 'N/A';
      const vd      = pkg.versions?.[latest] || {};
      const dlCount = dlRes.status === 'fulfilled' ? dlRes.value?.data?.downloads : null;

      const author = typeof pkg.author === 'string'
        ? pkg.author
        : (pkg.author?.name || pkg.maintainers?.[0]?.name || 'N/A');

      const homepage   = vd.homepage || pkg.homepage || 'N/A';
      const license    = vd.license  || pkg.license  || 'N/A';
      const pkgLink    = `https://www.npmjs.com/package/${pkgName}`;
      const repoUrl    = typeof vd.repository === 'string' ? vd.repository
                       : vd.repository?.url?.replace(/^git\+/, '').replace(/\.git$/, '') || 'N/A';
      const deps       = Object.keys(vd.dependencies || {}).slice(0, 10).join(', ') || 'None';
      const keywords   = (vd.keywords || []).slice(0, 8).join(', ') || 'N/A';
      const published  = pkg.time?.[latest]
                       ? new Date(pkg.time[latest]).toLocaleDateString('en-PK')
                       : 'N/A';
      const downloads  = dlCount ? dlCount.toLocaleString() + '/month' : 'N/A';

      const caption =
        `📦 *NPM Package Info*\n\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📛 *Name:* ${pkg.name}\n` +
        `📝 *Description:* ${(pkg.description || 'N/A').slice(0, 120)}\n` +
        `🏷️ *Version:* ${latest}\n` +
        `👤 *Author:* ${author}\n` +
        `📅 *Published:* ${published}\n` +
        `⬇️ *Downloads:* ${downloads}\n` +
        `📄 *License:* ${license}\n` +
        `🏠 *Homepage:* ${homepage !== 'N/A' ? homepage : 'N/A'}\n` +
        `🔗 *NPM:* ${pkgLink}\n` +
        (repoUrl !== 'N/A' ? `💻 *Repo:* ${repoUrl}\n` : '') +
        `\n🔧 *Dependencies (${Object.keys(vd.dependencies || {}).length}):*\n${deps}\n` +
        `\n🏷️ *Keywords:* ${keywords}\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `> 🤖 *Powered by AA MD Bot*`;

      await sock.sendMessage(jid, {
        text: caption,
      }, { quoted: msg });

      await react('✅');

    } catch (err) {
      console.error('NPM error:', err.message);
      await react('❌');
      return reply(`❌ Could not fetch package info: ${err.message?.slice(0, 60)}`);
    }
  },
};
