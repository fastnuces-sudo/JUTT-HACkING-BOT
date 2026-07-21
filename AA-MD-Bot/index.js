// Ensure common binary locations are in PATH (works on Replit, Railway, VPS, etc.)
const extraPaths = ['/home/runner/.local/bin', '/usr/local/bin', '/usr/bin'];
for (const p of extraPaths) {
  if (!process.env.PATH?.includes(p)) process.env.PATH = `${p}:${process.env.PATH || ''}`;
}

import http from 'http';
import zlib from 'zlib';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import QRCode from 'qrcode';
import { logger } from './lib/logger.js';
import { db, initDatabase } from './lib/database.js';
import { loadAllPlugins, getCategories, plugins } from './lib/pluginLoader.js';
import { handleMessage } from './lib/commandHandler.js';
import {
  initAllSessions, setMessageHandler, setConnectionHandler, sessions,
  getAllSessions, botEvents, sessionQRs, sessionStatus,
  createSession, deleteSession,
} from './lib/sessionManager.js';
import config from './config.js';
import { cleanTemp, formatDuration } from './lib/helper.js';
import { initTelegramAdmin }    from './lib/telegramAdmin.js';
import { initTelegramFeatures } from './lib/telegramFeatures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const startTime = Date.now();
const dashboardPath = path.join(__dirname, 'dashboard.html');

process.on('uncaughtException', err => logger.error({ err: err.message }, '💥 Uncaught Exception'));
process.on('unhandledRejection', err => logger.error({ err: String(err) }, '💥 Unhandled Rejection'));

// SSE clients
const sseClients = new Set();
const latestPairingCodes = new Map(); // sessionId → code

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch { sseClients.delete(res); }
  }
}

botEvents.on('qr', d => broadcast('qr', d));
botEvents.on('status', d => broadcast('status', d));
botEvents.on('pairingCode', d => {
  latestPairingCodes.set(d.sessionId, d.code);
  broadcast('pairingCode', d);
});
botEvents.on('pairingCodeError', d => broadcast('pairingCodeError', d));

// Helper: strip /api prefix
function stripApi(p) { return p.replace(/^\/api/, '') || '/'; }

function printBanner() {
  console.log(chalk.cyan.bold(`
╔══════════════════════════════════════╗
║       AA MD BOT  v${config.version}           ║
║   Developer: Ahsan Ali Wadani       ║
║        Brand: AA Mods               ║
║   Multi-Device WhatsApp Bot         ║
╚══════════════════════════════════════╝`));
}

async function startServer() {
  const port = parseInt(process.env.PORT || '5000', 10);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost`);

    // ── Full CORS — required for Vercel / external frontends ──
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // ── Bare /api → health (for deployment healthcheck) ────
    if (url.pathname === '/api' || url.pathname === '/api/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok', bot: config.botName, version: config.version,
        uptime: formatDuration(Date.now() - startTime),
        sessions: getAllSessions().length, plugins: plugins.size,
      }));
      return;
    }

    const p = stripApi(url.pathname);

    // ── Dashboard HTML ─────────────────────────────────────
    if (p === '/' || p === '' || p === '/dashboard') {
      try {
        const html = await fs.readFile(dashboardPath, 'utf8');
        const acceptEncoding = req.headers['accept-encoding'] || '';
        const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'Vary': 'Accept-Encoding' };
        if (acceptEncoding.includes('gzip')) {
          const compressed = await new Promise((resolve, reject) => zlib.gzip(Buffer.from(html), (e, b) => e ? reject(e) : resolve(b)));
          res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip' });
          res.end(compressed);
        } else {
          res.writeHead(200, headers);
          res.end(html);
        }
      } catch {
        res.writeHead(500); res.end('Dashboard file missing');
      }
      return;
    }

    // ── SSE ────────────────────────────────────────────────
    if (p === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write('retry: 3000\n\n');
      sseClients.add(res);

      // Send current QR immediately if available
      for (const [sessionId, qr] of sessionQRs) {
        res.write(`event: qr\ndata: ${JSON.stringify({ sessionId, qr })}\n\n`);
      }
      // Send current session statuses
      for (const [sessionId, status] of sessionStatus) {
        res.write(`event: status\ndata: ${JSON.stringify({ sessionId, status })}\n\n`);
      }
      // Send any cached pairing codes
      for (const [sessionId, code] of latestPairingCodes) {
        res.write(`event: pairingCode\ndata: ${JSON.stringify({ sessionId, code })}\n\n`);
      }

      const keepAlive = setInterval(() => {
        try { res.write(':ping\n\n'); } catch { clearInterval(keepAlive); }
      }, 20000);

      req.on('close', () => { sseClients.delete(res); clearInterval(keepAlive); });
      return;
    }

    // ── QR Image ───────────────────────────────────────────
    if (p === '/qr-image') {
      const sessionId = url.searchParams.get('session') || 'default';
      const qr = sessionQRs.get(sessionId);
      if (!qr) { res.writeHead(404); res.end('No QR'); return; }
      try {
        const png = await QRCode.toBuffer(qr, { width: 280, margin: 2, color: { dark: '#000', light: '#fff' } });
        res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' });
        res.end(png);
      } catch { res.writeHead(500); res.end('QR error'); }
      return;
    }

    // ── Health ─────────────────────────────────────────────
    if (p === '/healthz' || p === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok', bot: config.botName, version: config.version,
        uptime: formatDuration(Date.now() - startTime),
        sessions: getAllSessions().length, plugins: plugins.size,
      }));
      return;
    }

    // ── Stats ──────────────────────────────────────────────
    if (p === '/stats') {
      const cats = getCategories();
      const sessList = getAllSessions();
      const catCounts = {};
      for (const [cat, cmds] of Object.entries(cats)) catCounts[cat] = cmds.length;
      // Strip phone/jid from session data before sending to dashboard
      const safeSessions = sessList.map(s => ({
        id: s.id,
        name: s.name || null,
        status: s.status,
        connectedAt: s.connectedAt || null,
      }));
      const ramMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        uptime: formatDuration(Date.now() - startTime),
        plugins: plugins.size,
        users: Object.keys(db.users.all()).length,
        groups: Object.keys(db.groups.all()).length,
        sessions: safeSessions,
        connectedSessions: safeSessions.filter(s => s.status === 'connected').length,
        categories: catCounts,
        ram: ramMB,
      }));
      return;
    }

    // ── Status — for external frontends (Vercel etc) ──────
    if (p === '/status') {
      const connected = getAllSessions().filter(s => s.status === 'connected').length;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'online',
        bot: config.botName,
        version: config.version,
        sessions: connected,
        maxSessions: null,
        uptime: formatDuration(Date.now() - startTime),
      }));
      return;
    }

    // ── Latest pairing code per session (for polling) ─────
    if (p === '/pairing-code') {
      const sid = url.searchParams.get('session') || 'default';
      const code = latestPairingCodes.get(sid);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: code || null }));
      return;
    }

    // ── Create Session ─────────────────────────────────────
    if (p === '/session/create' && req.method === 'POST') {
      let body = '';
      req.on('data', d => body += d);
      req.on('end', async () => {
        try {
          const { sessionId = 'default', method = 'qr', phoneNumber } = JSON.parse(body || '{}');
          const cleanId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30) || 'default';

          if (method === 'pairing' && !phoneNumber) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Phone number required' }));
            return;
          }

          // If session already exists and connected, return early; otherwise close it
          if (sessions.has(cleanId)) {
            const sock = sessions.get(cleanId);
            if (sock.ws?.readyState === 1) {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ ok: true, sessionId: cleanId, info: 'Already connected' }));
              return;
            }
            // Close stale session cleanly before recreating
            sessions.delete(cleanId);
            try { sock.end(new Error('restart')); } catch {}
          }

          latestPairingCodes.delete(cleanId);
          await createSession(cleanId, method === 'pairing', phoneNumber);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, sessionId: cleanId, method }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });
      return;
    }

    // ── Delete Session ─────────────────────────────────────
    const delMatch = p.match(/^\/session\/([^/]+)$/);
    if (delMatch && req.method === 'DELETE') {
      try {
        await deleteSession(delMatch[1]);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
      return;
    }

    // ── Static images ──────────────────────────────────────
    const STATIC_IMAGES = {
      '/banner.webp': 'image/webp',
      '/logo.webp': 'image/webp',
      '/favicon.webp': 'image/webp',
      '/banner.jpeg': 'image/jpeg',
      '/logo.jpeg': 'image/jpeg',
      '/favicon.svg': 'image/svg+xml',
    };
    if (STATIC_IMAGES[p]) {
      const imgPath = path.join(__dirname, p.slice(1));
      try {
        const data = await fs.readFile(imgPath);
        res.writeHead(200, { 'Content-Type': STATIC_IMAGES[p], 'Cache-Control': 'public, max-age=31536000, immutable', 'Vary': 'Accept' });
        res.end(data);
      } catch { res.writeHead(404); res.end('Not found'); }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error({ port }, `❌ Port ${port} already in use — another bot instance is running. Exiting so workflow can restart cleanly.`);
      process.exit(1);
    }
    throw err;
  });

  server.listen(port, '0.0.0.0', () => {
    logger.info({ port }, '🌐 Dashboard server listening');
    console.log(chalk.green(`\n🌐 Dashboard: http://localhost:${port}/\n`));
  });

  return server;
}

setMessageHandler(handleMessage);
setConnectionHandler((sessionId, sock) => {
  console.log(chalk.green(`✅ Session [${sessionId}] connected as ${sock.user?.name || sock.user?.id}`));
});

async function main() {
  printBanner();
  logger.info('🚀 Starting AA MD Bot...');

  // Ensure directories
  // Only temp/ is needed — everything else now lives in Firebase
  fs.ensureDirSync(path.join(__dirname, 'temp'));

  // Load database from Firebase before anything reads from db
  await initDatabase();

  // Restore newsletter JID — db first (set via .setnewsletter), then config fallback
  try {
    const savedJid  = db.settings.getValue('newsletterJid') || config.newsletterJid;
    const savedName = db.settings.getValue('newsletterName') || config.newsletterName || 'AA MD Bot';
    if (savedJid) {
      global._AA_NEWSLETTER_JID  = savedJid;
      global._AA_NEWSLETTER_NAME = savedName;
      if (!db.settings.getValue('newsletterJid')) {
        db.settings.setValue('newsletterJid', savedJid);
        db.settings.setValue('newsletterName', savedName);
      }
      logger.info({ jid: savedJid }, '📢 Newsletter JID restored from db');
    }
  } catch {}

  await startServer();

  logger.info('📦 Loading plugins...');
  const count = await loadAllPlugins();
  const cats = getCategories();
  const catList = Object.entries(cats).map(([k, v]) => `${k}(${v.length})`).join(', ');
  console.log(chalk.blue(`📦 Loaded ${count} plugins: ${catList}`));

  logger.info('📡 Initializing WhatsApp sessions...');
  await initAllSessions();

  // ── Telegram bots ─────────────────────────────────────────────────────────
  try {
    initTelegramAdmin({
      createSession,
      deleteSession,
      getAllSessions: () => getAllSessions(),
      latestPairingCodes,
      botEvents,
    });
  } catch (e) {
    logger.warn({ err: e.message }, '📱 Telegram admin bot failed to start');
  }
  try {
    initTelegramFeatures();
  } catch (e) {
    logger.warn({ err: e.message }, '🤖 Telegram features bot failed to start');
  }

  setInterval(cleanTemp, 30 * 60 * 1000);

  console.log(chalk.cyan.bold('\n✨ AA MD Bot is ready!\n'));
}

main().catch(err => {
  logger.error({ err: err.message }, '💥 Fatal startup error');
  process.exit(1);
});
