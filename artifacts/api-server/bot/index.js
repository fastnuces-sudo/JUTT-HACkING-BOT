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

process.on('uncaughtException', (err) => logger.error({ err }, '💥 Uncaught Exception'));
process.on('unhandledRejection', (err) => logger.error({ err }, '💥 Unhandled Rejection'));

function printBanner() {
  console.log(chalk.cyan.bold(`
╔══════════════════════════════════════════╗
║          AA MD BOT  v${config.version}            ║
║     Developer: Ahsan Ali Wadani         ║
║          Brand: AA Mods                 ║
║      Multi-Device WhatsApp Bot          ║
╚══════════════════════════════════════════╝`));
}

// SSE clients list
const sseClients = new Set();

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch {}
  }
}

// Forward bot events to SSE clients
botEvents.on('qr', ({ sessionId, qr }) => broadcast('qr', { sessionId, qr }));
botEvents.on('status', (data) => broadcast('status', data));
botEvents.on('pairingCode', (data) => broadcast('pairingCode', data));
botEvents.on('pairingCodeError', (data) => broadcast('pairingCodeError', data));

function getDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AA MD Bot — Dashboard</title>
<style>
  :root {
    --bg: #0a0e17;
    --card: #111827;
    --card2: #1a2235;
    --border: #1e2d45;
    --green: #10b981;
    --blue: #3b82f6;
    --yellow: #f59e0b;
    --red: #ef4444;
    --purple: #8b5cf6;
    --text: #e2e8f0;
    --muted: #64748b;
    --accent: #06b6d4;
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:var(--bg); color:var(--text); font-family:'Segoe UI',system-ui,sans-serif; min-height:100vh; }
  
  /* Header */
  .header {
    background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
    border-bottom: 1px solid var(--border);
    padding: 16px 24px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .logo { display:flex; align-items:center; gap:12px; }
  .logo-icon { width:42px; height:42px; background:linear-gradient(135deg,var(--blue),var(--purple)); border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:20px; }
  .logo-text h1 { font-size:18px; font-weight:700; color:var(--text); }
  .logo-text p { font-size:12px; color:var(--muted); }
  .status-badge { display:flex; align-items:center; gap:6px; padding:6px 14px; border-radius:20px; font-size:13px; font-weight:600; }
  .status-badge.online { background:rgba(16,185,129,0.15); color:var(--green); border:1px solid rgba(16,185,129,0.3); }
  .pulse { width:8px; height:8px; border-radius:50%; background:var(--green); animation:pulse 2s infinite; }
  @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }

  /* Layout */
  .container { max-width:1200px; margin:0 auto; padding:24px; }
  .grid-3 { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:16px; margin-bottom:24px; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-bottom:24px; }
  @media(max-width:768px) { .grid-2 { grid-template-columns:1fr; } }

  /* Stat cards */
  .stat-card { background:var(--card); border:1px solid var(--border); border-radius:14px; padding:20px; }
  .stat-card .icon { font-size:28px; margin-bottom:10px; }
  .stat-card .value { font-size:28px; font-weight:700; }
  .stat-card .label { font-size:12px; color:var(--muted); margin-top:4px; text-transform:uppercase; letter-spacing:.5px; }
  .stat-card.blue { border-left:3px solid var(--blue); }
  .stat-card.green { border-left:3px solid var(--green); }
  .stat-card.purple { border-left:3px solid var(--purple); }
  .stat-card.yellow { border-left:3px solid var(--yellow); }

  /* Card */
  .card { background:var(--card); border:1px solid var(--border); border-radius:16px; padding:24px; }
  .card-title { font-size:16px; font-weight:700; margin-bottom:20px; display:flex; align-items:center; gap:8px; color:var(--text); }
  .card-title span { font-size:20px; }

  /* Session cards */
  .sessions-list { display:flex; flex-direction:column; gap:12px; }
  .session-card { background:var(--card2); border:1px solid var(--border); border-radius:12px; padding:16px; display:flex; align-items:center; gap:14px; transition:.2s; }
  .session-card:hover { border-color:var(--blue); }
  .session-avatar { width:44px; height:44px; border-radius:50%; background:linear-gradient(135deg,var(--blue),var(--purple)); display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0; }
  .session-info { flex:1; min-width:0; }
  .session-name { font-weight:600; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .session-jid { font-size:12px; color:var(--muted); margin-top:2px; }
  .session-status { display:flex; align-items:center; gap:5px; font-size:12px; margin-top:4px; font-weight:500; }
  .dot { width:7px; height:7px; border-radius:50%; }
  .dot.green { background:var(--green); }
  .dot.yellow { background:var(--yellow); animation:pulse 1.5s infinite; }
  .dot.red { background:var(--red); }
  .dot.blue { background:var(--blue); animation:pulse 1.5s infinite; }
  .btn-delete { background:rgba(239,68,68,.1); color:var(--red); border:1px solid rgba(239,68,68,.3); border-radius:8px; padding:6px 12px; font-size:12px; cursor:pointer; font-weight:600; transition:.2s; flex-shrink:0; }
  .btn-delete:hover { background:rgba(239,68,68,.25); }
  .no-sessions { text-align:center; color:var(--muted); padding:32px; font-size:14px; }

  /* Connect area */
  .tab-bar { display:flex; gap:4px; background:var(--card2); border-radius:10px; padding:4px; margin-bottom:20px; }
  .tab { flex:1; padding:10px; text-align:center; border-radius:7px; cursor:pointer; font-size:14px; font-weight:600; transition:.2s; color:var(--muted); border:none; background:none; }
  .tab.active { background:var(--blue); color:white; }
  .tab-content { display:none; }
  .tab-content.active { display:block; }

  /* QR area */
  .qr-wrapper { display:flex; flex-direction:column; align-items:center; gap:16px; }
  .qr-box { width:220px; height:220px; background:#fff; border-radius:16px; display:flex; align-items:center; justify-content:center; padding:10px; position:relative; overflow:hidden; }
  .qr-box canvas, .qr-box img { width:100%; height:100%; border-radius:8px; }
  .qr-placeholder { text-align:center; color:#999; padding:20px; }
  .qr-placeholder .qr-icon { font-size:48px; margin-bottom:8px; }
  .qr-placeholder p { font-size:12px; line-height:1.5; }
  .qr-info { text-align:center; font-size:13px; color:var(--muted); line-height:1.6; }
  .qr-info strong { color:var(--text); }

  /* Pairing code */
  .pairing-form { display:flex; flex-direction:column; gap:14px; }
  .form-group label { font-size:13px; color:var(--muted); font-weight:600; display:block; margin-bottom:6px; }
  .form-group input, .form-group select { width:100%; background:var(--card2); border:1px solid var(--border); color:var(--text); padding:11px 14px; border-radius:10px; font-size:14px; outline:none; transition:.2s; }
  .form-group input:focus, .form-group select:focus { border-color:var(--blue); }
  .btn { width:100%; padding:12px; border-radius:10px; font-size:14px; font-weight:700; cursor:pointer; border:none; transition:.2s; }
  .btn-blue { background:var(--blue); color:#fff; }
  .btn-blue:hover { background:#2563eb; }
  .btn-green { background:var(--green); color:#fff; }
  .btn-green:hover { background:#059669; }
  .btn:disabled { opacity:.5; cursor:not-allowed; }
  .code-display { background:var(--card2); border:2px solid var(--green); border-radius:12px; padding:20px; text-align:center; }
  .code-display .code { font-size:32px; font-weight:900; letter-spacing:8px; color:var(--green); font-family:monospace; }
  .code-display p { font-size:12px; color:var(--muted); margin-top:8px; }
  .session-input { display:flex; flex-direction:column; gap:14px; margin-top:16px; padding-top:16px; border-top:1px solid var(--border); }
  .hint { font-size:12px; color:var(--muted); background:var(--card2); border-radius:8px; padding:10px; line-height:1.5; }
  .hint strong { color:var(--yellow); }

  /* Loading spinner */
  .spinner { width:24px; height:24px; border:3px solid var(--border); border-top-color:var(--blue); border-radius:50%; animation:spin .8s linear infinite; margin:0 auto; }
  @keyframes spin { to{transform:rotate(360deg)} }

  /* Alerts */
  .alert { padding:12px 16px; border-radius:10px; font-size:13px; font-weight:500; margin-bottom:14px; display:none; }
  .alert.show { display:block; }
  .alert.success { background:rgba(16,185,129,.1); border:1px solid rgba(16,185,129,.3); color:var(--green); }
  .alert.error { background:rgba(239,68,68,.1); border:1px solid rgba(239,68,68,.3); color:var(--red); }
  .alert.info { background:rgba(59,130,246,.1); border:1px solid rgba(59,130,246,.3); color:var(--blue); }

  /* Categories */
  .cat-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); gap:10px; }
  .cat-item { background:var(--card2); border:1px solid var(--border); border-radius:10px; padding:12px; text-align:center; }
  .cat-item .cat-name { font-size:12px; font-weight:600; color:var(--text); text-transform:capitalize; }
  .cat-item .cat-count { font-size:22px; font-weight:700; color:var(--blue); }

  footer { text-align:center; padding:24px; color:var(--muted); font-size:12px; border-top:1px solid var(--border); margin-top:16px; }
</style>
</head>
<body>
<div class="header">
  <div class="logo">
    <div class="logo-icon">🤖</div>
    <div class="logo-text">
      <h1>AA MD Bot</h1>
      <p>by Ahsan Ali Wadani · AA Mods</p>
    </div>
  </div>
  <div class="status-badge online">
    <div class="pulse"></div>
    <span id="headerStatus">Online</span>
  </div>
</div>

<div class="container">

  <!-- Stats -->
  <div class="grid-3" id="statsGrid">
    <div class="stat-card blue">
      <div class="icon">📱</div>
      <div class="value" id="statSessions">—</div>
      <div class="label">Connected Sessions</div>
    </div>
    <div class="stat-card green">
      <div class="icon">🔌</div>
      <div class="value" id="statPlugins">—</div>
      <div class="label">Loaded Plugins</div>
    </div>
    <div class="stat-card purple">
      <div class="icon">👤</div>
      <div class="value" id="statUsers">—</div>
      <div class="label">Total Users</div>
    </div>
    <div class="stat-card yellow">
      <div class="icon">⏱️</div>
      <div class="value" id="statUptime">—</div>
      <div class="label">Bot Uptime</div>
    </div>
  </div>

  <div class="grid-2">
    <!-- Sessions -->
    <div class="card">
      <div class="card-title"><span>📱</span> WhatsApp Sessions</div>
      <div class="sessions-list" id="sessionsList">
        <div class="no-sessions"><div class="spinner"></div><br>Loading sessions...</div>
      </div>
    </div>

    <!-- Connect -->
    <div class="card">
      <div class="card-title"><span>🔗</span> Connect WhatsApp</div>

      <div class="alert" id="connectAlert"></div>

      <!-- Session name input -->
      <div class="session-input" style="margin-top:0;padding-top:0;border-top:none;margin-bottom:16px;">
        <div class="form-group">
          <label>📛 Session Name</label>
          <input type="text" id="sessionName" placeholder="e.g. main, device2, work" value="default">
        </div>
      </div>

      <!-- Tabs -->
      <div class="tab-bar">
        <button class="tab active" onclick="switchTab('qr')">📷 QR Code</button>
        <button class="tab" onclick="switchTab('pairing')">🔢 Pairing Code</button>
      </div>

      <!-- QR Tab -->
      <div class="tab-content active" id="tab-qr">
        <div class="qr-wrapper">
          <div class="qr-box" id="qrBox">
            <div class="qr-placeholder">
              <div class="qr-icon">📱</div>
              <p>Click <strong>Generate QR</strong><br>to get started</p>
            </div>
          </div>
          <div class="qr-info" id="qrInfo">
            Scan with WhatsApp to connect
          </div>
          <button class="btn btn-blue" id="btnQR" onclick="requestQR()">📷 Generate QR Code</button>
        </div>
        <div class="hint" style="margin-top:16px;">
          <strong>How to scan:</strong> Open WhatsApp → ⋮ Menu → Linked Devices → Link a Device → Scan QR
        </div>
      </div>

      <!-- Pairing Tab -->
      <div class="tab-content" id="tab-pairing">
        <div class="pairing-form">
          <div class="form-group">
            <label>📞 Phone Number (with country code)</label>
            <input type="tel" id="pairingPhone" placeholder="923001234567 (no + or spaces)">
          </div>
          <button class="btn btn-green" id="btnPairing" onclick="requestPairing()">🔢 Get Pairing Code</button>
          <div id="codeDisplay" style="display:none" class="code-display">
            <div class="code" id="pairingCode">——</div>
            <p>Enter this code in WhatsApp → Linked Devices → Link with phone number</p>
          </div>
        </div>
        <div class="hint" style="margin-top:16px;">
          <strong>How to use:</strong> WhatsApp → ⋮ Menu → Linked Devices → Link a Device → Link with phone number
        </div>
      </div>
    </div>
  </div>

  <!-- Plugin categories -->
  <div class="card">
    <div class="card-title"><span>🔌</span> Plugin Categories</div>
    <div class="cat-grid" id="catGrid">
      <div style="color:var(--muted);font-size:13px;grid-column:1/-1">Loading...</div>
    </div>
  </div>

</div>

<footer>
  AA MD Bot v3.0.0 · Developer: Ahsan Ali Wadani · AA Mods · Powered by Baileys
</footer>

<script>
let evtSource = null;
let currentQRSession = null;

// SSE connection
function connectSSE() {
  evtSource = new EventSource('/api/events');
  
  evtSource.addEventListener('qr', async (e) => {
    const { sessionId, qr } = JSON.parse(e.data);
    currentQRSession = sessionId;
    await renderQR(qr, sessionId);
  });

  evtSource.addEventListener('status', (e) => {
    const data = JSON.parse(e.data);
    if (data.status === 'connected') {
      showAlert('success', '✅ WhatsApp connected! ' + (data.user?.name || ''));
      document.getElementById('qrBox').innerHTML = '<div class="qr-placeholder"><div class="qr-icon">✅</div><p><strong>Connected!</strong></p></div>';
      document.getElementById('qrInfo').textContent = 'Successfully connected to WhatsApp!';
      document.getElementById('codeDisplay').style.display = 'none';
    }
    if (data.status === 'reconnecting') {
      showAlert('info', '🔄 Reconnecting...');
    }
    loadData();
  });

  evtSource.addEventListener('pairingCode', (e) => {
    const { code, sessionId } = JSON.parse(e.data);
    document.getElementById('pairingCode').textContent = code;
    document.getElementById('codeDisplay').style.display = 'block';
    document.getElementById('btnPairing').disabled = false;
    showAlert('success', '✅ Pairing code generated for ' + sessionId);
  });

  evtSource.addEventListener('pairingCodeError', (e) => {
    const { error } = JSON.parse(e.data);
    showAlert('error', '❌ ' + error);
    document.getElementById('btnPairing').disabled = false;
  });

  evtSource.onerror = () => {
    setTimeout(connectSSE, 3000);
  };
}

async function renderQR(qrString, sessionId) {
  const qrBox = document.getElementById('qrBox');
  const canvas = document.createElement('canvas');
  qrBox.innerHTML = '';
  qrBox.appendChild(canvas);
  
  // Use /api/qr-image endpoint to get QR as image
  const img = document.createElement('img');
  img.src = '/api/qr-image?session=' + encodeURIComponent(sessionId) + '&t=' + Date.now();
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.borderRadius = '8px';
  qrBox.innerHTML = '';
  qrBox.appendChild(img);
  document.getElementById('qrInfo').innerHTML = '<strong>' + sessionId + '</strong> — Waiting for scan...';
}

function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector('.tab[onclick*="' + tab + '"]').classList.add('active');
  document.getElementById('tab-' + tab).classList.add('active');
}

async function requestQR() {
  const sessionId = document.getElementById('sessionName').value.trim() || 'default';
  document.getElementById('qrBox').innerHTML = '<div class="qr-placeholder"><div class="spinner"></div><p style="margin-top:12px">Generating QR...</p></div>';
  document.getElementById('qrInfo').textContent = 'Connecting to WhatsApp...';
  document.getElementById('btnQR').disabled = true;
  showAlert('info', '⏳ Creating session ' + sessionId + '...');
  
  try {
    const res = await fetch('/api/session/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, method: 'qr' }),
    });
    const data = await res.json();
    if (!data.ok) showAlert('error', '❌ ' + data.error);
  } catch (err) {
    showAlert('error', '❌ Failed: ' + err.message);
  }
  document.getElementById('btnQR').disabled = false;
}

async function requestPairing() {
  const sessionId = document.getElementById('sessionName').value.trim() || 'default';
  const phone = document.getElementById('pairingPhone').value.replace(/[^0-9]/g, '');
  if (!phone || phone.length < 10) return showAlert('error', '❌ Enter a valid phone number');
  
  document.getElementById('btnPairing').disabled = true;
  document.getElementById('codeDisplay').style.display = 'none';
  showAlert('info', '⏳ Requesting pairing code...');

  try {
    const res = await fetch('/api/session/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, method: 'pairing', phoneNumber: phone }),
    });
    const data = await res.json();
    if (!data.ok) {
      showAlert('error', '❌ ' + data.error);
      document.getElementById('btnPairing').disabled = false;
    }
  } catch (err) {
    showAlert('error', '❌ ' + err.message);
    document.getElementById('btnPairing').disabled = false;
  }
}

async function deleteSession(id) {
  if (!confirm('Delete session "' + id + '"?')) return;
  await fetch('/api/session/' + id, { method: 'DELETE' });
  loadData();
}

function showAlert(type, msg) {
  const el = document.getElementById('connectAlert');
  el.className = 'alert ' + type + ' show';
  el.textContent = msg;
  setTimeout(() => el.className = 'alert', 4000);
}

function statusDot(s) {
  if (s === 'connected') return '<span class="dot green"></span> Connected';
  if (s === 'qr') return '<span class="dot yellow"></span> Waiting for scan';
  if (s === 'connecting') return '<span class="dot blue"></span> Connecting...';
  if (s === 'reconnecting') return '<span class="dot yellow"></span> Reconnecting...';
  return '<span class="dot red"></span> Disconnected';
}

async function loadData() {
  try {
    const res = await fetch('/api/stats');
    const d = await res.json();
    document.getElementById('statSessions').textContent = d.connectedSessions ?? '0';
    document.getElementById('statPlugins').textContent = d.plugins ?? '—';
    document.getElementById('statUsers').textContent = d.users ?? '—';
    document.getElementById('statUptime').textContent = d.uptime ?? '—';

    // Sessions list
    const list = document.getElementById('sessionsList');
    if (!d.sessions || d.sessions.length === 0) {
      list.innerHTML = '<div class="no-sessions">📱 No sessions. Connect WhatsApp above!</div>';
    } else {
      list.innerHTML = d.sessions.map(s => \`
        <div class="session-card">
          <div class="session-avatar">📱</div>
          <div class="session-info">
            <div class="session-name">\${s.name || s.id}</div>
            <div class="session-jid">\${s.phone ? '+' + s.phone : s.id}</div>
            <div class="session-status">\${statusDot(s.status)}</div>
          </div>
          <button class="btn-delete" onclick="deleteSession('\${s.id}')">🗑 Remove</button>
        </div>
      \`).join('');
    }

    // Categories
    if (d.categories) {
      const emojis = {admin:'👮',download:'📥',economy:'💰',fun:'🎮',group:'👥',level:'⭐',media:'🎨',owner:'👑',search:'🔍',tools:'🛠️',utility:'🔧'};
      document.getElementById('catGrid').innerHTML = Object.entries(d.categories).map(([k,v]) =>
        \`<div class="cat-item"><div class="cat-count">\${v}</div><div class="cat-name">\${emojis[k] || '📦'} \${k}</div></div>\`
      ).join('');
    }
  } catch {}
}

// Init
connectSSE();
loadData();
setInterval(loadData, 5000);
</script>
</body>
</html>`;
}

async function startServer() {
  const port = parseInt(process.env.PORT || '5000', 10);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const pathname = url.pathname;

    // Strip /api prefix so both /api/* and /* work
    const p = pathname.replace(/^\/api/, '') || '/';

    // Dashboard
    if (p === '/' || p === '' || p === '/dashboard') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getDashboardHTML());
      return;
    }

    // SSE endpoint — real-time events
    if (p === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write('retry: 3000\n\n');
      sseClients.add(res);

      // Send current QR codes immediately
      for (const [sessionId, qr] of sessionQRs) {
        res.write(`event: qr\ndata: ${JSON.stringify({ sessionId, qr })}\n\n`);
      }

      req.on('close', () => sseClients.delete(res));
      return;
    }

    // QR image endpoint
    if (p === '/qr-image') {
      const sessionId = url.searchParams.get('session') || 'default';
      const qr = sessionQRs.get(sessionId);
      if (!qr) { res.writeHead(404); res.end('No QR'); return; }
      try {
        const png = await QRCode.toBuffer(qr, { width: 300, margin: 2 });
        res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-cache' });
        res.end(png);
      } catch { res.writeHead(500); res.end('QR Error'); }
      return;
    }

    // Health check
    if (p === '/healthz' || p === '/health') {
      const sessionsInfo = getAllSessions();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok', bot: config.botName, version: config.version,
        uptime: formatDuration(Date.now() - startTime),
        sessions: sessionsInfo.length, plugins: plugins.size,
      }));
      return;
    }

    // Stats
    if (p === '/stats') {
      const cats = getCategories();
      const sessionsInfo = getAllSessions();
      const catCounts = {};
      for (const [cat, cmds] of Object.entries(cats)) catCounts[cat] = cmds.length;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        uptime: formatDuration(Date.now() - startTime),
        plugins: plugins.size,
        users: Object.keys(db.users.all()).length,
        groups: Object.keys(db.groups.all()).length,
        sessions: sessionsInfo,
        connectedSessions: sessionsInfo.filter(s => s.status === 'connected').length,
        categories: catCounts,
      }));
      return;
    }

    // Create session
    if (p === '/session/create' && req.method === 'POST') {
      let body = '';
      req.on('data', d => body += d);
      req.on('end', async () => {
        try {
          const { sessionId = 'default', method = 'qr', phoneNumber } = JSON.parse(body);
          const cleanId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 30) || 'default';
          const usePairing = method === 'pairing';
          if (usePairing && !phoneNumber) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Phone number required' }));
            return;
          }
          await createSession(cleanId, usePairing, phoneNumber);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, sessionId: cleanId, method }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      });
      return;
    }

    // Delete session
    const deleteMatch = p.match(/^\/session\/([^/]+)$/);
    if (deleteMatch && req.method === 'DELETE') {
      try {
        await deleteSession(deleteMatch[1]);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(port, () => logger.info({ port }, '🌐 Dashboard running'));
  return server;
}

setMessageHandler(handleMessage);
setConnectionHandler((sessionId, sock, status) => {
  logger.info({ sessionId, status }, '📡 Session update');
});

async function main() {
  printBanner();
  logger.info('🚀 Starting AA MD Bot...');

  for (const dir of ['logs', 'temp', 'media', 'session']) {
    fs.ensureDirSync(path.join(__dirname, dir));
  }

  await startServer();

  logger.info('📦 Loading plugins...');
  const pluginCount = await loadAllPlugins();
  logger.info({ count: pluginCount }, `✅ Loaded ${pluginCount} plugins`);

  const cats = getCategories();
  const catList = Object.entries(cats).map(([k, v]) => `${k}(${v.length})`).join(', ');
  logger.info(`📂 Categories: ${catList}`);

  logger.info('🔌 Initializing WhatsApp sessions...');
  await initAllSessions();

  setInterval(cleanTemp, 30 * 60 * 1000);
  logger.info(chalk.cyan.bold('✨ AA MD Bot is fully operational!'));
}

main().catch(err => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});
