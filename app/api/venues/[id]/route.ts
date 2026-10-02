import { NextResponse } from 'next/server';
import { isUuid, jsonError, readJson, requireUser } from '@/lib/server/auth';
import { deleteVenue, updateVenue, type VenueUpdateInput } from '@/lib/server/venues';

/** PATCH — the owner (or an admin) edits a venue. Body: the venue fields + photo_urls + menu_items. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return jsonError('not_found', 404);
  const r = await updateVenue(auth.user.id, id, await readJson<VenueUpdateInput>(request));
  if (!r.ok) return jsonError(r.error, r.status);
  return NextResponse.json(r);
}

/** DELETE — the owner (or an admin) removes a venue from Doreham. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return jsonError('not_found', 404);
  const r = await deleteVenue(auth.user.id, id);
  if (!r.ok) return jsonError(r.error, r.status);
  return NextResponse.json(r);
}
