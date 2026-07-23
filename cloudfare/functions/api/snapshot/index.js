import { getSnapshot, handleOptions, json, putSnapshot, requireAuth } from '../../_shared.js';

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return handleOptions();
  const denied = await requireAuth(context);
  if (denied) return denied;

  if (context.request.method === 'GET') {
    const snap = await getSnapshot(context.env);
    return json(snap);
  }

  if (context.request.method === 'PUT') {
    const body = await context.request.json().catch(() => ({}));
    if (!body.payload || typeof body.payload !== 'object') return json({ error: 'Payload eksik.' }, 400);
    const result = await putSnapshot(context.env, body.payload);
    return json({ ok: true, ...result });
  }

  return json({ error: 'Method not allowed' }, 405);
}
