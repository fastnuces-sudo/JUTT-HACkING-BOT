// Ensure common binary locations are in PATH (works on Replit, Railway, VPS, etc.)
const extraPaths = ['/home/runner/.local/bin', '/usr/local/bin', '/usr/bin'];
for (const p of extraPaths) {
  if (!process.env.PATH?.includes(p)) process.env.PATH = `${p}:${process.env.PATH || ''}`;
}

import http from 'http';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import QRCode from 'qrcode';
import { logger } from './lib/logger.js';
import { db } from './lib/database.js';
import { loadAllPlugins, getCategories, plugins } from './lib/pluginLoader.js';
import { handleMessage } from './lib/commandHandler.js';
import {
  initAllSessions, setMessageHandler, setConnectionHandler,
  getAllSessions, sessions, botEvents, sessionQRs, sessionStatus,
  createSession, deleteSession,
} from './lib/sessionManager.js';
import config from './config.js';
import { cleanTemp, formatDuration } from './lib/helper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const startTime = Date.now();
const dashboardPath = path.join(__dirname, 'dashboard.html');

process.on('uncaughtException', err => logger.error({ err: err.message }, '💥 Uncaught Exception'));
process.on('unhandledRejection', err => logger.error({ err: String(err) }, '💥 Unhandled Rejection'));

// Restore newsletter JID from db (persisted by .setnewsletter)
try {
  const savedJid  = db.settings.getValue('newsletterJid');
  const savedName = db.settings.getValue('newsletterName');
  if (savedJid) {
    global._AA_NEWSLETTER_JID  = savedJid;
    global._AA_NEWSLETTER_NAME = savedName || 'AA MD Bot';
    logger.info({ jid: savedJid }, '📢 Newsletter JID restored from db');
  }
} catch {}

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

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');

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
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end(html);
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
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        uptime: formatDuration(Date.now() - startTime),
        plugins: plugins.size,
        users: Object.keys(db.users.all()).length,
        groups: Object.keys(db.groups.all()).length,
        sessions: sessList,
        connectedSessions: sessList.filter(s => s.status === 'connected').length,
        categories: catCounts,
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
    if (p === '/banner.jpeg' || p === '/logo.jpeg' || p === '/favicon.svg') {
      const imgPath = path.join(__dirname, p.slice(1));
      try {
        const data = await fs.readFile(imgPath);
        const mime = p.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg';
        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=3600' });
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
  for (const d of ['logs', 'temp', 'media', 'session', 'database']) {
    fs.ensureDirSync(path.join(__dirname, d));
  }

  await startServer();

  logger.info('📦 Loading plugins...');
  const count = await loadAllPlugins();
  const cats = getCategories();
  const catList = Object.entries(cats).map(([k, v]) => `${k}(${v.length})`).join(', ');
  console.log(chalk.blue(`📦 Loaded ${count} plugins: ${catList}`));

  logger.info('📡 Initializing WhatsApp sessions...');
  await initAllSessions();

  setInterval(cleanTemp, 30 * 60 * 1000);

  console.log(chalk.cyan.bold('\n✨ AA MD Bot is ready!\n'));
}

main().catch(err => {
  logger.error({ err: err.message }, '💥 Fatal startup error');
  process.exit(1);
});
