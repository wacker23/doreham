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

/** Address → coordinates with Kakao Local. Null when the key isn't set or nothing matched. */
export async function geocodeAddress(address: string | null | undefined): Promise<LatLng | null> {
  const key = process.env.KAKAO_REST_API_KEY;
  const query = (address ?? '').trim().slice(0, 200);
  if (!key || !query) return null;
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=1`;
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${key}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error('[geocode] kakao', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return null;
    }
    const body = (await res.json()) as { documents?: { x?: string; y?: string; road_address?: { x?: string; y?: string } | null }[] };
    const doc = body.documents?.[0];
    if (!doc) return null;
    const lat = Number(doc.road_address?.y ?? doc.y);
    const lng = Number(doc.road_address?.x ?? doc.x);
    return inKorea(lat, lng) ? { lat, lng } : null;
  } catch (e) {
    console.error('[geocode] failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * The venue's pin, looking it up from the address (and saving it) when it's missing.
 * Road address first: the full address can carry a floor or unit ("2층") that confuses the search.
 */
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

  const pin = (await geocodeAddress(v.road_address as string | null)) ?? (await geocodeAddress(v.address as string | null));
  if (!pin) return null;
  await admin.from('venues').update({ latitude: pin.lat, longitude: pin.lng }).eq('id', venueId);
  return pin;
}
