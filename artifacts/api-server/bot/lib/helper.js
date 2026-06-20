import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import moment from 'moment-timezone';
import { fileURLToPath } from 'url';
import config from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function getPrefix(text) {
  const prefixes = config.prefix;
  for (const p of prefixes) {
    if (text.startsWith(p)) return p;
  }
  return null;
}

export function parseCommand(text) {
  const prefix = getPrefix(text);
  if (!prefix) return null;
  const withoutPrefix = text.slice(prefix.length).trim();
  const [cmd, ...args] = withoutPrefix.split(/\s+/);
  return {
    prefix,
    command: cmd.toLowerCase(),
    args,
    text: args.join(' '),
    flags: args.filter(a => a.startsWith('--')).map(a => a.slice(2)),
  };
}

export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function getTime(timezone = config.timezone) {
  return moment().tz(timezone).format('HH:mm:ss');
}

export function getDate(timezone = config.timezone) {
  return moment().tz(timezone).format('DD/MM/YYYY');
}

export function getDateTime(timezone = config.timezone) {
  return moment().tz(timezone).format('DD/MM/YYYY HH:mm:ss');
}

export function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function cleanJid(jid) {
  return jid.split('@')[0];
}

export function isGroup(jid) {
  return jid.endsWith('@g.us');
}

export function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

export function sanitize(text) {
  return text.replace(/[<>&"']/g, c => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function getMentions(text) {
  const mentions = [];
  const regex = /@(\d+)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    mentions.push(`${match[1]}@s.whatsapp.net`);
  }
  return mentions;
}

export async function getBuffer(url, options = {}) {
  const { default: axios } = await import('axios');
  const response = await axios.get(url, { responseType: 'arraybuffer', ...options });
  return Buffer.from(response.data);
}

export function tempFile(ext = 'tmp') {
  const dir = path.join(__dirname, '../temp');
  fs.ensureDirSync(dir);
  return path.join(dir, `${generateId()}.${ext}`);
}

export async function cleanTemp() {
  const dir = path.join(__dirname, '../temp');
  const files = await fs.readdir(dir).catch(() => []);
  const now = Date.now();
  for (const file of files) {
    const fp = path.join(dir, file);
    const stat = await fs.stat(fp).catch(() => null);
    if (stat && now - stat.mtimeMs > 30 * 60 * 1000) {
      await fs.remove(fp).catch(() => {});
    }
  }
}

export function bold(text) { return `*${text}*`; }
export function italic(text) { return `_${text}_`; }
export function strike(text) { return `~${text}~`; }
export function mono(text) { return `\`${text}\``; }
export function code(text) { return `\`\`\`${text}\`\`\``; }

export default {
  getPrefix, parseCommand, formatDuration, formatBytes,
  getTime, getDate, getDateTime, randomChoice, randomInt,
  sleep, cleanJid, isGroup, generateId, sanitize, chunk,
  getMentions, getBuffer, tempFile, cleanTemp,
  bold, italic, strike, mono, code,
};
