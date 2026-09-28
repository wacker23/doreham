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
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
