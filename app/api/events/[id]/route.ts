import { NextResponse } from 'next/server';
import { isUuid, jsonError, readJson, requireUser } from '@/lib/server/auth';
import { cancelEvent, getEvent, moderateEvent, updateEvent, type EventInput } from '@/lib/server/events';

type Ctx = { params: Promise<{ id: string }> };

/** GET — event detail with comments and (when allowed) who's going. */
export async function GET(_request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return jsonError('not_found', 404);
  const r = await getEvent(auth.user.id, id);
  return r.ok ? NextResponse.json(r) : jsonError(r.error, r.status);
}

/**
 * PATCH — host/admin edits: EventInput fields.
 * Admin moderation: { moderate: 'feature' | 'unfeature' | 'hide' | 'restore', reason? }
 */
export async function PATCH(request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return jsonError('not_found', 404);
  const body = await readJson<EventInput & { moderate?: 'feature' | 'unfeature' | 'hide' | 'restore'; reason?: string }>(request);
  const r = body.moderate
    ? await moderateEvent(auth.user.id, id, body.moderate, body.reason)
    : await updateEvent(auth.user.id, id, body);
  return r.ok ? NextResponse.json(r) : jsonError(r.error, r.status);
}

/** DELETE — host/admin cancels the event (attendees are notified). */
export async function DELETE(_request: Request, { params }: Ctx) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return jsonError('not_found', 404);
  const r = await cancelEvent(auth.user.id, id);
  return r.ok ? NextResponse.json(r) : jsonError(r.error, r.status);
}
