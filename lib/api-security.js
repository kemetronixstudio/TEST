
const fs = require('fs');
const path = require('path');
const { kvGetJson, kvSetJson, getKvConfig } = require('./kv-store');
function isHttps(req) {
  return String(req.headers['x-forwarded-proto'] || '').includes('https') || !!(req.connection && req.connection.encrypted);
}
function cookieOptions(req) {
  return 'Path=/; HttpOnly; SameSite=Lax; Max-Age=43200' + ((process.env.NODE_ENV === 'production' || isHttps(req)) ? '; Secure' : '');
}
function setAuthCookie(req, res, token) {
  if (!token) return;
  res.setHeader('Set-Cookie', `kgAccessToken=${encodeURIComponent(token)}; ${cookieOptions(req)}`);
}
function allowedOrigins(req) {
  const configured = String(process.env.ALLOWED_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
  const origin = String(req.headers.origin || '').trim();
  if (origin && configured.includes(origin)) return origin;
  if (configured.length) return configured[0] || '';
  return '';
}
function applyCors(req, res) {
  const origin = allowedOrigins(req);
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Access-User, X-Access-Pass, X-Admin-User, X-Admin-Pass');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}
function clientIp(req) {
  return String((req.socket && req.socket.remoteAddress) || (req.connection && req.connection.remoteAddress) || '').trim() || 'unknown';
}
function limiterFilePath() {
  const base = process.env.KG_RUNTIME_DIR || (process.env.VERCEL ? '/tmp' : path.join(process.cwd(), '.runtime'));
  try { fs.mkdirSync(base, { recursive: true }); } catch (error) {}
  return path.join(base, 'kg-rate-limit.json');
}
function readLimiterFileStore() {
  try {
    const raw = fs.readFileSync(limiterFilePath(), 'utf8');
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' ? data : {};
  } catch (error) {
    return {};
  }
}
function writeLimiterFileStore(store) {
  try { fs.writeFileSync(limiterFilePath(), JSON.stringify(store || {}), 'utf8'); } catch (error) {}
}
function cleanupLimiterFileStore(store, now) {
  const next = store && typeof store === 'object' ? store : {};
  Object.keys(next).forEach((key) => {
    const rec = next[key];
    if (!rec || Number(rec.resetAt || 0) <= now) delete next[key];
  });
  return next;
}
async function readLimiterRecord(bucketKey, now) {
  try {
    if (getKvConfig()) {
      const rec = await kvGetJson('kgRateLimit:' + bucketKey, null);
      if (!rec || Number(rec.resetAt || 0) <= now) return null;
      return rec;
    }
  } catch (error) {}
  const fileStore = cleanupLimiterFileStore(readLimiterFileStore(), now);
  if (fileStore && fileStore[bucketKey]) {
    writeLimiterFileStore(fileStore);
    return fileStore[bucketKey];
  }
  writeLimiterFileStore(fileStore);
  return null;
}
async function writeLimiterRecord(bucketKey, record, now) {
  try {
    if (getKvConfig()) {
      await kvSetJson('kgRateLimit:' + bucketKey, record);
      return;
    }
  } catch (error) {}
  const fileStore = cleanupLimiterFileStore(readLimiterFileStore(), now);
  fileStore[bucketKey] = record;
  writeLimiterFileStore(fileStore);
}
async function checkRateLimit(req, key) {
  const now = Date.now();
  const bucketKey = `${clientIp(req)}:${String(key || '').toLowerCase()}`;
  const max = Number(process.env.LOGIN_RATE_LIMIT_MAX || 10);
  const windowMs = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
  const rec = await readLimiterRecord(bucketKey, now);
  if (!rec) {
    const next = { count: 1, resetAt: now + windowMs };
    await writeLimiterRecord(bucketKey, next, now);
    return { ok: true, remaining: max - 1 };
  }
  if (rec.count >= max) return { ok: false, retryAfter: Math.max(1, Math.ceil((rec.resetAt - now)/1000)) };
  rec.count += 1;
  await writeLimiterRecord(bucketKey, rec, now);
  return { ok: true, remaining: max - rec.count };
}

function readJsonBody(req) {
  try {
    const maxBodyBytes = Number(process.env.MAX_JSON_BODY_BYTES || 65536);
    if (typeof req.body === 'string') {
      if (Buffer.byteLength(req.body, 'utf8') > maxBodyBytes) {
        const tooLarge = new Error('JSON body is too large');
        tooLarge.status = 413;
        throw tooLarge;
      }
      return JSON.parse(req.body || '{}');
    }
    const body = req.body || {};
    if (body && typeof body === 'object') {
      const serialized = JSON.stringify(body);
      if (Buffer.byteLength(serialized, 'utf8') > maxBodyBytes) {
        const tooLarge = new Error('JSON body is too large');
        tooLarge.status = 413;
        throw tooLarge;
      }
    }
    return body;
  } catch (error) {
    if (error && error.status) throw error;
    const err = new Error('Invalid JSON body');
    err.status = 400;
    throw err;
  }
}
module.exports = { applyCors, setAuthCookie, checkRateLimit, readJsonBody };
