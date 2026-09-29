import 'server-only';
import { createHash } from 'node:crypto';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { isAdminUser } from '@/lib/server/auth';
import { translateFields } from '@/lib/server/aiGateway';
import { levelOf } from '@/lib/server/points';
import { kstDateString } from '@/lib/server/time';

/**
 * Partner-venue perks for Doreham levels ("10% off drinks for 🐠 Fish and up").
 * Owners create them for their approved venues; members use one at the counter, at most once a day each.
 * The member's screen shows the venue's code of the day, which the owner also sees in "My venues",
 * so staff can tell a live screen from an old screenshot.
 */

export const MAX_PERKS_PER_VENUE = 5;

const PERK_COLUMNS =
  'id, venue_id, title, details, min_level, source_lang, translated_to, title_tr, details_tr, is_active, created_at';

type PerkRow = {
  id: string;
  venue_id: string;
  title: string;
  details: string | null;
  min_level: number;
  source_lang: string | null;
  translated_to: string | null;
  title_tr: string | null;
  details_tr: string | null;
  is_active: boolean;
  created_at: string;
};

type Fail = { ok: false; error: string; status: number };
const fail = (error: string, status = 400): Fail => ({ ok: false, error, status });

/** Four-digit code for a venue and Korean date. */
export function codeOfTheDay(venueId: string, date = kstDateString()) {
  const secret = process.env.PERK_CODE_SECRET || process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'doreham';
  const h = createHash('sha256').update(`${secret}:${venueId}:${date}`).digest();
  return String(h.readUInt32BE(0) % 10000).padStart(4, '0');
}

function clean(s: unknown, max: number) {
  return typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

async function translatePerk(id: string) {
  const admin = getAdmin();
  const { data: p } = await admin.from('venue_perks').select('id, title, details, translation_source_hash').eq('id', id).maybeSingle();
  if (!p) return;
  const hash = createHash('sha1').update(JSON.stringify([p.title, p.details ?? ''])).digest('hex').slice(0, 16);
  if (p.translation_source_hash === hash) return;
  const r = await translateFields({ title: p.title as string, details: (p.details as string | null) ?? '' }, { purpose: 'a partner venue\'s member discount or perk', timeoutMs: 7000 });
  if (!r) return;
  await admin
    .from('venue_perks')
    .update({
      source_lang: r.source,
      translated_to: r.target,
      title_tr: r.fields.title?.slice(0, 120) || null,
      details_tr: r.fields.details?.slice(0, 450) || null,
      translation_source_hash: hash,
    })
    .eq('id', id);
}

async function ownedVenue(userId: string, venueId: string) {
  const admin = getAdmin();
  const { data: v } = await admin.from('venues').select('id, owner_id, is_active, deactivated_at, business_name_display').eq('id', venueId).maybeSingle();
  if (!v) return null;
  if (v.owner_id !== userId && !(await isAdminUser(userId))) return null;
  return v;
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function perksForViewer(viewerId: string, opts: { venueId?: string | null } = {}) {
  const admin = getAdmin();
  let q = admin.from('venue_perks').select(PERK_COLUMNS).eq('is_active', true);
  if (opts.venueId) q = q.eq('venue_id', opts.venueId);
  const [{ data: perks }, level] = await Promise.all([q.order('min_level').limit(200), levelOf(viewerId)]);
  const rows = (perks ?? []) as PerkRow[];
  if (rows.length === 0) return { ok: true as const, level, perks: [] };

  const venueIds = [...new Set(rows.map((p) => p.venue_id))];
  const [{ data: venues }, { data: used }] = await Promise.all([
    admin.from('venues').select('id, business_name_display, city, category, address, photo_urls, is_active, deactivated_at').in('id', venueIds),
    admin.from('perk_redemptions').select('perk_id').eq('user_id', viewerId).eq('kst_date', kstDateString()).in('perk_id', rows.map((p) => p.id)),
  ]);
  const venueById = new Map((venues ?? []).filter((v) => v.is_active && !v.deactivated_at).map((v) => [v.id as string, v]));
  const usedToday = new Set((used ?? []).map((u) => u.perk_id as string));

  return {
    ok: true as const,
    level,
    perks: rows
      .filter((p) => venueById.has(p.venue_id))
      .map((p) => {
        const v = venueById.get(p.venue_id)!;
        return {
          id: p.id,
          title: p.title,
          details: p.details,
          min_level: p.min_level,
          source_lang: p.source_lang,
          translated_to: p.translated_to,
          title_tr: p.title_tr,
          details_tr: p.details_tr,
          unlocked: level >= p.min_level,
          used_today: usedToday.has(p.id),
          venue: {
            id: v.id as string,
            name: v.business_name_display as string,
            city: String(v.city ?? '').toLowerCase(),
            category: v.category as string,
            address: (v.address as string | null) ?? null,
            photo_url: ((v.photo_urls as string[] | null) ?? [])[0] ?? null,
          },
        };
      }),
  };
}

/** Use a perk now: records it (once per perk per day) and returns what to show at the counter. */
export async function redeemPerk(viewerId: string, perkId: string) {
  const admin = getAdmin();
  const { data: p } = await admin.from('venue_perks').select(PERK_COLUMNS).eq('id', perkId).maybeSingle();
  const perk = p as PerkRow | null;
  if (!perk || !perk.is_active) return fail('not_found', 404);
  const { data: v } = await admin.from('venues').select('id, business_name_display, is_active, deactivated_at').eq('id', perk.venue_id).maybeSingle();
  if (!v || !v.is_active || v.deactivated_at) return fail('not_found', 404);
  const [{ data: me }, level] = await Promise.all([
    admin.from('profiles').select('display_name, photo_url, onboarding_completed, deleted_at').eq('id', viewerId).maybeSingle(),
    levelOf(viewerId),
  ]);
  if (!me?.onboarding_completed || me.deleted_at) return fail('finish_onboarding', 403);
  if (level < perk.min_level) return fail('level_too_low', 403);

  const today = kstDateString();
  const { error } = await admin.from('perk_redemptions').insert({ perk_id: perk.id, user_id: viewerId, kst_date: today });
  const again = !!error && /duplicate key/i.test(error.message);
  if (error && !again) return fail(error.message, 500);
  const { data: rec } = await admin
    .from('perk_redemptions')
    .select('redeemed_at')
    .eq('perk_id', perk.id)
    .eq('user_id', viewerId)
    .eq('kst_date', today)
    .maybeSingle();

  return {
    ok: true as const,
    already_used_today: again,
    redeemed_at: (rec?.redeemed_at as string) ?? new Date().toISOString(),
    code: codeOfTheDay(perk.venue_id, today),
    perk: { id: perk.id, title: perk.title, details: perk.details, title_tr: perk.title_tr, details_tr: perk.details_tr, source_lang: perk.source_lang, translated_to: perk.translated_to, min_level: perk.min_level },
    venue: { id: v.id as string, name: v.business_name_display as string },
    member: { display_name: (me.display_name as string) ?? '', photo_url: (me.photo_url as string | null) ?? null, level },
  };
}

// ---------------------------------------------------------------------------
// Venue owners
// ---------------------------------------------------------------------------

export async function venuePerksForOwner(userId: string, venueId: string) {
  const v = await ownedVenue(userId, venueId);
  if (!v) return fail('not_allowed', 403);
  const admin = getAdmin();
  const { data: perks } = await admin.from('venue_perks').select(PERK_COLUMNS).eq('venue_id', venueId).order('created_at');
  const rows = (perks ?? []) as PerkRow[];
  const ids = rows.map((p) => p.id);
  const today = kstDateString();
  const { data: reds } = ids.length
    ? await admin.from('perk_redemptions').select('perk_id, kst_date').in('perk_id', ids).limit(5000)
    : { data: [] as { perk_id: string; kst_date: string }[] };
  const stat = (id: string) => {
    const mine = (reds ?? []).filter((r) => r.perk_id === id);
    return { today: mine.filter((r) => r.kst_date === today).length, total: mine.length };
  };
  return {
    ok: true as const,
    code_today: codeOfTheDay(venueId, today),
    max: MAX_PERKS_PER_VENUE,
    perks: rows.map((p) => ({ ...p, redemptions: stat(p.id) })),
  };
}

export async function createPerk(userId: string, venueId: string, input: { title?: string; details?: string; min_level?: number }) {
  const v = await ownedVenue(userId, venueId);
  if (!v) return fail('not_allowed', 403);
  if (!v.is_active || v.deactivated_at) return fail('venue_not_approved', 409);
  const title = clean(input.title, 80);
  if (title.length < 3) return fail('title_too_short');
  const minLevel = Math.round(Number(input.min_level ?? 2));
  if (!Number.isFinite(minLevel) || minLevel < 1 || minLevel > 6) return fail('bad_level');
  const admin = getAdmin();
  const { count } = await admin.from('venue_perks').select('id', { count: 'exact', head: true }).eq('venue_id', venueId);
  if ((count ?? 0) >= MAX_PERKS_PER_VENUE) return fail('too_many_perks', 429);
  const { data, error } = await admin
    .from('venue_perks')
    .insert({ venue_id: venueId, title, details: clean(input.details, 300) || null, min_level: minLevel })
    .select('id')
    .single();
  if (error || !data) return fail(`save_failed: ${error?.message}`, 500);
  await translatePerk(data.id as string);
  return { ok: true as const, id: data.id as string };
}

export async function updatePerk(
  userId: string,
  venueId: string,
  perkId: string,
  input: { title?: string; details?: string | null; min_level?: number; is_active?: boolean },
) {
  const v = await ownedVenue(userId, venueId);
  if (!v) return fail('not_allowed', 403);
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const t = clean(input.title, 80);
    if (t.length < 3) return fail('title_too_short');
    patch.title = t;
  }
  if (input.details !== undefined) patch.details = clean(input.details, 300) || null;
  if (input.min_level !== undefined) {
    const n = Math.round(Number(input.min_level));
    if (!Number.isFinite(n) || n < 1 || n > 6) return fail('bad_level');
    patch.min_level = n;
  }
  if (input.is_active !== undefined) patch.is_active = !!input.is_active;
  if (Object.keys(patch).length === 0) return { ok: true as const };
  const { data, error } = await getAdmin().from('venue_perks').update(patch).eq('id', perkId).eq('venue_id', venueId).select('id');
  if (error) return fail(error.message, 500);
  if (!data || data.length === 0) return fail('not_found', 404);
  if (patch.title !== undefined || patch.details !== undefined) await translatePerk(perkId);
  return { ok: true as const };
}

export async function deletePerk(userId: string, venueId: string, perkId: string) {
  const v = await ownedVenue(userId, venueId);
  if (!v) return fail('not_allowed', 403);
  const { error } = await getAdmin().from('venue_perks').delete().eq('id', perkId).eq('venue_id', venueId);
  return error ? fail(error.message, 500) : { ok: true as const };
}
