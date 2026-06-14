import { handleOptions, json } from '../../_shared.js';

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return handleOptions();
  return json({ ok: true });
}
