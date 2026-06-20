import pino from 'pino';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '../logs');
fs.ensureDirSync(logsDir);

export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: {
    targets: [
      {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
        level: 'debug',
      },
      {
        target: 'pino/file',
        options: {
          destination: path.join(logsDir, 'bot.log'),
          mkdir: true,
        },
        level: 'info',
      },
    ],
  },
});

export function baileyLogger() {
  return pino({ level: 'silent' });
}

export default logger;
