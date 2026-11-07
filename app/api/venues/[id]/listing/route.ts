import { NextResponse } from 'next/server';
import { isAdminUser, isUuid, jsonError, readJson, requireUser } from '@/lib/server/auth';
import { claimListing } from '@/lib/server/places';

/**
 * POST /api/venues/[id]/listing { place_id, place_name, naver_map_url? }
 * The venue's owner (or an admin) links the venue to its Kakao Map place. The server finds the
 * place on Kakao again, compares it with the venue's details and sets the map pin from it.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return jsonError('not_found', 404);
  const body = await readJson<{ place_id: string; place_name: string; naver_map_url: string }>(request);
  const r = await claimListing(id, { userId: auth.user.id, isAdmin: await isAdminUser(auth.user.id) }, body);
  if (!r.ok) return jsonError(r.error, r.status);
  return NextResponse.json({ ok: true, listing: r.listing, check: r.check, google: r.google, needs_review: r.needs_review });
}
