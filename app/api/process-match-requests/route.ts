import { NextResponse } from 'next/server';
import { isCronRequest, isUuid, jsonError, readJson, requireAdmin, requireUser } from '@/lib/server/auth';
import { processMatchRequests } from '@/lib/server/matching';

export const maxDuration = 60;

/**
 * GET  — Vercel Cron (every 10 min): processes every searching request.
 * POST — signed-in user: processes only the caller's own searching request
 *        (called right after they submit one). Admins may process all.
 */
export async function GET(request: Request) {
  if (!isCronRequest(request)) return jsonError('unauthorized', 401);
  const result = await processMatchRequests();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function POST(request: Request) {
  if (isCronRequest(request)) {
    const result = await processMatchRequests();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await readJson<{ request_id: string; all: boolean }>(request);

  if (body.all) {
    const admin = await requireAdmin();
    if (!admin.ok) return admin.response;
    const result = await processMatchRequests();
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  }

  const requestId = isUuid(body.request_id) ? body.request_id : undefined;
  const result = await processMatchRequests({ requestId, userId: auth.user.id });
  if (!result.ok) {
    console.error('[process-match-requests] failed:', result);
    return jsonError('server_error', 500);
  }
  // A member only learns whether their own request matched — not other people's ids,
  // compatibility scores or how many people are searching.
  const mine = (result.results ?? []).find((r) => r.request_id === requestId) as { action?: string } | undefined;
  return NextResponse.json({ ok: true, action: mine?.action ?? 'queued' });
}
