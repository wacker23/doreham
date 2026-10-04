import 'server-only';
import { getAdmin } from '@/lib/server/supabaseAdmin';

/**
 * Venue map pins (latitude/longitude). QR check-in compares the member's GPS with this pin,
 * so only the server sets it: from the venue's address through the Kakao Local API
 * (env KAKAO_REST_API_KEY), or by an admin in /admin/venues.
 */

export type LatLng = { lat: number; lng: number };

/** Roughly South Korea (Jeju to the DMZ, Ulleungdo included). */
export function inKorea(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 33 && lat <= 39 && lng >= 124 && lng <= 132;
}

/**
 * Reads a pin pasted by an admin: "37.5345, 126.9935", "37.5345 126.9935", or a map link that
 * contains the pair (Google Maps "@37.53,126.99" or "!3d37.53!4d126.99", Kakao/Naver URLs).
 */
export function parseLatLng(text: unknown): LatLng | null {
  if (typeof text !== 'string') return null;
  const nums = (text.slice(0, 2000).match(/-?\d{1,3}\.\d{3,}/g) ?? []).map(Number);
  for (let i = 0; i + 1 < nums.length; i++) {
    if (inKorea(nums[i], nums[i + 1])) return { lat: nums[i], lng: nums[i + 1] };
    if (inKorea(nums[i + 1], nums[i])) return { lat: nums[i + 1], lng: nums[i] };
  }
  return null;
}

export type GeocodeResult =
  | { ok: true; pin: LatLng }
  | { ok: false; reason: 'no_key' | 'denied' | 'no_match' | 'failed' };

/**
 * Address → coordinates with Kakao Local.
 * reason 'denied' = Kakao refused the key (wrong key, or Kakao Map isn't switched on for its app).
 */
export async function geocode(address: string | null | undefined): Promise<GeocodeResult> {
  const key = process.env.KAKAO_REST_API_KEY?.trim();
  const query = (address ?? '').trim().slice(0, 200);
  if (!key) return { ok: false, reason: 'no_key' };
  if (!query) return { ok: false, reason: 'no_match' };
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=1`;
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${key}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error('[geocode] kakao', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return { ok: false, reason: res.status === 401 || res.status === 403 ? 'denied' : 'failed' };
    }
    const body = (await res.json()) as { documents?: { x?: string; y?: string; road_address?: { x?: string; y?: string } | null }[] };
    const doc = body.documents?.[0];
    if (!doc) return { ok: false, reason: 'no_match' };
    const lat = Number(doc.road_address?.y ?? doc.y);
    const lng = Number(doc.road_address?.x ?? doc.x);
    return inKorea(lat, lng) ? { ok: true, pin: { lat, lng } } : { ok: false, reason: 'no_match' };
  } catch (e) {
    console.error('[geocode] failed:', e instanceof Error ? e.message : e);
    return { ok: false, reason: 'failed' };
  }
}

/** Same, null when there's no result. */
export async function geocodeAddress(address: string | null | undefined): Promise<LatLng | null> {
  const r = await geocode(address);
  return r.ok ? r.pin : null;
}

/**
 * Pin for a venue's address: the road address first (the full address can carry a floor or
 * unit like "2층" that confuses the search), then the full address.
 */
export async function geocodeVenue(v: { road_address?: string | null; address?: string | null }): Promise<GeocodeResult> {
  const first = await geocode(v.road_address);
  if (first.ok || first.reason === 'no_key' || first.reason === 'denied') return first;
  return geocode(v.address);
}

/** The venue's pin, looked up from its address (and saved) when it's missing. */
export async function ensureVenuePin(venueId: string): Promise<LatLng | null> {
  const admin = getAdmin();
  const { data: v } = await admin
    .from('venues')
    .select('latitude, longitude, road_address, address')
    .eq('id', venueId)
    .maybeSingle();
  if (!v) return null;
  const lat = v.latitude == null ? NaN : Number(v.latitude);
  const lng = v.longitude == null ? NaN : Number(v.longitude);
  if (inKorea(lat, lng)) return { lat, lng };

  const r = await geocodeVenue(v as { road_address: string | null; address: string | null });
  if (!r.ok) return null;
  await admin.from('venues').update({ latitude: r.pin.lat, longitude: r.pin.lng }).eq('id', venueId);
  return r.pin;
}

/**
 * Cron: give venues without a pin one from their address (new registrations, changed
 * addresses, venues from before pins existed). A few per run; does nothing without the key.
 */
export async function fillMissingVenuePins(limit = 10) {
  if (!process.env.KAKAO_REST_API_KEY?.trim()) return { skipped: 'no_key' as const };
  const { data } = await getAdmin()
    .from('venues')
    .select('id')
    .is('deactivated_at', null)
    .or('latitude.is.null,longitude.is.null')
    .order('created_at', { ascending: true })
    .limit(limit);
  let found = 0;
  for (const v of data ?? []) if (await ensureVenuePin(v.id as string)) found++;
  return { checked: data?.length ?? 0, found };
}
