import 'server-only';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { geocodeAddress, inKorea, type LatLng } from '@/lib/server/geocode';
import { isNaverMapUrl, type CheckResult, type GoogleMatch, type ListingCheck, type MapPlace } from '@/lib/placesTypes';

/**
 * Venue map listings.
 *
 * Kakao Map (Kakao Local keyword search, env KAKAO_REST_API_KEY): every venue is linked to its
 * real Kakao Map place. Kakao gives the name, category, phone, address and position, but no
 * hours or photos. Keeping the place id and its Kakao Map link is allowed by Kakao.
 *
 * Google Maps (Places API New, env GOOGLE_MAPS_API_KEY, optional): the matching Google place
 * is found once, when the listing is linked, and only its place id is kept (Google allows
 * storing place ids, nothing else). Its hours and photos are fetched live when someone opens
 * them on the venue page and are never saved. Monthly caps keep the calls inside Google's free
 * usage (`api_usage` table, `bump_api_usage()`).
 */

const KAKAO_KEYWORD_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';
const GOOGLE_PLACES = 'https://places.googleapis.com/v1';

// Monthly caps (Google's free usage per SKU is 5,000 Text Search Pro, 1,000 Place Details
// Enterprise and 1,000 Place Photos calls). Raise them with env vars once billing is planned.
const cap = (name: string, fallback: number) => {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};
const TEXT_SEARCH_CAP = () => cap('GOOGLE_TEXT_SEARCH_MONTHLY_CAP', 4500);
const DETAILS_CAP = () => cap('GOOGLE_PLACE_DETAILS_MONTHLY_CAP', 900);
const PHOTOS_CAP = () => cap('GOOGLE_PLACE_PHOTOS_MONTHLY_CAP', 900);
const MAX_GOOGLE_PHOTOS = 3;

export type SearchResult =
  | { ok: true; places: MapPlace[] }
  | { ok: false; reason: 'no_key' | 'denied' | 'failed' };

type KakaoDoc = {
  id?: string;
  place_name?: string;
  category_name?: string;
  category_group_code?: string;
  phone?: string;
  address_name?: string;
  road_address_name?: string;
  x?: string;
  y?: string;
  place_url?: string;
};

function toPlace(d: KakaoDoc): MapPlace | null {
  const id = String(d.id ?? '');
  const lat = Number(d.y);
  const lng = Number(d.x);
  if (!/^\d{1,20}$/.test(id) || !d.place_name || !inKorea(lat, lng)) return null;
  return {
    id,
    name: d.place_name.slice(0, 100),
    category: (d.category_name ?? '').slice(0, 120),
    category_group: (d.category_group_code ?? '').slice(0, 10),
    phone: (d.phone ?? '').slice(0, 30),
    road_address: (d.road_address_name ?? '').slice(0, 200),
    address: (d.address_name ?? '').slice(0, 200),
    lat,
    lng,
    // Kakao answers with http://place.map.kakao.com/<id>; the https page is the same.
    url: `https://place.map.kakao.com/${id}`,
  };
}

/** Kakao Map keyword search (up to 15 places), closest first when `near` is given. */
export async function searchKakaoPlaces(query: string, near?: LatLng | null): Promise<SearchResult> {
  const key = process.env.KAKAO_REST_API_KEY?.trim();
  if (!key) return { ok: false, reason: 'no_key' };
  const params = new URLSearchParams({ query: query.trim().slice(0, 100), size: '15' });
  if (near && inKorea(near.lat, near.lng)) {
    params.set('x', String(near.lng));
    params.set('y', String(near.lat));
    params.set('radius', '20000');
  }
  try {
    const res = await fetch(`${KAKAO_KEYWORD_URL}?${params}`, {
      headers: { Authorization: `KakaoAK ${key}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error('[places] kakao search', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return { ok: false, reason: res.status === 401 || res.status === 403 ? 'denied' : 'failed' };
    }
    const body = (await res.json()) as { documents?: KakaoDoc[] };
    const places = (body.documents ?? []).map(toPlace).filter((p): p is MapPlace => !!p);
    return { ok: true, places };
  } catch (e) {
    console.error('[places] kakao search failed:', e instanceof Error ? e.message : e);
    return { ok: false, reason: 'failed' };
  }
}

/** Marks places already linked to another (not deleted) venue. */
export async function markClaimed(places: MapPlace[], exceptVenueId?: string | null): Promise<MapPlace[]> {
  if (!places.length) return places;
  let q = getAdmin()
    .from('venues')
    .select('id, map_provider_id')
    .eq('map_provider', 'kakao')
    .in('map_provider_id', places.map((p) => p.id))
    .is('deactivated_at', null);
  if (exceptVenueId) q = q.neq('id', exceptVenueId);
  const { data } = await q;
  const taken = new Set((data ?? []).map((v) => String(v.map_provider_id)));
  return places.map((p) => ({ ...p, claimed: taken.has(p.id) }));
}

/** Finds the Kakao place with this id again (Kakao has no lookup by id, so search by name). */
export async function findKakaoPlace(
  placeId: string,
  placeName: string,
  hints: string[] = [],
): Promise<MapPlace | null | 'off' | 'failed'> {
  const queries = [placeName, ...hints.map((h) => `${placeName} ${h}`)].filter((q) => q.trim().length >= 1);
  for (const q of queries) {
    const r = await searchKakaoPlaces(q);
    if (!r.ok) return r.reason === 'failed' ? 'failed' : 'off';
    const hit = r.places.find((p) => p.id === placeId);
    if (hit) return hit;
  }
  return null;
}

// ---------- Comparing the listing with what the owner entered ----------

const norm = (s: string | null | undefined) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^0-9a-zㄱ-ㆎ가-힣]/g, '');

/** Same business name, allowing a branch suffix ("해파리커피" vs "해파리커피 천안점"). */
export function namesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 2 && long.includes(short);
}

const digits = (s: string | null | undefined) => String(s ?? '').replace(/\D/g, '');

export function phonesMatch(listing: string | null | undefined, owner: string | null | undefined): CheckResult {
  const a = digits(listing);
  if (!a) return 'missing';
  const b = digits(owner);
  return b && (a === b || a.endsWith(b) || b.endsWith(a)) ? 'match' : 'different';
}

/** "충남 아산시 탕정면 탕정면로 123" → "탕정면로123": road name + building number. */
export function roadKey(road: string | null | undefined): string {
  const parts = String(road ?? '').trim().split(/\s+/).filter(Boolean);
  const i = parts.findIndex((p) => /(로|길)$/.test(p) || /(로|길)\d/.test(p));
  if (i < 0) return '';
  return norm(parts.slice(i, i + 2).join(''));
}

export function distanceM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Address within this distance of the listing counts as the same place. */
export const SAME_PLACE_M = 200;
/** An owner can't link a listing this far from the address they entered. */
export const TOO_FAR_M = 3000;

type VenueForCheck = {
  business_name_display: string | null;
  contact_phone: string | null;
  road_address: string | null;
  jibun_address: string | null;
  address: string | null;
};

export async function checkListing(
  venue: VenueForCheck,
  place: MapPlace,
  by: 'owner' | 'admin',
): Promise<ListingCheck> {
  const listingPin = { lat: place.lat, lng: place.lng };
  let address: CheckResult = 'missing';
  let distance: number | null = null;
  const hasAddress = !!(venue.road_address || venue.address || venue.jibun_address);
  if (hasAddress) {
    const sameRoad = roadKey(venue.road_address) && roadKey(venue.road_address) === roadKey(place.road_address);
    const pin = (await geocodeAddress(venue.road_address)) ?? (await geocodeAddress(venue.address));
    if (pin) distance = distanceM(pin, listingPin);
    address = sameRoad || (distance !== null && distance <= SAME_PLACE_M) ? 'match' : 'different';
  }
  return {
    checked_at: new Date().toISOString(),
    by,
    listing: {
      name: place.name,
      category: place.category,
      phone: place.phone,
      road_address: place.road_address,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
    },
    flags: {
      name: namesMatch(venue.business_name_display, place.name) ? 'match' : 'different',
      phone: phonesMatch(place.phone, venue.contact_phone),
      address,
    },
    distance_m: distance,
  };
}

// ---------- Google Maps (optional) ----------

function googleKey() {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || '';
}

export function googleEnabled() {
  return !!googleKey();
}

/** Counts one paid Google call this month; false when the monthly cap is reached. */
async function allowGoogleCall(sku: string, limit: number): Promise<boolean> {
  const { data, error } = await getAdmin().rpc('bump_api_usage', { p_sku: sku, p_cap: limit });
  if (error) {
    console.error('[places] usage counter failed:', error.message);
    return false;
  }
  return data === true;
}

/**
 * The Google place for a Kakao listing: Text Search near the listing, the closest result within
 * 150 m whose name matches (or within 40 m). `status` says why there's no id: Google off (no key),
 * over the monthly cap, an error (e.g. a wrong key), or no matching place.
 */
export async function findGooglePlace(place: MapPlace): Promise<GoogleMatch> {
  const key = googleKey();
  if (!key) return { id: null, status: 'off' };
  if (!(await allowGoogleCall('google_text_search_pro', TEXT_SEARCH_CAP()))) return { id: null, status: 'limit' };
  try {
    const res = await fetch(`${GOOGLE_PLACES}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location',
      },
      body: JSON.stringify({
        textQuery: `${place.name} ${place.road_address || place.address}`.trim(),
        languageCode: 'ko',
        regionCode: 'KR',
        locationBias: { circle: { center: { latitude: place.lat, longitude: place.lng }, radius: 300 } },
        pageSize: 5,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error('[places] google search', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return { id: null, status: 'error' };
    }
    const body = (await res.json()) as {
      places?: { id?: string; displayName?: { text?: string }; location?: { latitude?: number; longitude?: number } }[];
    };
    let best: { id: string; d: number } | null = null;
    for (const g of body.places ?? []) {
      const lat = Number(g.location?.latitude);
      const lng = Number(g.location?.longitude);
      if (!g.id || !/^[A-Za-z0-9_-]{10,300}$/.test(g.id) || !inKorea(lat, lng)) continue;
      const d = distanceM({ lat, lng }, { lat: place.lat, lng: place.lng });
      const ok = d <= 40 || (d <= 150 && namesMatch(g.displayName?.text, place.name));
      if (ok && (!best || d < best.d)) best = { id: g.id, d };
    }
    return best ? { id: best.id, status: 'found' } : { id: null, status: 'none' };
  } catch (e) {
    console.error('[places] google search failed:', e instanceof Error ? e.message : e);
    return { id: null, status: 'error' };
  }
}

/** When to look for a venue's Google place again (the search is a paid call). */
function googleRetryDue(g: ListingCheck['google'] | undefined, now = Date.now()): boolean {
  if (!g) return true;
  const age = now - Date.parse(g.tried_at || '1970-01-01');
  switch (g.status) {
    case 'found':
      return false;
    case 'off':
      return true; // the key wasn't set then
    case 'error':
    case 'limit':
      return age > 6 * 3600_000; // a wrong key or a full month: try again a few times a day
    case 'none':
    default:
      return age > 30 * 24 * 3600_000; // Google had no such place: check again monthly
  }
}

/**
 * Cron: find the Google place for linked venues that don't have one yet (the key was missing or
 * wrong when they were linked, or Google added the place later). A few per run.
 */
export async function fillMissingGooglePlaces(limit = 3) {
  if (!googleEnabled()) return { skipped: 'no_key' as const };
  const admin = getAdmin();
  const { data } = await admin
    .from('venues')
    .select('id, map_provider_id, map_place_url, listing_check')
    .is('deactivated_at', null)
    .not('map_provider_id', 'is', null)
    .is('google_place_id', null)
    .order('updated_at', { ascending: true })
    .limit(50);
  const due = (data ?? []).filter((v) => {
    const c = v.listing_check as ListingCheck | null;
    return !!c?.listing && googleRetryDue(c.google);
  });
  let found = 0;
  for (const v of due.slice(0, limit)) {
    const c = v.listing_check as ListingCheck;
    const g = await findGooglePlace({
      id: String(v.map_provider_id),
      category_group: '',
      url: (v.map_place_url as string | null) ?? `https://place.map.kakao.com/${v.map_provider_id}`,
      ...c.listing,
    });
    await admin
      .from('venues')
      .update({ google_place_id: g.id, listing_check: { ...c, google: { status: g.status, tried_at: new Date().toISOString() } } })
      .eq('id', v.id);
    if (g.id) found++;
    if (g.status === 'error' || g.status === 'limit') break; // same answer for the rest; try later
  }
  return { checked: Math.min(due.length, limit), found };
}

export type GooglePhoto = {
  url: string;
  width: number;
  height: number;
  authors: { name: string; uri: string | null }[];
  maps_uri: string | null;
};

export type GoogleLive =
  | { ok: true; hours: string[]; open_now: boolean | null; maps_uri: string | null; photos: GooglePhoto[] }
  | { ok: false; reason: 'off' | 'limit' | 'not_found' | 'failed' };

const httpsUrl = (u: unknown) => (typeof u === 'string' && /^https:\/\//.test(u) ? u : null);

/** Hours and a few photos from Google, fetched now and not stored anywhere. */
export async function googlePlaceLive(placeId: string, lang: 'ko' | 'en'): Promise<GoogleLive> {
  const key = googleKey();
  if (!key) return { ok: false, reason: 'off' };
  if (!/^[A-Za-z0-9_-]{10,300}$/.test(placeId)) return { ok: false, reason: 'not_found' };
  if (!(await allowGoogleCall('google_place_details_enterprise', DETAILS_CAP()))) return { ok: false, reason: 'limit' };
  try {
    const res = await fetch(`${GOOGLE_PLACES}/places/${placeId}?languageCode=${lang}&regionCode=KR`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'regularOpeningHours,photos,googleMapsUri' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return { ok: false, reason: 'not_found' };
    if (!res.ok) {
      console.error('[places] google details', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return { ok: false, reason: 'failed' };
    }
    const body = (await res.json()) as {
      regularOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean };
      googleMapsUri?: string;
      photos?: {
        name?: string;
        widthPx?: number;
        heightPx?: number;
        authorAttributions?: { displayName?: string; uri?: string }[];
        googleMapsUri?: string;
      }[];
    };
    const photos: GooglePhoto[] = [];
    for (const p of (body.photos ?? []).slice(0, MAX_GOOGLE_PHOTOS)) {
      if (!p.name || !/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(p.name)) continue;
      if (!(await allowGoogleCall('google_place_photos', PHOTOS_CAP()))) break;
      const m = await fetch(`${GOOGLE_PLACES}/${p.name}/media?maxWidthPx=800&skipHttpRedirect=true`, {
        headers: { 'X-Goog-Api-Key': key },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);
      const j = m && m.ok ? ((await m.json().catch(() => null)) as { photoUri?: string } | null) : null;
      const url = httpsUrl(j?.photoUri);
      if (!url) continue;
      photos.push({
        url,
        width: Number(p.widthPx) || 0,
        height: Number(p.heightPx) || 0,
        authors: (p.authorAttributions ?? [])
          .filter((a) => a.displayName)
          .map((a) => ({ name: String(a.displayName).slice(0, 80), uri: httpsUrl(a.uri) })),
        maps_uri: httpsUrl(p.googleMapsUri),
      });
    }
    return {
      ok: true,
      hours: (body.regularOpeningHours?.weekdayDescriptions ?? []).map((s) => String(s).slice(0, 120)).slice(0, 7),
      open_now: typeof body.regularOpeningHours?.openNow === 'boolean' ? body.regularOpeningHours.openNow : null,
      maps_uri: httpsUrl(body.googleMapsUri),
      photos,
    };
  } catch (e) {
    console.error('[places] google details failed:', e instanceof Error ? e.message : e);
    return { ok: false, reason: 'failed' };
  }
}

// ---------- Linking a listing to a venue ----------

type ClaimInput = { place_id?: unknown; place_name?: unknown; naver_map_url?: unknown };
type ClaimFail = { ok: false; error: string; status: number };
const fail = (error: string, status = 400): ClaimFail => ({ ok: false, error, status });

export type ClaimResult =
  | { ok: true; listing: MapPlace; check: ListingCheck; google: boolean; needs_review: boolean }
  | ClaimFail;

/**
 * Links a Kakao Map place to a venue (owner of the venue, or an admin). The place is looked up
 * again on Kakao, so a made-up id can't be saved. The listing's position becomes the venue's
 * map pin (QR check-in measures GPS against it).
 */
export async function claimListing(
  venueId: string,
  actor: { userId: string; isAdmin: boolean },
  input: ClaimInput,
): Promise<ClaimResult> {
  const placeId = typeof input.place_id === 'string' ? input.place_id.trim() : '';
  const placeName = typeof input.place_name === 'string' ? input.place_name.trim().slice(0, 100) : '';
  if (!/^\d{1,20}$/.test(placeId) || !placeName) return fail('listing_required');

  let naver: string | null | undefined;
  if (input.naver_map_url !== undefined) {
    const u = typeof input.naver_map_url === 'string' ? input.naver_map_url.trim() : '';
    if (u && !isNaverMapUrl(u)) return fail('bad_naver_url');
    naver = u || null;
  }

  const admin = getAdmin();
  const { data: venue } = await admin
    .from('venues')
    .select('id, owner_id, is_active, deactivated_at, business_name_display, contact_phone, road_address, jibun_address, address, map_provider_id, google_place_id')
    .eq('id', venueId)
    .maybeSingle();
  if (!venue || venue.deactivated_at) return fail('not_found', 404);
  if (!actor.isAdmin && venue.owner_id !== actor.userId) return fail('not_allowed', 403);

  const place = await findKakaoPlace(placeId, placeName, [venue.road_address, venue.address].filter(Boolean) as string[]);
  if (place === 'off') return fail('search_off', 503);
  if (place === 'failed') return fail('search_failed', 502);
  if (!place) return fail('listing_not_found');

  const [checked] = await markClaimed([place], venueId);
  if (checked.claimed) return fail('listing_taken', 409);

  const check = await checkListing(venue as VenueForCheck, place, actor.isAdmin ? 'admin' : 'owner');
  // An owner can't pick a place in another part of the country than their address.
  if (!actor.isAdmin && check.distance_m !== null && check.distance_m > TOO_FAR_M) return fail('listing_too_far');

  const sameListing = venue.map_provider_id === place.id;
  const google: GoogleMatch =
    sameListing && venue.google_place_id ? { id: venue.google_place_id as string, status: 'found' } : await findGooglePlace(place);
  const googleId = google.id;
  check.google = { status: google.status, tried_at: new Date().toISOString() };
  // Switching an approved venue to another place → Doreham checks it again.
  const needsReview = !actor.isAdmin && !!venue.is_active && !!venue.map_provider_id && !sameListing;

  const update: Record<string, unknown> = {
    map_provider: 'kakao',
    map_provider_id: place.id,
    map_place_url: place.url,
    listing_check: check,
    google_place_id: googleId,
    latitude: place.lat,
    longitude: place.lng,
  };
  if (naver !== undefined) update.naver_map_url = naver;
  if (needsReview) {
    update.is_active = false;
    update.claim_verified_at = null;
  }
  const { error } = await admin.from('venues').update(update).eq('id', venueId);
  if (error) {
    if (error.code === '23505') return fail('listing_taken', 409);
    console.error('[places] claim failed:', error);
    return fail('save_failed', 500);
  }
  return { ok: true, listing: place, check, google: !!googleId, needs_review: needsReview };
}

/**
 * After the owner changes the address or contact phone: compare again with the saved listing
 * and keep the map pin on the listing's position.
 */
export async function refreshListingCheck(venueId: string): Promise<void> {
  const admin = getAdmin();
  const { data: v } = await admin
    .from('venues')
    .select('business_name_display, contact_phone, road_address, jibun_address, address, listing_check, map_provider_id')
    .eq('id', venueId)
    .maybeSingle();
  const old = v?.listing_check as ListingCheck | null | undefined;
  if (!v || !v.map_provider_id || !old?.listing) return;
  const place: MapPlace = {
    id: String(v.map_provider_id),
    category_group: '',
    url: `https://place.map.kakao.com/${v.map_provider_id}`,
    ...old.listing,
  };
  const check = await checkListing(v as VenueForCheck, place, old.by);
  if (old.google) check.google = old.google;
  await admin
    .from('venues')
    .update({ listing_check: check, latitude: place.lat, longitude: place.lng })
    .eq('id', venueId);
}
