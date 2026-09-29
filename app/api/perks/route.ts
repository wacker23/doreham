import { NextResponse } from 'next/server';
import { isUuid, requireUser } from '@/lib/server/auth';
import { perksForViewer } from '@/lib/server/perks';

/** GET ?venue_id= — partner venue perks, with whether my level unlocks each one. */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const venueId = new URL(request.url).searchParams.get('venue_id');
  return NextResponse.json(await perksForViewer(auth.user.id, { venueId: isUuid(venueId) ? venueId : null }));
}
