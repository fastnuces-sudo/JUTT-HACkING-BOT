// Load .env before modules such as config.js and logger.js read process.env.
// Existing shell/PM2 variables still take precedence (dotenv override defaults false).
import 'dotenv/config';

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
import { createDashboardAuth, isOriginAllowed, sendUnauthorized } from './lib/dashboardAuth.js';
import { loadAllPlugins, getCategories, plugins } from './lib/pluginLoader.js';
import { handleMessage } from './lib/commandHandler.js';
import {
  initAllSessions, setMessageHandler, setConnectionHandler, sessions,
  getAllSessions, botEvents, sessionQRs, sessionStatus,
  createSession, deleteSession,
} from './lib/sessionManager.js';
import { deletePgAuthState } from './lib/pgAuthState.js';
import config from './config.js';
import { cleanTemp, formatDuration } from './lib/helper.js';
import { startBirthdayScheduler } from './plugins/utility/birthday.js';
import { initTelegramAdmin }    from './lib/telegramAdmin.js';
import { initTelegramFeatures } from './lib/telegramFeatures.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const startTime = Date.now();
const dashboardPath = path.join(__dirname, 'functional-dashboard.html');

// Flush pending Postgres writes before crashing so no settings are lost.
// flushAll is imported lazily to avoid circular import at module init time.
let fatalShutdownStarted = false;
async function emergencyFlush(label, error) {
  logger.fatal({ err: String(error?.stack || error?.message || error) }, label);
  if (fatalShutdownStarted) return;
  fatalShutdownStarted = true;
  try {
    const { flushAll } = await import('./lib/database.js');
    await Promise.race([
      flushAll(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Emergency flush timed out')), 10_000)),
    ]);
  } catch (flushError) {
    logger.error({ err: flushError.message }, 'Emergency database flush failed');
  } finally {
    // Continuing after an uncaught exception leaves Node in an undefined state.
    // Exit so PM2/systemd can restart a clean process.
    process.exit(1);
  }
}
process.on('uncaughtException', error => { void emergencyFlush('Uncaught exception', error); });
process.on('unhandledRejection', error => { void emergencyFlush('Unhandled rejection', error); });

// Dashboard authentication is opt-in for local development and automatically
// enabled by deploy/setup.sh in production.
const dashboardAuth = createDashboardAuth(process.env.DASHBOARD_TOKEN);
const allowedDashboardOrigins = process.env.DASHBOARD_ALLOWED_ORIGINS || '';

// SSE clients and short-lived pairing-code cache.
const sseClients = new Set();
const latestPairingCodes = new Map(); // sessionId → code
const pairingCodeTimers = new Map();
const PAIRING_CODE_TTL_MS = 2 * 60 * 1000;

function clearPairingCode(sessionId) {
  latestPairingCodes.delete(sessionId);
  const timer = pairingCodeTimers.get(sessionId);
  if (timer) clearTimeout(timer);
  pairingCodeTimers.delete(sessionId);
}

function cachePairingCode(sessionId, code) {
  clearPairingCode(sessionId);
  latestPairingCodes.set(sessionId, code);
  const timer = setTimeout(() => clearPairingCode(sessionId), PAIRING_CODE_TTL_MS);
  timer.unref();
  pairingCodeTimers.set(sessionId, timer);
}

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch { sseClients.delete(res); }
  }
}

botEvents.on('qr', d => broadcast('qr', d));
botEvents.on('status', d => {
  if (['connected', 'deleted', 'logged_out'].includes(d.status)) clearPairingCode(d.sessionId);
  broadcast('status', { sessionId: d.sessionId, status: d.status });
});
botEvents.on('pairingCode', d => {
  cachePairingCode(d.sessionId, d.code);
  broadcast('pairingCode', { sessionId: d.sessionId, code: d.code });
});
botEvents.on('pairingCodeError', d => broadcast('pairingCodeError', d));

// Helper: strip /api prefix and trailing slashes
function stripApi(p) {
  let cleaned = p.replace(/^\/api(?:\/|$)/, '/');
  if (cleaned.length > 1 && cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }
  return cleaned || '/';
}

function printBanner() {
  console.log(chalk.cyan.bold(`
╔══════════════════════════════════════╗
║       JUTTS BOT  v${config.version}           ║
║   Developer: Sajid Jutt              ║
║        Brand: Jutts Mods             ║
║   Multi-Device WhatsApp Bot         ║
╚══════════════════════════════════════╝`));
}

async function startServer() {
  const rawPort = process.env.PORT || '5000';
  const port = Number.parseInt(rawPort, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }
  const host = process.env.HOST?.trim() || '0.0.0.0';

  const json = (res, status, value, extraHeaders = {}) => {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    });
    res.end(JSON.stringify(value));
  };

  const readJsonBody = (req, maxBytes = 16 * 1024) => new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let tooLarge = false;
    req.setEncoding('utf8');
    req.on('data', chunk => {
      size += Buffer.byteLength(chunk);
      if (size > maxBytes) {
        tooLarge = true;
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (tooLarge) {
        const error = new Error('Request body is too large');
        error.statusCode = 413;
        reject(error);
        return;
      }
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        const error = new Error('Request body must contain valid JSON');
        error.statusCode = 400;
        reject(error);
      }
    });
    req.on('error', reject);
  });

  const healthPayload = () => ({
    status: 'ok',
    bot: config.botName,
    version: config.version,
    uptime: formatDuration(Date.now() - startTime),
    sessions: getAllSessions().length,
    plugins: plugins.size,
  });

  const handleRequest = async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const p = stripApi(url.pathname);
    const method = req.method || 'GET';

    // Baseline response hardening. frame-ancestors is intentionally not forced so
    // trusted deployment previews can still embed the dashboard.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; base-uri 'self'; form-action 'self'; " +
      "script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'"
    );

    const requestOriginAllowed = isOriginAllowed(req, allowedDashboardOrigins);
    const origin = req.headers.origin;
    if (origin && requestOriginAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Dashboard-Token');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (method === 'OPTIONS') {
      if (!requestOriginAllowed) return json(res, 403, { error: 'Origin is not allowed' });
      res.writeHead(204);
      res.end();
      return;
    }
    if (!requestOriginAllowed) return json(res, 403, { error: 'Origin is not allowed' });

    // Public, non-sensitive monitoring endpoints.
    if (url.pathname === '/api' || url.pathname === '/api/' || p === '/healthz' || p === '/health') {
      if (method !== 'GET' && method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' }, { Allow: 'GET, HEAD' });
      return json(res, 200, healthPayload());
    }
    if (p === '/status') {
      if (method !== 'GET') return json(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
      const connected = getAllSessions().filter(s => s.status === 'connected').length;
      return json(res, 200, {
        status: 'online',
        bot: config.botName,
        version: config.version,
        sessions: connected,
        uptime: formatDuration(Date.now() - startTime),
      });
    }

    // Public static brand assets.
    const STATIC_IMAGES = {
      '/banner.webp': 'image/webp',
      '/logo.webp': 'image/webp',
      '/favicon.webp': 'image/webp',
      '/banner.jpeg': 'image/jpeg',
      '/logo.jpeg': 'image/jpeg',
    };
    if (STATIC_IMAGES[p]) {
      if (method !== 'GET' && method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' }, { Allow: 'GET, HEAD' });
      const imgPath = path.join(__dirname, p.slice(1));
      try {
        const data = await fs.readFile(imgPath);
        res.writeHead(200, {
          'Content-Type': STATIC_IMAGES[p],
          'Cache-Control': 'public, max-age=31536000, immutable',
        });
        res.end(method === 'HEAD' ? undefined : data);
      } catch {
        json(res, 404, { error: 'Not found' });
      }
      return;
    }

    // Exchange a bearer token for a signed HttpOnly browser session. The login
    // page can read the initial token from a URL fragment, which is never sent to
    // Node/Nginx access logs.
    if (p === '/auth/login') {
      if (method !== 'POST') return json(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
      if (dashboardAuth.createLoginSession(req, res)) return;
      return sendUnauthorized(req, res);
    }
    if (!dashboardAuth.isAuthorized(req)) return sendUnauthorized(req, res);

    // Dashboard HTML.
    if (p === '/' || p === '/dashboard') {
      if (method !== 'GET' && method !== 'HEAD') return json(res, 405, { error: 'Method not allowed' }, { Allow: 'GET, HEAD' });
      try {
        const html = await fs.readFile(dashboardPath, 'utf8');
        const headers = {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          Vary: 'Accept-Encoding',
        };
        if (method === 'HEAD') {
          res.writeHead(200, headers);
          res.end();
        } else if (String(req.headers['accept-encoding'] || '').includes('gzip')) {
          const compressed = await new Promise((resolve, reject) =>
            zlib.gzip(Buffer.from(html), (error, value) => error ? reject(error) : resolve(value))
          );
          res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip' });
          res.end(compressed);
        } else {
          res.writeHead(200, headers);
          res.end(html);
        }
      } catch (error) {
        logger.error({ err: error.message }, 'Dashboard file read failed');
        json(res, 500, { error: 'Dashboard unavailable' });
      }
      return;
    }

    // Server-sent events.
    if (p === '/events') {
      if (method !== 'GET') return json(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.write('retry: 3000\n\n');
      sseClients.add(res);

      for (const [sessionId, qr] of sessionQRs) {
        res.write(`event: qr\ndata: ${JSON.stringify({ sessionId, qr })}\n\n`);
      }
      for (const [sessionId, status] of sessionStatus) {
        res.write(`event: status\ndata: ${JSON.stringify({ sessionId, status })}\n\n`);
      }
      for (const [sessionId, code] of latestPairingCodes) {
        res.write(`event: pairingCode\ndata: ${JSON.stringify({ sessionId, code })}\n\n`);
      }

      const keepAlive = setInterval(() => {
        try { res.write(':ping\n\n'); } catch { clearInterval(keepAlive); }
      }, 20_000);
      req.on('close', () => {
        sseClients.delete(res);
        clearInterval(keepAlive);
      });
      return;
    }

    if (p === '/qr-image') {
      if (method !== 'GET') return json(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
      const sessionId = url.searchParams.get('session') || 'default';
      if (!/^[a-zA-Z0-9_-]{1,30}$/.test(sessionId)) return json(res, 400, { error: 'Invalid session ID' });
      const qr = sessionQRs.get(sessionId);
      if (!qr) return json(res, 404, { error: 'No QR code is currently available' });
      try {
        const png = await QRCode.toBuffer(qr, {
          width: 280,
          margin: 2,
          color: { dark: '#000', light: '#fff' },
        });
        res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
        res.end(png);
      } catch (error) {
        logger.warn({ err: error.message, sessionId }, 'QR image generation failed');
        json(res, 500, { error: 'QR image generation failed' });
      }
      return;
    }

    if (p === '/stats') {
      if (method !== 'GET') return json(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
      const cats = getCategories();
      const sessList = getAllSessions();
      const catCounts = {};
      for (const [category, commands] of Object.entries(cats)) catCounts[category] = commands.length;
      const safeSessions = sessList.map(session => ({
        id: session.id,
        status: session.status,
        connectedAt: session.connectedAt || null,
      }));
      return json(res, 200, {
        uptime: formatDuration(Date.now() - startTime),
        plugins: plugins.size,
        groups: Object.keys(db.groups.all()).length,
        sessions: safeSessions,
        connectedSessions: safeSessions.filter(session => session.status === 'connected').length,
        categories: catCounts,
        ram: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      });
    }

    if (p === '/pairing-code') {
      if (method !== 'GET') return json(res, 405, { error: 'Method not allowed' }, { Allow: 'GET' });
      const sessionId = url.searchParams.get('session') || 'default';
      if (!/^[a-zA-Z0-9_-]{1,30}$/.test(sessionId)) return json(res, 400, { error: 'Invalid session ID' });
      return json(res, 200, { code: latestPairingCodes.get(sessionId) || null });
    }

    if (p === '/session/create') {
      if (method !== 'POST') return json(res, 405, { error: 'Method not allowed' }, { Allow: 'POST' });
      try {
        const body = await readJsonBody(req);
        const sessionId = String(body.sessionId || 'default').trim();
        const pairMethod = String(body.method || 'qr').toLowerCase();
        const phoneNumber = String(body.phoneNumber || '').replace(/\D/g, '');

        if (!/^[a-zA-Z0-9_-]{1,30}$/.test(sessionId)) {
          return json(res, 400, { error: 'Session ID may only contain letters, numbers, _ and - (maximum 30)' });
        }
        if (!['qr', 'pairing'].includes(pairMethod)) {
          return json(res, 400, { error: 'Method must be qr or pairing' });
        }
        if (pairMethod === 'pairing' && !/^\d{7,15}$/.test(phoneNumber)) {
          return json(res, 400, { error: 'Phone number must contain 7 to 15 digits including country code' });
        }

        if (sessions.has(sessionId)) {
          const sock = sessions.get(sessionId);
          if (sock.ws?.readyState === 1 && pairMethod !== 'pairing') {
            return json(res, 200, { ok: true, sessionId, info: 'Already connected' });
          }
          sessions.delete(sessionId);
          try { sock.end(new Error('restart')); } catch (error) {
            logger.debug({ err: error.message, sessionId }, 'Stale session close failed');
          }
        }

        if (pairMethod === 'pairing') {
          await deletePgAuthState(sessionId).catch(error =>
            logger.warn({ err: error.message, sessionId }, 'Old pairing auth cleanup failed')
          );
        }
        clearPairingCode(sessionId);
        await createSession(sessionId, pairMethod === 'pairing', phoneNumber || null);
        return json(res, 200, { ok: true, sessionId, method: pairMethod });
      } catch (error) {
        logger.warn({ err: error.message }, 'Session creation failed');
        return json(res, error.statusCode || 500, {
          ok: false,
          error: error.statusCode ? error.message : 'Session creation failed',
        });
      }
    }

    const deleteMatch = p.match(/^\/session\/([a-zA-Z0-9_-]{1,30})$/);
    if (deleteMatch) {
      if (method !== 'DELETE') return json(res, 405, { error: 'Method not allowed' }, { Allow: 'DELETE' });
      try {
        await deleteSession(deleteMatch[1]);
        clearPairingCode(deleteMatch[1]);
        return json(res, 200, { ok: true });
      } catch (error) {
        logger.warn({ err: error.message, sessionId: deleteMatch[1] }, 'Session deletion failed');
        return json(res, 500, { ok: false, error: 'Session deletion failed' });
      }
    }

    return json(res, 404, { error: 'Not found' });
  };

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch(error => {
      logger.error({ err: error.message }, 'Unhandled dashboard request error');
      if (!res.headersSent) json(res, 500, { error: 'Internal server error' });
      else res.end();
    });
  });

  server.requestTimeout = 30_000;
  server.headersTimeout = 35_000;
  server.keepAliveTimeout = 5_000;
  server.on('error', error => {
    if (error.code === 'EADDRINUSE') {
      logger.error({ port }, `Port ${port} is already in use`);
      setImmediate(() => process.exit(1));
      return;
    }
    logger.error({ err: error.message }, 'Dashboard server error');
    setImmediate(() => process.exit(1));
  });

  server.listen(port, host, () => {
    logger.info({ host, port, authenticated: dashboardAuth.enabled }, 'Dashboard server listening');
    if (dashboardAuth.enabled) {
      console.log(chalk.green(`\n🌐 Dashboard: http://localhost:${port}/ (authentication enabled)\n`));
    } else {
      logger.warn('DASHBOARD_TOKEN is not set — dashboard controls are unauthenticated');
      console.log(chalk.yellow(`\n🌐 Dashboard: http://localhost:${port}/ (no DASHBOARD_TOKEN)\n`));
    }
  });

  return server;
}

setMessageHandler(handleMessage);
setConnectionHandler((sessionId, sock) => {
  console.log(chalk.green(`✅ Session [${sessionId}] connected as ${sock.user?.name || sock.user?.id}`));
});

async function main() {
  printBanner();
  logger.info('🚀 Starting Jutts Bot...');

  // Ensure all required directories exist (created on every startup — safe to repeat)
  for (const dir of ['temp', 'logs', 'session', 'downloads', 'database', 'cache']) {
    fs.ensureDirSync(path.join(__dirname, dir));
  }

  // Load persistent database state before anything reads from db
  await initDatabase();

  // Restore newsletter JID — db first (set via .setnewsletter), then config fallback
  try {
    const savedJid  = db.settings.getValue('newsletterJid') || config.newsletterJid;
    const savedName = db.settings.getValue('newsletterName') || config.newsletterName || 'Jutts Bot';
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

  const skipWhatsApp = /^(1|true|yes)$/i.test(process.env.SKIP_WHATSAPP_INIT || '');
  if (skipWhatsApp) {
    logger.warn('SKIP_WHATSAPP_INIT is enabled — WhatsApp sessions were not started');
  } else {
    logger.info('📡 Initializing WhatsApp sessions...');
    await initAllSessions();

    // Birthday scheduler — runs at midnight every day.
    startBirthdayScheduler(() => sessions);
  }

  // ── Fake Last Seen scheduler — checks every minute ────────────────────────
  // For each session that has fake_lastseen_active=true, fires sendPresenceUpdate('unavailable')
  // at the exact HH:MM the user configured, so WA records that moment as last seen.
  setInterval(() => {
    const now   = new Date();
    const hh    = String(now.getHours()).padStart(2, '0');
    const mm    = String(now.getMinutes()).padStart(2, '0');
    const curHHMM = `${hh}:${mm}`;

    for (const [sessionId, sock] of sessions.entries()) {
      try {
        const active = db.sessionSettings.getValue(sessionId, 'fake_lastseen_active');
        if (!active) continue;
        const target = db.sessionSettings.getValue(sessionId, 'fake_lastseen_time');
        if (!target || target !== curHHMM) continue;
        // Exact minute match — fire unavailable
        sock.sendPresenceUpdate('unavailable').catch(() => {});
        logger.info({ sessionId, time: curHHMM }, '🕐 Fake last seen fired');
      } catch {}
    }
  }, 60_000);

  // ── Telegram bots ─────────────────────────────────────────────────────────
  try {
    initTelegramAdmin({
      createSession,
      deleteSession,
      getAllSessions: () => getAllSessions(),
      latestPairingCodes,
      botEvents,
      // Deliver the admin announcement to each connected bot account's own chat.
      // This is intentionally not a mass-message to every contact/group.
      broadcastToSessions: async text => {
        let sent = 0;
        let failed = 0;
        for (const sock of sessions.values()) {
          const ownJid = String(sock.user?.id || '').replace(/:.*@/, '@');
          if (!ownJid) { failed++; continue; }
          try {
            await sock.sendMessage(ownJid, { text: `📢 *Admin Broadcast*\n\n${text}` });
            sent++;
          } catch {
            failed++;
          }
        }
        return { sent, failed };
      },
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

  console.log(chalk.cyan.bold('\n✨ Jutts Bot is ready!\n'));
}

main().catch(err => {
  logger.error({ err: err.message }, '💥 Fatal startup error');
  process.exit(1);
});
