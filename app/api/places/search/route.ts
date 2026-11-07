import { NextResponse } from 'next/server';
import { isUuid, jsonError, requireUser } from '@/lib/server/auth';
import { markClaimed, searchKakaoPlaces } from '@/lib/server/places';
import { parseLatLng } from '@/lib/server/geocode';

/**
 * GET /api/places/search?q=해파리 커피&venue_id=<own venue, optional>&near=37.5,127.0
 * Kakao Map places for the "find your business" step (signed-in users). Places already linked
 * to another venue come back with `claimed: true`.
 */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 60);
  if (q.length < 2) return jsonError('query_too_short', 400);
  const venueId = url.searchParams.get('venue_id');
  const near = parseLatLng(url.searchParams.get('near') ?? '');

  const r = await searchKakaoPlaces(q, near);
  if (!r.ok) return jsonError(r.reason === 'failed' ? 'search_failed' : 'search_off', r.reason === 'failed' ? 502 : 503);
  const places = await markClaimed(r.places, isUuid(venueId) ? venueId : null);
  return NextResponse.json({ places }, { headers: { 'Cache-Control': 'private, no-store' } });
}
