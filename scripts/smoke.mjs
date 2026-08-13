import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const token = 'smoke-test-token-0123456789abcdef';

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

const port = await freePort();
const logs = [];
const child = spawn(process.execPath, ['index.js'], {
  cwd: root,
  env: {
    ...process.env,
    PORT: String(port),
    HOST: '127.0.0.1',
    MONGODB_URI: '',
    DASHBOARD_TOKEN: token,
    SKIP_WHATSAPP_INIT: 'true',
    TELEGRAM_BOT_TOKEN: '',
    TELEGRAM_FEATURES_BOT_TOKEN: '',
    LOG_LEVEL: 'warn',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', chunk => logs.push(chunk.toString()));
child.stderr.on('data', chunk => logs.push(chunk.toString()));

const base = `http://127.0.0.1:${port}`;
async function waitUntilReady() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Bot exited early (${child.exitCode})`);
    try {
      const response = await fetch(`${base}/healthz`);
      if (response.ok) {
        const health = await response.json();
        if (health.plugins >= 300) return health;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Health endpoint did not become ready within 30 seconds');
}

try {
  const health = await waitUntilReady();
  assert.equal(health.status, 'ok');
  assert.ok(health.plugins >= 300);

  const denied = await fetch(`${base}/`, { headers: { Accept: 'text/html' }, redirect: 'manual' });
  assert.equal(denied.status, 401);

  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(login.status, 204);
  assert.equal(login.headers.get('location'), null);
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie?.startsWith('jutts_dashboard='));
  assert.ok(!cookie.includes(token));

  const dashboard = await fetch(`${base}/`, { headers: { Cookie: cookie } });
  assert.equal(dashboard.status, 200);
  assert.match(await dashboard.text(), /Jutts Bot/);

  const stats = await fetch(`${base}/stats`, { headers: { Cookie: cookie } });
  assert.equal(stats.status, 200);
  const statsBody = await stats.json();
  assert.ok(statsBody.plugins >= 300);

  const badOrigin = await fetch(`${base}/stats`, {
    headers: { Cookie: cookie, Origin: 'https://attacker.invalid' },
  });
  assert.equal(badOrigin.status, 403);

  const invalidSession = await fetch(`${base}/session/create`, {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: '../../bad', method: 'qr' }),
  });
  assert.equal(invalidSession.status, 400);

  console.log(`Smoke OK: health, ${health.plugins} commands, auth, CORS, validation`);
} catch (error) {
  console.error(logs.join('').slice(-12_000));
  throw error;
} finally {
  if (child.exitCode === null) child.kill('SIGTERM');
  await new Promise(resolve => {
    const timer = setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
      resolve();
    }, 8_000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}
