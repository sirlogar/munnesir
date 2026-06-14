const encoder = new TextEncoder();

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

export function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
      'access-control-allow-headers': 'content-type, authorization',
      'access-control-max-age': '86400',
    },
  });
}

function base64url(buffer) {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  let str = '';
  bytes.forEach((b) => { str += String.fromCharCode(b); });
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64url(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return atob(padded);
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(String(value || '')));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(text));
  return base64url(sig);
}

function safeEqual(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function checkPassword(env, password) {
  if (!password) return false;
  if (env.MUNNESIR_PASSWORD_HASH) {
    const incoming = await sha256Hex(password);
    return safeEqual(incoming, env.MUNNESIR_PASSWORD_HASH);
  }
  if (env.MUNNESIR_PASSWORD) return safeEqual(password, env.MUNNESIR_PASSWORD);
  return false;
}

export async function makeToken(env) {
  const secret = env.SESSION_SECRET || env.MUNNESIR_PASSWORD || 'munnesir-session-secret';
  const payload = {
    app: 'munnesir',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 180,
  };
  const encoded = base64url(encoder.encode(JSON.stringify(payload)));
  const sig = await hmac(secret, encoded);
  return `${encoded}.${sig}`;
}

export async function verifyToken(env, token) {
  if (!token || !token.includes('.')) return false;
  const [encoded, sig] = token.split('.');
  const secret = env.SESSION_SECRET || env.MUNNESIR_PASSWORD || 'munnesir-session-secret';
  const expected = await hmac(secret, encoded);
  if (!safeEqual(sig, expected)) return false;
  try {
    const payload = JSON.parse(fromBase64url(encoded));
    return payload.app === 'munnesir' && payload.exp > Math.floor(Date.now() / 1000);
  } catch (_) {
    return false;
  }
}

export async function requireAuth(context) {
  const auth = context.request.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const ok = await verifyToken(context.env, token);
  if (!ok) return json({ error: 'Şifreli oturum yok. Munnesir şifresiyle tekrar giriş yap.' }, 401);
  return null;
}

export async function ensureSnapshot(env) {
  if (!env.MUNNESIR_DB) throw new Error('D1 binding eksik: MUNNESIR_DB');
  await env.MUNNESIR_DB.prepare(`CREATE TABLE IF NOT EXISTS munnesir_snapshot (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
  )`).run();
  const emptyPayload = JSON.stringify({ app: 'munnesir', version: '1.0.1', schema: 3, exportedAt: new Date().toISOString(), poems: [], books: [], deleted: [] });
  await env.MUNNESIR_DB.prepare(`INSERT OR IGNORE INTO munnesir_snapshot (id, payload, revision, updated_at) VALUES ('main', ?, 0, ?)`)
    .bind(emptyPayload, new Date().toISOString()).run();
}

export async function getSnapshot(env) {
  await ensureSnapshot(env);
  const row = await env.MUNNESIR_DB.prepare(`SELECT payload, revision, updated_at FROM munnesir_snapshot WHERE id = 'main'`).first();
  return {
    payload: JSON.parse(row.payload || '{}'),
    revision: Number(row.revision || 0),
    updatedAt: row.updated_at,
  };
}

export async function putSnapshot(env, payload) {
  await ensureSnapshot(env);
  const current = await getSnapshot(env);
  const nextRevision = Number(current.revision || 0) + 1;
  const now = new Date().toISOString();
  await env.MUNNESIR_DB.prepare(`UPDATE munnesir_snapshot SET payload = ?, revision = ?, updated_at = ? WHERE id = 'main'`)
    .bind(JSON.stringify(payload || {}), nextRevision, now).run();
  return { revision: nextRevision, updatedAt: now };
}
