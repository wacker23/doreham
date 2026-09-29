import { NextResponse } from 'next/server';
import { isUuid, jsonError, readJson, requireUser } from '@/lib/server/auth';
import { reportEvent } from '@/lib/server/events';

/** POST { reason, details?, comment_id? } — report an event or one of its comments. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return jsonError('not_found', 404);
  const body = await readJson<{ reason?: string; details?: string; comment_id?: string | null }>(request);
  if (body.comment_id && !isUuid(body.comment_id)) return jsonError('not_found', 404);
  const r = await reportEvent(auth.user.id, id, body);
  return r.ok ? NextResponse.json(r) : jsonError(r.error, r.status);
}
