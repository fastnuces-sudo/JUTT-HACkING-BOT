import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DASHBOARD_COOKIE,
  createDashboardAuth,
  isOriginAllowed,
  parseCookies,
  safeEqual,
} from '../lib/dashboardAuth.js';

function request(headers = {}) {
  return { headers: { host: 'bot.example', ...headers }, socket: { encrypted: false } };
}

test('cookie parser and constant-time comparison handle untrusted values', () => {
  assert.deepEqual(parseCookies('a=1; encoded=hello%20world'), { a: '1', encoded: 'hello world' });
  assert.equal(safeEqual('same', 'same'), true);
  assert.equal(safeEqual('short', 'a completely different length'), false);
});

test('dashboard rejects weak configured tokens', () => {
  assert.throws(() => createDashboardAuth('too-short'), /at least 16/);
});

test('dashboard accepts bearer token and signed cookie without storing raw secret', () => {
  const secret = '0123456789abcdef0123456789abcdef';
  const auth = createDashboardAuth(secret);
  assert.equal(auth.enabled, true);
  assert.equal(auth.isAuthorized(request()), false);
  assert.equal(auth.isAuthorized(request({ authorization: `Bearer ${secret}` })), true);

  const headers = {};
  const response = {
    writeHead(status, values) { this.status = status; Object.assign(headers, values); },
    end() {},
  };
  assert.equal(auth.createLoginSession(request({ authorization: `Bearer ${secret}` }), response), true);
  assert.equal(response.status, 204);
  assert.equal(headers.Location, undefined);
  assert.ok(headers['Set-Cookie'].startsWith(`${DASHBOARD_COOKIE}=`));
  assert.ok(!headers['Set-Cookie'].includes(secret));

  const cookie = headers['Set-Cookie'].split(';')[0];
  assert.equal(auth.isAuthorized(request({ cookie })), true);
});

test('origin policy allows same-origin and explicit external origins only', () => {
  assert.equal(isOriginAllowed(request({ origin: 'http://bot.example' }), ''), true);
  assert.equal(isOriginAllowed(request({ origin: 'https://admin.example' }), 'https://admin.example'), true);
  assert.equal(isOriginAllowed(request({ origin: 'https://evil.example' }), 'https://admin.example'), false);
  assert.equal(isOriginAllowed(request(), ''), true);
});
