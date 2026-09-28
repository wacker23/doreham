import 'server-only';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient as createSessionClient } from '@/lib/supabase/server';
import { getAdmin } from '@/lib/server/supabaseAdmin';

/**
 * Auth guards for API route handlers.
 *
 * RULE: never trust a user_id sent by the browser. Every route derives the
 * caller from the Supabase session cookie via requireUser()/requireAdmin(),
 * and cron routes verify the Vercel CRON_SECRET via isCronRequest().
 */

export type AuthOk = { ok: true; user: User };
export type AuthFail = { ok: false; response: NextResponse };

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...(extra ?? {}) }, { status });
}

/** Returns the signed-in user, or a 401 response. */
export async function requireUser(): Promise<AuthOk | AuthFail> {
  try {
    const supabase = await createSessionClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      return { ok: false, response: jsonError('not_signed_in', 401) };
    }
    return { ok: true, user: data.user };
  } catch {
    return { ok: false, response: jsonError('not_signed_in', 401) };
  }
}

export async function isAdminUser(userId: string): Promise<boolean> {
  const { data } = await getAdmin()
    .from('profiles')
    .select('role, deleted_at')
    .eq('id', userId)
    .maybeSingle();
  return data?.role === 'admin' && !data?.deleted_at;
}

/** Returns the signed-in admin, or a 401/403 response. */
export async function requireAdmin(): Promise<AuthOk | AuthFail> {
  const auth = await requireUser();
  if (!auth.ok) return auth;
  if (!(await isAdminUser(auth.user.id))) {
    return { ok: false, response: jsonError('forbidden', 403) };
  }
  return auth;
}

/**
 * True when the request carries the Vercel Cron secret.
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically when the
 * CRON_SECRET env var is set on the project. Fails closed if it is not set.
 */
export function isCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}

/** Cron routes: allow Vercel Cron, or a signed-in admin (manual trigger from the admin UI / console). */
export async function requireCronOrAdmin(request: Request): Promise<{ ok: true; via: 'cron' | 'admin' } | AuthFail> {
  if (isCronRequest(request)) return { ok: true, via: 'cron' };
  const admin = await requireAdmin();
  if (admin.ok) return { ok: true, via: 'admin' };
  return { ok: false, response: jsonError('unauthorized', 401) };
}

/** Parse a JSON body without throwing. */
export async function readJson<T = Record<string, unknown>>(request: Request): Promise<Partial<T>> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? (body as Partial<T>) : {};
  } catch {
    return {};
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}
