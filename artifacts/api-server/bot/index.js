import http from 'http';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { logger } from './lib/logger.js';
import { db } from './lib/database.js';
import { loadAllPlugins, getCategories, plugins } from './lib/pluginLoader.js';
import { handleMessage } from './lib/commandHandler.js';
import { initAllSessions, setMessageHandler, setConnectionHandler, getAllSessions, sessions } from './lib/sessionManager.js';
import config from './config.js';
import { cleanTemp, formatDuration } from './lib/helper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const startTime = Date.now();

process.on('uncaughtException', (err) => {
  logger.error({ err }, '💥 Uncaught Exception');
});
process.on('unhandledRejection', (err) => {
  logger.error({ err }, '💥 Unhandled Rejection');
});

function printBanner() {
  console.log(chalk.cyan.bold(`
╔══════════════════════════════════════════╗
║          AA MD BOT  v${config.version}            ║
║     Developer: ${config.developer}     ║
║          Brand: ${config.brand}              ║
║      Multi-Device WhatsApp Bot           ║
╚══════════════════════════════════════════╝`));
}

async function startHealthServer() {
  const port = parseInt(process.env.PORT || '5000', 10);

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    if (url.pathname === '/api/healthz' || url.pathname === '/api/health') {
      const uptime = Date.now() - startTime;
      const sessionsInfo = getAllSessions();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        bot: config.botName,
        version: config.version,
        uptime: formatDuration(uptime),
        sessions: sessionsInfo.length,
        plugins: plugins.size,
        maintenance: db.settings.getValue('maintenanceMode') || false,
      }));
      return;
    }

    if (url.pathname === '/api/sessions') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sessions: getAllSessions() }));
      return;
    }

    if (url.pathname === '/api/stats') {
      const users = db.users.all();
      const groups = db.groups.all();
      const cats = getCategories();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        users: Object.keys(users).length,
        groups: Object.keys(groups).length,
        plugins: plugins.size,
        categories: Object.keys(cats).length,
        uptime: formatDuration(Date.now() - startTime),
        sessions: getAllSessions(),
      }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      bot: config.botName,
      developer: config.developer,
      brand: config.brand,
      version: config.version,
      status: 'running',
    }));
  });

  server.listen(port, () => {
    logger.info({ port }, `🌐 Health server listening`);
  });

  return server;
}

setMessageHandler(handleMessage);
setConnectionHandler((sessionId, sock, status) => {
  logger.info({ sessionId, status }, '📡 Session connection update');
  if (status === 'open') {
    logger.info(chalk.green(`✅ Session ${sessionId} connected as ${sock.user?.name || sock.user?.id}`));
  }
});

async function main() {
  printBanner();

  logger.info('🚀 Starting AA MD Bot...');

  fs.ensureDirSync(path.join(__dirname, 'logs'));
  fs.ensureDirSync(path.join(__dirname, 'temp'));
  fs.ensureDirSync(path.join(__dirname, 'media'));
  fs.ensureDirSync(path.join(__dirname, 'session'));

  await startHealthServer();

  logger.info('📦 Loading plugins...');
  const pluginCount = await loadAllPlugins();
  logger.info(chalk.green(`✅ Loaded ${pluginCount} plugins`));

  const cats = getCategories();
  const catList = Object.entries(cats).map(([k, v]) => `${k}(${v.length})`).join(', ');
  logger.info(`📂 Categories: ${catList}`);

  logger.info('🔌 Initializing WhatsApp sessions...');
  await initAllSessions();

  setInterval(cleanTemp, 30 * 60 * 1000);

  logger.info(chalk.cyan.bold('✨ AA MD Bot is fully operational!'));
}

main().catch(err => {
  logger.error({ err }, 'Fatal error during startup');
  process.exit(1);
});
