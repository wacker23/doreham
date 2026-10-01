import { NextResponse } from 'next/server';
import { isUuid, jsonError, readJson, requireAdmin } from '@/lib/server/auth';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { setPlus } from '@/lib/server/plan';
import { isPlusActive } from '@/lib/plan';

type Row = { id: string; display_name: string | null; email: string | null; plus: boolean; tier: string; expires_at: string | null };

/** GET ?q=name-or-email — Doreham+ members, plus search results (admin only). */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const q = (new URL(request.url).searchParams.get('q') ?? '').trim().toLowerCase().slice(0, 80);
  const admin = getAdmin();

  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emails = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? null]));

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, display_name, subscription_tier, subscription_expires_at, deleted_at')
    .is('deleted_at', null)
    .limit(2000);
  const rows: Row[] = (profiles ?? []).map((p) => ({
    id: p.id as string,
    display_name: (p.display_name as string | null) ?? null,
    email: emails.get(p.id as string) ?? null,
    tier: (p.subscription_tier as string) ?? 'free',
    expires_at: (p.subscription_expires_at as string | null) ?? null,
    plus: isPlusActive(p.subscription_tier as string, p.subscription_expires_at as string | null),
  }));

  const members = rows.filter((r) => r.tier === 'plus').sort((a, b) => (a.display_name ?? '').localeCompare(b.display_name ?? ''));
  const results = q
    ? rows.filter((r) => (r.display_name ?? '').toLowerCase().includes(q) || (r.email ?? '').toLowerCase().includes(q) || r.id === q).slice(0, 30)
    : [];
  return NextResponse.json({ members, results });
}

/** POST { user_id, months } — months: 1–24 to give/extend, null for no end date, 0 to remove. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const body = await readJson<{ user_id?: unknown; months?: unknown }>(request);
  if (!isUuid(body.user_id)) return jsonError('bad_user', 400);
  const months = body.months === null ? null : Number(body.months);
  if (months !== null && (!Number.isInteger(months) || months < 0 || months > 24)) return jsonError('bad_months', 400);
  const r = await setPlus(body.user_id, months, auth.user.id);
  return r.ok ? NextResponse.json(r) : jsonError(r.error, r.error === 'user_not_found' ? 404 : 500);
}
