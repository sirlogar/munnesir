import { handleOptions, json } from '../../_shared.js';

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return handleOptions();
  const password = String(context.env.MUNNESIR_PASSWORD || '');
  const hash = String(context.env.MUNNESIR_PASSWORD_HASH || '');
  const session = String(context.env.SESSION_SECRET || '');
  return json({
    ok: true,
    note: 'Gizli değerler gösterilmez; sadece var/yok ve uzunluk bilgisi döner.',
    munnesirPasswordSet: Boolean(password),
    munnesirPasswordLength: password.length,
    munnesirPasswordTrimLength: password.trim().length,
    munnesirPasswordHashSet: Boolean(hash.trim()),
    sessionSecretSet: Boolean(session),
    sessionSecretLength: session.length,
    d1BindingSet: Boolean(context.env.MUNNESIR_DB),
    origin: new URL(context.request.url).origin
  });
}
