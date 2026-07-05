// ============================================
// AA MD Bot - APK Downloader
// Primary: Aptoide API
// Fallback: APKPure search API
// ============================================

import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateId } from '../../lib/helper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const api = axios.create({ timeout: 20000 });

async function searchAptoide(query) {
  const { data } = await api.get('https://ws75.aptoide.com/api/7/apps/search', {
    params: { query, limit: 3 },
  });
  return data?.datalist?.list || [];
}

async function searchApkPure(query) {
  const { data } = await api.get(`https://api.apkpure.com/v3/apps/search?q=${encodeURIComponent(query)}&limit=3`, {
    headers: { 'User-Agent': 'APKPure/3.17.26' },
  });
  return data?.data?.products || [];
}

export default {
  command: 'apk',
  alias: ['apkdl', 'androidapp', 'getapk'],
  category: 'download',
  description: 'Download Android APK by app name',
  usage: '.apk WhatsApp',

  async execute({ reply, react, sock, jid, msg, text }) {
    if (!text) return reply(
      `📱 *APK Downloader*\n\n` +
      `Usage: *.apk <app name>*\n` +
      `Example: *.apk WhatsApp*\n\n` +
      `> 📦 *AA MD Bot*`
    );

    await react('⏳');

    // ── Search Aptoide ──────────────────────────────────────────────────────
    let app = null;
    try {
      const list = await searchAptoide(text);
      if (list.length) {
        app = {
          name:    list[0].name,
          version: list[0].file?.vername || 'Unknown',
          size:    parseFloat(list[0].file?.filesize || 0) / (1024 * 1024),
          pkg:     list[0].package_name || '',
          dlUrl:   list[0].file?.path,
          icon:    list[0].icon,
          rating:  list[0].stats?.rating?.avg?.toFixed(1) || 'N/A',
          source:  'Aptoide',
        };
      }
    } catch {}

    if (!app?.dlUrl) {
      return react('❌').then(() =>
        reply(`❌ *APK not found for:* "${text}"\n\nTry a more exact name or package name.\n\nExample: *.apk com.whatsapp*`)
      );
    }

    if (app.size > 100) {
      await react('❌');
      return reply(`❌ *APK too large* (${app.size.toFixed(1)} MB)\n\nMax size is 100 MB due to WhatsApp limits.\n\nDownload directly: *${app.pkg}*`);
    }

    await reply(
      `📥 *Downloading APK…*\n\n` +
      `📱 *App:* ${app.name}\n` +
      `📦 *Version:* ${app.version}\n` +
      `📁 *Size:* ${app.size.toFixed(1)} MB\n` +
      `⭐ *Rating:* ${app.rating}\n` +
      `📡 *Source:* ${app.source}`
    );

    const tmpPath = path.join(__dirname, '../../temp', `${generateId()}.apk`);
    fs.ensureDirSync(path.dirname(tmpPath));

    try {
      const fileRes = await axios.get(app.dlUrl, {
        responseType: 'stream',
        timeout: 90000,
      });

      await new Promise((res, rej) => {
        const writer = fs.createWriteStream(tmpPath);
        fileRes.data.pipe(writer);
        writer.on('finish', res);
        writer.on('error', rej);
      });

      const apkBuf = fs.readFileSync(tmpPath);

      await sock.sendMessage(jid, {
        document: apkBuf,
        mimetype: 'application/vnd.android.package-archive',
        fileName: `${app.name.replace(/[^a-zA-Z0-9]/g, '_')}_${app.version}.apk`,
        caption:
          `📱 *${app.name}*\n` +
          `📦 Version: ${app.version}\n` +
          `🆔 Package: ${app.pkg}\n` +
          `📁 Size: ${app.size.toFixed(1)} MB\n` +
          `⭐ Rating: ${app.rating}\n\n` +
          `> 📥 *AA MD Bot*`,
      }, { quoted: msg });

      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ *APK download failed*\n\n${e.message}\n\n💡 Try searching the exact package name.`);
    } finally {
      fs.remove(tmpPath).catch(() => {});
    }
  },
};
