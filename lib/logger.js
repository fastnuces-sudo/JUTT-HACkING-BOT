import pino from 'pino';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logsDir = path.join(__dirname, '../logs');
fs.ensureDirSync(logsDir);

// Simple logger — no external transport needed
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
  },
});

export default logger;
