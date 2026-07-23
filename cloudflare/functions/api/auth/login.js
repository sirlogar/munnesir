import { checkPassword, getSnapshot, handleOptions, json, makeToken } from '../../_shared.js';

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return handleOptions();
  if (context.request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const body = await context.request.json().catch(() => ({}));
  const ok = await checkPassword(context.env, body.password || '');
  if (!ok) return json({ error: 'Şifre yanlış.' }, 401);
  const token = await makeToken(context.env);
  const snap = await getSnapshot(context.env);
  return json({ ok: true, token, revision: snap.revision, updatedAt: snap.updatedAt, hasSnapshot: true });
}
