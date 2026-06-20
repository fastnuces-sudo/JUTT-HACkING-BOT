import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateId } from '../../lib/helper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  command: 'apk',
  alias: ['apkdl', 'androidapp'],
  category: 'download',
  description: 'Download Android APK from Aptoide',
  usage: '.apk WhatsApp',
  ownerOnly: false,
  execute: async ({ reply, react, sock, jid, msg, text }) => {
    if (!text) return reply('📱 Usage: .apk <app name>\n\nExample: .apk WhatsApp');

    await react('⏳');

    try {
      // Search Aptoide API
      const searchRes = await axios.get(`https://ws75.aptoide.com/api/7/apps/search`, {
        params: { query: text, limit: 5 },
        timeout: 15000,
      });

      const apps = searchRes.data?.datalist?.list;
      if (!apps?.length) return reply('❌ No APK found for: ' + text);

      const app = apps[0];
      const appName = app.name;
      const appId = app.id;
      const appSize = parseFloat(app.file?.filesize || 0) / (1024 * 1024);
      const appVersion = app.file?.vername || 'Unknown';
      const appPkg = app.package_name || '';
      const dlUrl = app.file?.path;

      if (!dlUrl) return reply('❌ No download link found for: ' + appName);
      if (appSize > 100) return reply(`❌ APK too large (${appSize.toFixed(1)} MB). Max 100 MB.`);

      await reply(`📥 Downloading *${appName}*\n📦 Version: ${appVersion}\n📁 Size: ${appSize.toFixed(1)} MB`);

      const filePath = path.join(__dirname, '../../temp', `${generateId()}.apk`);
      fs.ensureDirSync(path.dirname(filePath));

      const fileRes = await axios.get(dlUrl, { responseType: 'stream', timeout: 60000 });
      const writer = fs.createWriteStream(filePath);
      fileRes.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      const caption = `*App Name:* ${appName}\n*Package:* ${appPkg}\n*Version:* ${appVersion}\n*Size:* ${appSize.toFixed(1)} MB\n\n_Downloaded by AA MD Bot_`;

      await sock.sendMessage(jid, {
        document: fs.readFileSync(filePath),
        mimetype: 'application/vnd.android.package-archive',
        fileName: `${appName}.apk`,
        caption,
      }, { quoted: msg });

      await react('✅');
      fs.remove(filePath).catch(() => {});
    } catch (e) {
      await react('❌');
      reply('❌ APK download failed. Try a different app name.\n' + e.message);
    }
  },
};
