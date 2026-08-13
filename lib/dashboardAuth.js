import crypto from 'crypto';

export const DASHBOARD_COOKIE = 'jutts_dashboard';

function digest(value) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest();
}

export function safeEqual(left, right) {
  return crypto.timingSafeEqual(digest(left), digest(right));
}

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of String(header).split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!key) continue;
    try { cookies[key] = decodeURIComponent(value); } catch { cookies[key] = value; }
  }
  return cookies;
}

function bearerToken(header = '') {
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

export function getRequestOrigin(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto || (req.socket?.encrypted ? 'https' : 'http');
  return `${protocol}://${req.headers.host || 'localhost'}`;
}

export function isOriginAllowed(req, configuredOrigins = '') {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (origin === getRequestOrigin(req)) return true;

  const allowed = String(configuredOrigins)
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  return allowed.includes('*') || allowed.includes(origin);
}

export function createDashboardAuth(token = process.env.DASHBOARD_TOKEN || '') {
  const secret = String(token).trim();
  if (secret && secret.length < 16) {
    throw new Error('DASHBOARD_TOKEN must contain at least 16 characters');
  }
  const enabled = Boolean(secret);
  const sessionValue = enabled
    ? crypto.createHmac('sha256', secret).update('jutts-dashboard-session-v1').digest('base64url')
    : '';

  function tokenFromRequest(req) {
    return (
      bearerToken(req.headers.authorization) ||
      String(req.headers['x-dashboard-token'] || '').trim()
    );
  }

  function isAuthorized(req) {
    if (!enabled) return true;
    const supplied = tokenFromRequest(req);
    if (supplied && safeEqual(supplied, secret)) return true;
    const cookie = parseCookies(req.headers.cookie)[DASHBOARD_COOKIE];
    return Boolean(cookie && safeEqual(cookie, sessionValue));
  }

  function createLoginSession(req, res) {
    if (!enabled || !isAuthorized(req)) return false;
    const secure = getRequestOrigin(req).startsWith('https://');
    const cookie = [
      `${DASHBOARD_COOKIE}=${encodeURIComponent(sessionValue)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
      'Max-Age=604800',
      ...(secure ? ['Secure'] : []),
    ].join('; ');
    res.writeHead(204, { 'Set-Cookie': cookie, 'Cache-Control': 'no-store' });
    res.end();
    return true;
  }

  return { enabled, isAuthorized, createLoginSession };
}

export function sendUnauthorized(req, res) {
  const wantsHtml = String(req.headers.accept || '').includes('text/html');
  res.writeHead(401, {
    'Content-Type': wantsHtml ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  if (!wantsHtml) {
    res.end(JSON.stringify({ error: 'Authentication required' }));
    return;
  }

  // The optional URL fragment is never sent to Nginx/Node access logs. The page
  // exchanges it for a signed HttpOnly cookie through an Authorization header.
  res.end(`<!doctype html>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Jutts Bot Login</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#060911;color:#edf2f7;font:16px system-ui}
  form{width:min(360px,calc(100% - 40px));padding:28px;background:#0d1421;border:1px solid #182335;border-radius:16px}
  h1{margin-top:0}p{color:#9badc5}input,button{box-sizing:border-box;width:100%;padding:12px;border-radius:9px;font:inherit}
  input{background:#060a12;color:white;border:1px solid #26364d}button{margin-top:12px;border:0;background:#25d366;font-weight:700;cursor:pointer}
  #error{color:#ff6b78;min-height:1.3em}
</style>
<form id="login"><h1>Jutts Bot</h1><p>Enter the dashboard token from your server's <code>.env</code> file.</p>
<input id="token" type="password" autocomplete="current-password" required autofocus aria-label="Dashboard token">
<button>Unlock dashboard</button><p id="error" role="alert"></p></form>
<script>
  const form=document.getElementById('login'),input=document.getElementById('token'),error=document.getElementById('error');
  async function login(token){
    error.textContent='';
    const response=await fetch('/auth/login',{method:'POST',headers:{Authorization:'Bearer '+token}});
    if(!response.ok){error.textContent='Invalid dashboard token';return;}
    history.replaceState(null,'',location.pathname+location.search);location.reload();
  }
  form.addEventListener('submit',event=>{event.preventDefault();login(input.value).catch(()=>error.textContent='Login failed');});
  const fragment=new URLSearchParams(location.hash.slice(1));
  if(fragment.has('token')){input.value=fragment.get('token');history.replaceState(null,'',location.pathname+location.search);login(input.value).catch(()=>error.textContent='Login failed');}
</script>`);
}

export default { createDashboardAuth, isOriginAllowed, getRequestOrigin, parseCookies, safeEqual };
