import { NextResponse } from 'next/server';
import { isUuid, jsonError, requireUser } from '@/lib/server/auth';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { googlePlaceLive } from '@/lib/server/places';

/**
 * GET /api/venues/[id]/google?lang=ko|en (signed-in users)
 * The venue's hours and up to 3 photos from Google Maps, fetched now. Google doesn't allow
 * keeping this content, so nothing is stored or cached (only the place id is kept).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!isUuid(id)) return jsonError('not_found', 404);
  const lang = new URL(request.url).searchParams.get('lang') === 'en' ? 'en' : 'ko';

  const { data: v } = await getAdmin()
    .from('venues')
    .select('google_place_id')
    .eq('id', id)
    .eq('is_active', true)
    .is('deactivated_at', null)
    .maybeSingle();
  if (!v?.google_place_id) return jsonError('not_found', 404);

  const r = await googlePlaceLive(v.google_place_id as string, lang);
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!r.ok) {
    const status = r.reason === 'not_found' ? 404 : r.reason === 'failed' ? 502 : 503;
    return NextResponse.json({ error: `google_${r.reason}` }, { status, headers });
  }
  return NextResponse.json(r, { headers });
}
