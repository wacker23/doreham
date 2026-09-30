import { NextResponse } from 'next/server';
import { jsonError, readJson, requireUser } from '@/lib/server/auth';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { isPushEndpoint } from '@/lib/server/push';

const MAX_DEVICES = 10;

type Body = {
  subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  endpoint?: unknown;
  lang?: unknown;
};

const str = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);

/**
 * POST { subscription, lang } — save (or refresh) this browser's push subscription for the
 * signed-in user. Called when notifications are turned on, and again on app load so the
 * language and owner stay current.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const body = await readJson<Body>(request);
  const endpoint = str(body.subscription?.endpoint, 1024);
  const p256dh = str(body.subscription?.keys?.p256dh, 256);
  const authKey = str(body.subscription?.keys?.auth, 128);
  if (!endpoint || !p256dh || !authKey) return jsonError('bad_subscription', 400);
  if (!isPushEndpoint(endpoint)) return jsonError('unsupported_push_service', 400);
  const lang = body.lang === 'ko' ? 'ko' : 'en';
  const ua = (request.headers.get('user-agent') ?? '').slice(0, 300) || null;

  const admin = getAdmin();
  const now = new Date().toISOString();
  const { error } = await admin.from('push_subscriptions').upsert(
    { user_id: auth.user.id, endpoint, p256dh, auth: authKey, lang, user_agent: ua, updated_at: now, failure_count: 0 },
    { onConflict: 'endpoint' },
  );
  if (error) {
    console.error('push subscribe failed', error.message);
    return jsonError('save_failed', 500);
  }

  // Keep at most MAX_DEVICES per person (oldest go first).
  const { data: rows } = await admin
    .from('push_subscriptions')
    .select('id, updated_at')
    .eq('user_id', auth.user.id)
    .order('updated_at', { ascending: false });
  const extra = (rows ?? []).slice(MAX_DEVICES).map((r: { id: string }) => r.id);
  if (extra.length) await admin.from('push_subscriptions').delete().in('id', extra);

  return NextResponse.json({ ok: true });
}

/** DELETE { endpoint } — this browser turned notifications off (or is signing out). */
export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const body = await readJson<Body>(request);
  const endpoint = str(body.endpoint, 1024);
  if (!endpoint) return jsonError('bad_endpoint', 400);
  await getAdmin().from('push_subscriptions').delete().eq('user_id', auth.user.id).eq('endpoint', endpoint);
  return NextResponse.json({ ok: true });
}
