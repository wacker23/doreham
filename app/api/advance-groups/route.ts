import { NextResponse } from 'next/server';
import { requireCronOrAdmin } from '@/lib/server/auth';
import { advanceDueGroups } from '@/lib/server/scheduling';
import { fillMissingVenuePins } from '@/lib/server/geocode';
import { fillMissingGooglePlaces } from '@/lib/server/places';

export const maxDuration = 120;

/**
 * Cron (every 15 min): moves groups forward when a deadline passes, even if
 * nobody opens the app — availability → voting → scheduled → completed.
 * Also gives venues without a map pin one from their address (needs KAKAO_REST_API_KEY), and
 * finds the Google Maps place of linked venues that don't have one yet (needs GOOGLE_MAPS_API_KEY).
 */
async function handle(request: Request) {
  const auth = await requireCronOrAdmin(request);
  if (!auth.ok) return auth.response;
  const result = await advanceDueGroups();
  const venuePins = await fillMissingVenuePins().catch((e) => {
    console.error('[advance-groups] venue pins failed:', e);
    return { error: 'failed' };
  });
  const googlePlaces = await fillMissingGooglePlaces().catch((e) => {
    console.error('[advance-groups] google places failed:', e);
    return { error: 'failed' };
  });
  return NextResponse.json({ ...result, venue_pins: venuePins, google_places: googlePlaces });
}

export const GET = handle;
export const POST = handle;
