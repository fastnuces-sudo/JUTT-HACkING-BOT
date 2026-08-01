// ============================================
// AA MD Bot - Audio/Video Trimmer
// Trims quoted audio or video by start/end seconds
// Uses system ffmpeg (available on Replit/NixOS)
// ============================================

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateId } from '../../lib/helper.js';
import { downloadContentFromMessage } from '@whiskeysockets/baileys';

const execP = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { existsSync } from 'fs';

function ffmpegPath() {
  for (const p of [
    '/nix/store/dfbji9dfjgq3lfi380y16rlfw10m4db3-replit-runtime-path/bin/ffmpeg',
    '/usr/bin/ffmpeg', '/usr/local/bin/ffmpeg',
  ]) {
    if (existsSync(p)) return p;
  }
  return 'ffmpeg';
}
const FFMPEG = ffmpegPath();

async function downloadQuoted(quoted, type) {
  const stream = await downloadContentFromMessage(quoted, type);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export default {
  command: 'trim',
  alias: ['cut', 'clip', 'trimvid', 'trimaudio'],
  description: 'Trim quoted audio or video — .trim <start> <end> (in seconds)',
  category: 'media',

  async execute({ msg, reply, react, sock, jid, args }) {
    const start = parseFloat(args[0]);
    const end   = parseFloat(args[1]);

    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isVideo = !!quoted?.videoMessage;
    const isAudio = !!quoted?.audioMessage;

    if (!quoted || (!isVideo && !isAudio)) {
      return reply(
        `✂️ *Audio/Video Trimmer*\n\n` +
        `*Usage:* Reply to an audio or video with:\n` +
        `*.trim <start> <end>*\n\n` +
        `*Example:*\n` +
        `*.trim 10 30* → trims from 10s to 30s\n\n` +
        `> ✂️ *AA MD Bot*`
      );
    }

    if (isNaN(start) || isNaN(end) || end <= start) {
      return reply(`❌ Invalid time range.\n\nUsage: *.trim <start> <end>* (in seconds)\nExample: *.trim 10 30*`);
    }
    if ((end - start) > 300) return reply('❌ Max trim duration is 5 minutes (300 seconds).');

    await react('✂️');

    const ext    = isVideo ? 'mp4' : 'mp3';
    const tmpId  = generateId();
    const tmpDir = path.join(__dirname, '../../temp');
    const inFile = path.join(tmpDir, `trim_in_${tmpId}.${ext}`);
    const outFile = path.join(tmpDir, `trim_out_${tmpId}.${ext}`);
    fs.ensureDirSync(tmpDir);

    try {
      const media = isVideo ? quoted.videoMessage : quoted.audioMessage;
      const buf   = await downloadQuoted(media, isVideo ? 'video' : 'audio');
      fs.writeFileSync(inFile, buf);

      const duration = end - start;
      const cmd = isVideo
        ? `${FFMPEG} -ss ${start} -i "${inFile}" -t ${duration} -c:v libx264 -c:a aac -preset fast -y "${outFile}"`
        : `${FFMPEG} -ss ${start} -i "${inFile}" -t ${duration} -acodec libmp3lame -ab 128k -y "${outFile}"`;

      await execP(cmd, { timeout: 120000 });

      const outBuf = fs.readFileSync(outFile);
      if (isVideo) {
        await sock.sendMessage(jid, {
          video: outBuf,
          mimetype: 'video/mp4',
          caption: `✂️ *Trimmed:* ${start}s → ${end}s (${duration}s)\n\n> ✂️ *AA MD Bot*`,
        }, { quoted: msg });
      } else {
        await sock.sendMessage(jid, {
          audio: outBuf,
          mimetype: 'audio/mpeg',
          fileName: `trimmed_${tmpId}.mp3`,
        }, { quoted: msg });
      }
      await react('✅');
    } catch (e) {
      await react('❌');
      reply(`❌ Trim failed: ${e.message}`);
    } finally {
      fs.remove(inFile).catch(() => {});
      fs.remove(outFile).catch(() => {});
    }
  },
};
