import 'server-only';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { ensureVenuePin } from '@/lib/server/geocode';
import { isAdminUser } from '@/lib/server/auth';
import { cancelEvent } from '@/lib/server/events';
import { validateBusinessNumber } from '@/lib/businessNumber';
import { CATEGORY_LABELS } from '@/app/venues/lib/types';

/**
 * Venue owners editing or deleting their own venue (My venues).
 * Writes go through here with the service role, so every field is whitelisted and checked.
 *
 * - Changing what identifies the business (legal name, registration number, address) on an
 *   approved venue sends it back to review: it is hidden until an admin approves it again.
 * - Deleting is a soft delete (past quests keep pointing at it): hidden everywhere, contact
 *   details and registration number cleared, photos and menu removed, perks switched off,
 *   upcoming venue events cancelled (people going are told).
 */

type Fail = { ok: false; error: string; status: number };
const fail = (error: string, status = 400): Fail => ({ ok: false, error, status });

export const MAX_VENUE_PHOTOS = 5;
export const MAX_MENU_ITEMS = 30;
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export type VenueMenuInput = {
  id?: string;
  name?: string;
  name_en?: string;
  description?: string;
  price_won?: number | null;
  is_signature?: boolean;
  photo_url?: string | null;
};

export type VenueUpdateInput = {
  business_name_display?: string;
  business_name_legal?: string;
  business_registration_number?: string;
  category?: string;
  business_opened_at?: string | null;
  contact_email?: string;
  contact_phone?: string;
  contact_name?: string;
  address?: string;
  city?: string;
  district?: string;
  zipcode?: string;
  road_address?: string;
  jibun_address?: string;
  building_name?: string;
  address_detail?: string;
  hours?: unknown;
  description?: string;
  description_en?: string;
  per_person_cost_won?: number | null;
  discount_offer?: string;
  discount_offer_en?: string;
  photo_urls?: unknown;
  menu_items?: unknown;
};

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
const orNull = (s: string) => (s ? s : null);

/** Public URL of a file in one of our storage buckets → its path, or null if it isn't one. */
export function storagePath(url: unknown, bucket: string): string | null {
  if (typeof url !== 'string') return null;
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '');
  const prefix = `${base}/storage/v1/object/public/${bucket}/`;
  if (!base || !url.startsWith(prefix)) return null;
  const path = decodeURIComponent(url.slice(prefix.length).split('?')[0]);
  return path && !path.includes('..') ? path : null;
}

function cleanHours(v: unknown): Record<string, { closed: boolean; open?: string; close?: string }> | null {
  if (!v || typeof v !== 'object') return null;
  const out: Record<string, { closed: boolean; open?: string; close?: string }> = {};
  const hhmm = (x: unknown) => (typeof x === 'string' && /^([01]\d|2[0-4]):[0-5]\d$/.test(x) ? x : undefined);
  for (const d of WEEKDAYS) {
    const day = (v as Record<string, unknown>)[d] as Record<string, unknown> | undefined;
    if (!day || typeof day !== 'object') return null;
    const closed = day.closed === true;
    out[d] = closed ? { closed: true } : { closed: false, open: hhmm(day.open) ?? '10:00', close: hhmm(day.close) ?? '22:00' };
  }
  return out;
}

/**
 * A file belongs to this venue's owner (or the person editing, e.g. an admin) only when it sits
 * in their own folder (`<user id>/…`, where uploads go). Anything else — another venue's photo,
 * someone else's upload — is never accepted and never deleted.
 */
function inFolders(path: string | null, folders: string[]): boolean {
  return !!path && folders.some((f) => !!f && path.startsWith(`${f}/`));
}

async function removeFiles(bucket: string, urls: (string | null | undefined)[], folders: string[]) {
  const paths = urls
    .map((u) => storagePath(u, bucket))
    .filter((p): p is string => inFolders(p, folders));
  if (paths.length === 0) return;
  try {
    await getAdmin().storage.from(bucket).remove(paths);
  } catch (e) {
    console.error(`venue file cleanup (${bucket}) failed:`, e instanceof Error ? e.message : e);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VenueRow = Record<string, any>;

async function loadOwnVenue(userId: string, venueId: string): Promise<{ ok: true; venue: VenueRow } | Fail> {
  const { data: venue } = await getAdmin().from('venues').select('*').eq('id', venueId).maybeSingle();
  if (!venue || venue.deactivated_at) return fail('not_found', 404);
  if (venue.owner_id !== userId && !(await isAdminUser(userId))) return fail('not_allowed', 403);
  return { ok: true, venue };
}

/** Full venue row + menu for the owner's edit form (the browser can't read the private columns). */
export async function getVenueForEdit(userId: string, venueId: string) {
  const own = await loadOwnVenue(userId, venueId);
  if (!own.ok) return own;
  const { data: menu } = await getAdmin()
    .from('venue_menu_items')
    .select('id, name, name_en, description, price_won, is_signature, photo_url, display_order')
    .eq('venue_id', venueId)
    .order('display_order', { ascending: true });
  return { ok: true as const, venue: own.venue, menu_items: menu ?? [] };
}

export async function updateVenue(userId: string, venueId: string, input: VenueUpdateInput) {
  const own = await loadOwnVenue(userId, venueId);
  if (!own.ok) return own;
  const venue = own.venue;

  const v: Record<string, unknown> = {
    business_name_display: text(input.business_name_display, 60),
    business_name_legal: text(input.business_name_legal, 100),
    business_registration_number: text(input.business_registration_number, 20).replace(/[-\s]/g, ''),
    category: text(input.category, 40),
    contact_email: text(input.contact_email, 120),
    contact_phone: text(input.contact_phone, 30),
    contact_name: orNull(text(input.contact_name, 40)),
    address: text(input.address, 300),
    city: text(input.city, 40).toLowerCase(),
    district: orNull(text(input.district, 60)),
    zipcode: orNull(text(input.zipcode, 10)),
    road_address: orNull(text(input.road_address, 200)),
    jibun_address: orNull(text(input.jibun_address, 200)),
    building_name: orNull(text(input.building_name, 100)),
    address_detail: orNull(text(input.address_detail, 100)),
    description: orNull(text(input.description, 2000)),
    description_en: orNull(text(input.description_en, 2000)),
    discount_offer: orNull(text(input.discount_offer, 300)),
    discount_offer_en: orNull(text(input.discount_offer_en, 300)),
  };
  if ((v.business_name_display as string).length < 1) return fail('name_required');
  if ((v.business_name_legal as string).length < 1) return fail('legal_name_required');
  if (!validateBusinessNumber(v.business_registration_number as string)) return fail('bad_registration_number');
  if (!Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, v.category as string)) return fail('bad_category');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.contact_email as string)) return fail('bad_email');
  if (!(v.contact_phone as string)) return fail('phone_required');
  if (!(v.address as string) || !(v.city as string)) return fail('address_required');

  const opened = input.business_opened_at;
  if (opened === null || opened === '' || opened === undefined) v.business_opened_at = null;
  else if (typeof opened === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(opened) && !Number.isNaN(Date.parse(opened))) v.business_opened_at = opened;
  else return fail('bad_date');

  const cost = input.per_person_cost_won;
  if (cost === null || cost === undefined || (cost as unknown) === '') v.per_person_cost_won = null;
  else {
    const n = Math.round(Number(cost));
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return fail('bad_cost');
    v.per_person_cost_won = n;
  }

  if (input.hours !== undefined) {
    const hours = cleanHours(input.hours);
    if (!hours) return fail('bad_hours');
    v.hours_json = hours;
  }

  // Photos: only files already on this venue, or new uploads in the owner's/editor's own folder.
  const folders = [venue.owner_id as string, userId];
  const oldPhotos: string[] = Array.isArray(venue.photo_urls) ? [...venue.photo_urls] : [];
  let photos = oldPhotos;
  if (input.photo_urls !== undefined) {
    if (!Array.isArray(input.photo_urls)) return fail('bad_photos');
    photos = [
      ...new Set(
        input.photo_urls.filter(
          (u): u is string => typeof u === 'string' && (oldPhotos.includes(u) || inFolders(storagePath(u, 'venue-photos'), folders)),
        ),
      ),
    ];
    if (photos.length > MAX_VENUE_PHOTOS) return fail('too_many_photos');
    v.photo_urls = photos;
  }

  // Menu (validated before anything is written)
  let menu: { id?: string; row: Record<string, unknown> }[] | null = null;
  const { data: currentMenu } = await getAdmin().from('venue_menu_items').select('photo_url').eq('venue_id', venueId);
  const oldMenuPhotos = new Set((currentMenu ?? []).map((m) => m.photo_url as string | null).filter((u): u is string => !!u));
  const menuPhotoOk = (u: unknown): u is string =>
    typeof u === 'string' && (oldMenuPhotos.has(u) || inFolders(storagePath(u, 'venue-menu-photos'), folders));
  if (input.menu_items !== undefined) {
    if (!Array.isArray(input.menu_items) || input.menu_items.length > MAX_MENU_ITEMS) return fail('bad_menu');
    menu = [];
    for (const [i, raw] of (input.menu_items as VenueMenuInput[]).entries()) {
      const name = text(raw?.name, 80);
      if (!name) return fail('menu_name_required');
      const price = raw?.price_won === null || raw?.price_won === undefined ? null : Math.round(Number(raw.price_won));
      if (price !== null && (!Number.isFinite(price) || price < 0 || price > 10_000_000)) return fail('bad_price');
      menu.push({
        id: typeof raw?.id === 'string' ? raw.id : undefined,
        row: {
          name,
          name_en: orNull(text(raw?.name_en, 80)),
          description: orNull(text(raw?.description, 300)),
          price_won: price,
          is_signature: raw?.is_signature === true,
          photo_url: menuPhotoOk(raw?.photo_url) ? raw!.photo_url : null,
          display_order: i,
        },
      });
    }
  }

  // What identifies the business changed on an approved venue → back to review.
  const norm = (x: unknown) => String(x ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  const identityChanged =
    norm(venue.business_name_legal) !== norm(v.business_name_legal) ||
    String(venue.business_registration_number ?? '').replace(/[-\s]/g, '') !== v.business_registration_number ||
    norm(venue.address) !== norm(v.address) ||
    norm(venue.city) !== norm(v.city);
  const needsReview = !!venue.is_active && identityChanged;
  if (needsReview) {
    v.is_active = false;
    v.claim_verified_at = null;
  }
  // A new address needs a new map pin (check-in GPS is measured against it). It's looked up
  // again when the venue is approved or at the next check-in.
  if (norm(venue.address) !== norm(v.address) || norm(venue.road_address) !== norm(v.road_address)) {
    v.latitude = null;
    v.longitude = null;
  }

  const admin = getAdmin();
  const { error: upErr } = await admin.from('venues').update(v).eq('id', venueId);
  if (upErr) {
    console.error('[venues] update failed:', upErr);
    return fail('save_failed', 500);
  }

  const removedFiles: { bucket: string; urls: string[] }[] = [{ bucket: 'venue-photos', urls: oldPhotos.filter((u) => !photos.includes(u)) }];

  if (menu) {
    const { data: existing } = await admin.from('venue_menu_items').select('id, photo_url').eq('venue_id', venueId);
    const existingIds = new Set((existing ?? []).map((m) => m.id as string));
    const keepIds = new Set(menu.filter((m) => m.id && existingIds.has(m.id)).map((m) => m.id as string));
    const gone = (existing ?? []).filter((m) => !keepIds.has(m.id as string));
    if (gone.length) await admin.from('venue_menu_items').delete().in('id', gone.map((m) => m.id as string));
    for (const m of menu) {
      if (m.id && existingIds.has(m.id)) await admin.from('venue_menu_items').update(m.row).eq('id', m.id).eq('venue_id', venueId);
      else await admin.from('venue_menu_items').insert({ ...m.row, venue_id: venueId });
    }
    const stillUsed = new Set(menu.map((m) => m.row.photo_url as string | null).filter(Boolean));
    removedFiles.push({
      bucket: 'venue-menu-photos',
      urls: (existing ?? []).map((m) => m.photo_url as string | null).filter((u): u is string => !!u && !stillUsed.has(u)),
    });
  }

  for (const f of removedFiles) await removeFiles(f.bucket, f.urls, folders);
  if (v.latitude === null) await ensureVenuePin(venueId).catch((e) => console.error('[venues] pin lookup failed:', e));
  return { ok: true as const, needs_review: needsReview };
}

export async function deleteVenue(userId: string, venueId: string) {
  const own = await loadOwnVenue(userId, venueId);
  if (!own.ok) return own;
  const venue = own.venue;
  const admin = getAdmin();
  const photos: string[] = Array.isArray(venue.photo_urls) ? [...venue.photo_urls] : [];

  // Upcoming events at this venue are cancelled (attendees get the usual notification).
  const { data: upcoming } = await admin
    .from('events')
    .select('id, creator_id')
    .eq('venue_id', venueId)
    .eq('status', 'published')
    .gt('starts_at', new Date().toISOString());
  for (const e of upcoming ?? []) await cancelEvent(e.creator_id as string, e.id as string);

  await admin.from('venue_perks').update({ is_active: false }).eq('venue_id', venueId);

  const { data: menu } = await admin.from('venue_menu_items').select('id, photo_url').eq('venue_id', venueId);
  if (menu && menu.length) await admin.from('venue_menu_items').delete().eq('venue_id', venueId);

  const { error: upErr } = await admin
    .from('venues')
    .update({
      deactivated_at: new Date().toISOString(),
      is_active: false,
      photo_urls: [],
      contact_email: null,
      contact_phone: null,
      contact_name: null,
      business_registration_number: null,
    })
    .eq('id', venueId);
  if (upErr) {
    console.error('[venues] delete failed:', upErr);
    return fail('delete_failed', 500);
  }

  const folders = [venue.owner_id as string, userId];
  await removeFiles('venue-photos', photos, folders);
  await removeFiles('venue-menu-photos', (menu ?? []).map((m) => m.photo_url as string | null), folders);
  return { ok: true as const };
}

/** Remove a venue's photo files (only files inside the owner's own folder). Used when an admin rejects a venue. */
export async function purgeVenueFiles(ownerId: string, photoUrls: unknown, menuPhotoUrls: (string | null | undefined)[]) {
  const photos = Array.isArray(photoUrls) ? (photoUrls as string[]) : [];
  await removeFiles('venue-photos', photos, [ownerId]);
  await removeFiles('venue-menu-photos', menuPhotoUrls, [ownerId]);
}
