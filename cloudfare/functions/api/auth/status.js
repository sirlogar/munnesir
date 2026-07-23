import { getSnapshot, handleOptions, json, requireAuth } from '../../_shared.js';

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return handleOptions();
  const denied = await requireAuth(context);
  if (denied) return denied;
  const snap = await getSnapshot(context.env);
  return json({ ok: true, revision: snap.revision, updatedAt: snap.updatedAt });
}
