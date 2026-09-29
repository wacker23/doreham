import { NextResponse } from 'next/server';
import { isUuid, jsonError, requireUser } from '@/lib/server/auth';
import { getEventForEdit } from '@/lib/server/events';

/** GET — the event as stored, for the host's edit form. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return jsonError('not_found', 404);
  const r = await getEventForEdit(auth.user.id, id);
  return r.ok ? NextResponse.json(r) : jsonError(r.error, r.status);
}
