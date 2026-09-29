import 'server-only';
import { after } from 'next/server';
import { createHash } from 'node:crypto';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { isAdminUser } from '@/lib/server/auth';
import { createNotification, createNotifications } from '@/lib/notifications';
import { chatJson, detectLang, gatewayToken } from '@/lib/server/aiGateway';
import { formatKst, kstDateString } from '@/lib/server/time';
import { EVENT_CATEGORY_SLUGS, EVENT_REPORT_REASONS } from '@/lib/eventCategories';
import { KOREAN_CITIES } from '@/lib/cities';

/**
 * Community events (Karrot-style city feed).
 * Hosts: users (meetups), venue owners (their own approved venue), Doreham admin (curated, can feature).
 * All writes go through here (service role) so we can validate, translate KO↔EN and moderate.
 */

export const LIMITS = {
  userUpcoming: 3, // open events one person can host at a time
  venueUpcoming: 10, // per venue
  minLeadMinutes: 30, // an event must start at least this far ahead
  maxAheadDays: 120,
  maxHours: 24,
  hideAfterReports: 3, // distinct reporters → hidden until an admin looks
  commentsPerUserPerEvent: 30,
};

const CITY_SLUGS = new Set(KOREAN_CITIES.map((c) => c.slug));
const REPORT_REASONS = new Set<string>(EVENT_REPORT_REASONS.map((r) => r.slug));

export type EventInput = {
  title?: string;
  description?: string;
  category?: string;
  city?: string;
  place_name?: string;
  address?: string | null;
  starts_at?: string;
  ends_at?: string | null;
  capacity?: number | null;
  fee_text?: string | null;
  host_as?: 'user' | 'venue' | 'admin';
  venue_id?: string | null;
  is_featured?: boolean;
};

type Fail = { ok: false; error: string; status: number };
const fail = (error: string, status = 400): Fail => ({ ok: false, error, status });

const EVENT_COLUMNS =
  'id, creator_id, host_kind, venue_id, title, description, category, city, place_name, address, starts_at, ends_at, capacity, fee_text, source_lang, translated_to, title_tr, description_tr, place_name_tr, is_featured, status, cancelled_at, hidden_reason, created_at, updated_at';

type EventRow = {
  id: string;
  creator_id: string;
  host_kind: 'user' | 'venue' | 'admin';
  venue_id: string | null;
  title: string;
  description: string;
  category: string;
  city: string;
  place_name: string;
  address: string | null;
  starts_at: string;
  ends_at: string | null;
  capacity: number | null;
  fee_text: string | null;
  source_lang: string | null;
  translated_to: string | null;
  title_tr: string | null;
  description_tr: string | null;
  place_name_tr: string | null;
  is_featured: boolean;
  status: 'published' | 'cancelled' | 'hidden';
  cancelled_at: string | null;
  hidden_reason: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Who can host what
// ---------------------------------------------------------------------------

export async function hostContext(userId: string) {
  const admin = getAdmin();
  const [{ data: profile }, isAdmin, { data: venues }, { data: frozen }] = await Promise.all([
    admin.from('profiles').select('onboarding_completed, deleted_at, home_district').eq('id', userId).maybeSingle(),
    isAdminUser(userId),
    admin.from('venues').select('id, business_name_display, city').eq('owner_id', userId).eq('is_active', true).is('deactivated_at', null),
    admin.from('user_penalties').select('freeze_until').eq('user_id', userId).gt('freeze_until', new Date().toISOString()).limit(1),
  ]);
  return {
    canHost: !!profile && !profile.deleted_at && !!profile.onboarding_completed && !(frozen && frozen.length > 0),
    frozen: !!(frozen && frozen.length > 0),
    onboarded: !!profile?.onboarding_completed,
    homeDistrict: (profile?.home_district as string | null) ?? null,
    isAdmin,
    venues: (venues ?? []).map((v) => ({ id: v.id as string, name: v.business_name_display as string, city: String(v.city ?? '').toLowerCase() })),
  };
}

function clean(s: unknown, max: number): string {
  return typeof s === 'string' ? s.replace(/\s+\n/g, '\n').trim().slice(0, max) : '';
}

function validate(
  input: EventInput,
  ctx: Awaited<ReturnType<typeof hostContext>>,
  opts: { partial?: boolean } = {},
): { ok: true; value: Record<string, unknown> } | Fail {
  const v: Record<string, unknown> = {};
  const has = (k: keyof EventInput) => !opts.partial || input[k] !== undefined;

  if (has('title')) {
    const t = clean(input.title, 80);
    if (t.length < 3) return fail('title_too_short');
    v.title = t;
  }
  if (has('description')) {
    const d = clean(input.description, 2000);
    if (d.length < 10) return fail('description_too_short');
    v.description = d;
  }
  if (has('category')) {
    if (!input.category || !EVENT_CATEGORY_SLUGS.has(input.category)) return fail('bad_category');
    v.category = input.category;
  }
  if (has('city')) {
    if (!input.city || !CITY_SLUGS.has(input.city)) return fail('bad_city');
    v.city = input.city;
  }
  if (has('place_name')) {
    const p = clean(input.place_name, 100);
    if (p.length < 2) return fail('place_required');
    v.place_name = p;
  }
  if (has('address')) v.address = clean(input.address, 200) || null;
  if (has('fee_text')) v.fee_text = clean(input.fee_text, 60) || null;
  if (has('capacity')) {
    if (input.capacity === null || input.capacity === undefined || (input.capacity as unknown) === '') v.capacity = null;
    else {
      const c = Math.round(Number(input.capacity));
      if (!Number.isFinite(c) || c < 2 || c > 500) return fail('bad_capacity');
      v.capacity = c;
    }
  }
  if (has('starts_at') || has('ends_at')) {
    const start = new Date(String(input.starts_at ?? ''));
    if (Number.isNaN(start.getTime())) return fail('bad_start');
    if (start.getTime() < Date.now() + LIMITS.minLeadMinutes * 60_000) return fail('start_too_soon');
    if (start.getTime() > Date.now() + LIMITS.maxAheadDays * 86_400_000) return fail('start_too_far');
    v.starts_at = start.toISOString();
    if (input.ends_at) {
      const end = new Date(String(input.ends_at));
      if (Number.isNaN(end.getTime()) || end <= start) return fail('bad_end');
      if (end.getTime() - start.getTime() > LIMITS.maxHours * 3_600_000) return fail('too_long');
      v.ends_at = end.toISOString();
    } else v.ends_at = null;
  }
  if (!opts.partial) {
    const hostAs = input.host_as ?? 'user';
    if (hostAs === 'admin') {
      if (!ctx.isAdmin) return fail('not_admin', 403);
      v.host_kind = 'admin';
      v.venue_id = null;
    } else if (hostAs === 'venue') {
      const venue = ctx.venues.find((x) => x.id === input.venue_id);
      if (!venue) return fail('not_your_venue', 403);
      v.host_kind = 'venue';
      v.venue_id = venue.id;
    } else {
      v.host_kind = 'user';
      v.venue_id = null;
    }
  }
  if (input.is_featured !== undefined) {
    if (!ctx.isAdmin) return fail('not_admin', 403);
    v.is_featured = !!input.is_featured;
  }
  return { ok: true, value: v };
}

// ---------------------------------------------------------------------------
// Translation (KO ↔ EN), best-effort
// ---------------------------------------------------------------------------

function eventHash(e: { title: string; description: string; place_name: string }) {
  return createHash('sha1').update(JSON.stringify([e.title, e.description, e.place_name])).digest('hex').slice(0, 16);
}

const LANG_NAME: Record<string, string> = { ko: 'Korean', en: 'English' };

export async function translateEvent(eventId: string, timeoutMs = 8000) {
  const admin = getAdmin();
  const { data: e } = await admin
    .from('events')
    .select('id, title, description, place_name, translation_source_hash')
    .eq('id', eventId)
    .maybeSingle();
  if (!e) return { ok: false as const, error: 'not_found' };
  const hash = eventHash(e as { title: string; description: string; place_name: string });
  if (e.translation_source_hash === hash) return { ok: true as const, skipped: 'current' };

  const source = detectLang(`${e.title}\n${e.description}`);
  const target = source === 'en' ? 'ko' : 'en';
  const token = await gatewayToken();
  if (!token) return { ok: false as const, error: 'no_gateway_credentials' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { json, model } = await chatJson({
      system: `You translate community event posts for Doreham, an app where foreign residents and Koreans in Korea meet in small groups.
Translate every field into natural ${LANG_NAME[target]}.
Rules: translate faithfully, do not add or remove information; keep names of people, brands and places recognisable (romanize Korean names in English, e.g. 아산 = Asan; keep English names in Korean as they are commonly written); keep dates, times, prices, phone numbers and links exactly; keep line breaks.
Reply with JSON only: {"title": "...", "description": "...", "place_name": "..."}`,
      user: JSON.stringify({ title: e.title, description: e.description, place_name: e.place_name }),
      token,
      signal: controller.signal,
      maxTokens: 2500,
    });
    const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
    if (!str(json.title)) return { ok: false as const, error: `${model}: empty` };
    await admin
      .from('events')
      .update({
        source_lang: source,
        translated_to: target,
        title_tr: str(json.title).slice(0, 120),
        description_tr: str(json.description).slice(0, 3000) || null,
        place_name_tr: str(json.place_name).slice(0, 150) || null,
        translation_source_hash: hash,
      })
      .eq('id', eventId);
    return { ok: true as const, model };
  } catch (err: unknown) {
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Create / update / cancel / moderate
// ---------------------------------------------------------------------------

export async function createEvent(userId: string, input: EventInput) {
  const ctx = await hostContext(userId);
  if (!ctx.onboarded) return fail('finish_onboarding', 403);
  if (!ctx.canHost) return fail(ctx.frozen ? 'account_frozen' : 'cannot_host', 403);
  const r = validate(input, ctx);
  if (!r.ok) return r;

  const admin = getAdmin();
  const nowIso = new Date().toISOString();
  if (r.value.host_kind === 'user') {
    const { count } = await admin
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', userId)
      .eq('host_kind', 'user')
      .eq('status', 'published')
      .gt('starts_at', nowIso);
    if ((count ?? 0) >= LIMITS.userUpcoming) return fail('too_many_events', 429);
  } else if (r.value.host_kind === 'venue') {
    const { count } = await admin
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('venue_id', r.value.venue_id as string)
      .eq('status', 'published')
      .gt('starts_at', nowIso);
    if ((count ?? 0) >= LIMITS.venueUpcoming) return fail('too_many_events', 429);
  }

  const { data: row, error } = await admin
    .from('events')
    .insert({ ...r.value, creator_id: userId, is_featured: ctx.isAdmin ? !!input.is_featured : false })
    .select('id')
    .single();
  if (error || !row) return fail(`save_failed: ${error?.message}`, 500);

  // The host is going to their own event.
  await admin.from('event_attendees').insert({ event_id: row.id, user_id: userId });
  await translateEvent(row.id as string, 8000);
  return { ok: true as const, id: row.id as string };
}

async function loadEvent(id: string): Promise<EventRow | null> {
  const { data } = await getAdmin().from('events').select(EVENT_COLUMNS).eq('id', id).maybeSingle();
  return (data as EventRow | null) ?? null;
}

async function attendeeIds(eventId: string): Promise<string[]> {
  const { data } = await getAdmin().from('event_attendees').select('user_id').eq('event_id', eventId);
  return (data ?? []).map((a) => a.user_id as string);
}

export async function updateEvent(userId: string, id: string, input: EventInput) {
  const e = await loadEvent(id);
  if (!e) return fail('not_found', 404);
  const ctx = await hostContext(userId);
  const isHost = e.creator_id === userId;
  if (!isHost && !ctx.isAdmin) return fail('not_allowed', 403);
  if (e.status === 'cancelled') return fail('event_cancelled', 409);
  if (e.status === 'hidden' && !ctx.isAdmin) return fail('event_hidden', 409);

  // starts_at/ends_at are validated together; a partial edit of one must send both.
  if ((input.starts_at !== undefined || input.ends_at !== undefined) && input.starts_at === undefined) input.starts_at = e.starts_at;
  const r = validate(input, ctx, { partial: true });
  if (!r.ok) return r;
  if (Object.keys(r.value).length === 0) return { ok: true as const, id };

  const { error } = await getAdmin().from('events').update(r.value).eq('id', id);
  if (error) return fail(`save_failed: ${error.message}`, 500);

  const movedTime = r.value.starts_at !== undefined && r.value.starts_at !== e.starts_at;
  const movedPlace = r.value.place_name !== undefined && r.value.place_name !== e.place_name;
  if (movedTime || movedPlace) {
    const people = (await attendeeIds(id)).filter((u) => u !== userId);
    const when = formatKst(String(r.value.starts_at ?? e.starts_at), 'en');
    const whenKo = formatKst(String(r.value.starts_at ?? e.starts_at), 'ko');
    const place = String(r.value.place_name ?? e.place_name);
    after(async () => {
      await createNotifications(
        people.map((uid) => ({
          user_id: uid,
          type: 'event_updated' as const,
          title_en: `📅 "${e.title}" changed`,
          title_ko: `📅 "${e.title}" 일정이 바뀌었어요`,
          body_en: `Now: ${when} · ${place}`,
          body_ko: `변경: ${whenKo} · ${place}`,
          action_url: `/events/${id}`,
          is_important: true,
        })),
      );
    });
  }
  await translateEvent(id, 8000);
  return { ok: true as const, id };
}

export async function cancelEvent(userId: string, id: string) {
  const e = await loadEvent(id);
  if (!e) return fail('not_found', 404);
  const isAdmin = await isAdminUser(userId);
  if (e.creator_id !== userId && !isAdmin) return fail('not_allowed', 403);
  if (e.status === 'cancelled') return { ok: true as const };

  await getAdmin().from('events').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', id);
  const people = (await attendeeIds(id)).filter((u) => u !== e.creator_id);
  after(async () => {
    await createNotifications(
      people.map((uid) => ({
        user_id: uid,
        type: 'event_cancelled' as const,
        title_en: `❌ "${e.title}" was cancelled`,
        title_ko: `❌ "${e.title}" 이벤트가 취소됐어요`,
        body_en: 'The host cancelled this event. Find another one on the Events page.',
        body_ko: '주최자가 이벤트를 취소했어요. 이벤트 페이지에서 다른 이벤트를 찾아보세요.',
        action_url: '/events',
        is_important: true,
      })),
    );
  });
  return { ok: true as const };
}

/** Admin: feature/unfeature, hide/restore. */
export async function moderateEvent(userId: string, id: string, action: 'feature' | 'unfeature' | 'hide' | 'restore', reason?: string) {
  if (!(await isAdminUser(userId))) return fail('not_admin', 403);
  const admin = getAdmin();
  const patch: Record<string, unknown> =
    action === 'feature' ? { is_featured: true }
    : action === 'unfeature' ? { is_featured: false }
    : action === 'hide' ? { status: 'hidden', hidden_reason: reason || 'admin' }
    : { status: 'published', hidden_reason: null };
  let q = admin.from('events').update(patch).eq('id', id);
  // Hiding never touches a cancelled event; restoring only un-hides (it never un-cancels).
  if (action === 'hide') q = q.eq('status', 'published');
  if (action === 'restore') q = q.eq('status', 'hidden');
  const { error } = await q;
  if (error) return fail(error.message, 500);
  if (action === 'restore' || action === 'hide') {
    await admin
      .from('event_reports')
      .update({ resolved_at: new Date().toISOString(), resolution: action === 'hide' ? 'hidden' : 'kept' })
      .eq('event_id', id)
      .is('resolved_at', null);
  }
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Going / comments / reports
// ---------------------------------------------------------------------------

export async function setGoing(userId: string, id: string, going: boolean) {
  const e = await loadEvent(id);
  if (!e || e.status === 'hidden') return fail('not_found', 404);
  if (e.status === 'cancelled') return fail('event_cancelled', 409);
  if (new Date(e.starts_at).getTime() < Date.now()) return fail('event_started', 409);
  const admin = getAdmin();

  if (!going) {
    if (e.creator_id === userId) return fail('host_cannot_leave', 409);
    await admin.from('event_attendees').delete().eq('event_id', id).eq('user_id', userId);
    return { ok: true as const, going: false };
  }

  const { data: me } = await admin.from('profiles').select('onboarding_completed, display_name').eq('id', userId).maybeSingle();
  if (!me?.onboarding_completed) return fail('finish_onboarding', 403);
  if (e.capacity) {
    const { count } = await admin.from('event_attendees').select('user_id', { count: 'exact', head: true }).eq('event_id', id);
    if ((count ?? 0) >= e.capacity) return fail('event_full', 409);
  }
  const { error } = await admin.from('event_attendees').insert({ event_id: id, user_id: userId });
  if (error && !/duplicate key/i.test(error.message)) return fail(error.message, 500);
  if (!error && e.creator_id !== userId) {
    const name = (me.display_name as string) || 'Someone';
    after(async () => {
      await createNotification({
        user_id: e.creator_id,
        type: 'event_joined',
        title_en: `🙋 ${name} is going to "${e.title}"`,
        title_ko: `🙋 ${name}님이 "${e.title}"에 참여해요`,
        action_url: `/events/${id}`,
      });
    });
  }
  return { ok: true as const, going: true };
}

export async function addComment(userId: string, id: string, bodyRaw: string) {
  const body = clean(bodyRaw, 500);
  if (!body) return fail('empty_comment');
  const e = await loadEvent(id);
  if (!e || e.status === 'hidden') return fail('not_found', 404);
  if (e.status === 'cancelled') return fail('event_cancelled', 409);
  const admin = getAdmin();
  const { data: me } = await admin.from('profiles').select('onboarding_completed, display_name').eq('id', userId).maybeSingle();
  if (!me?.onboarding_completed) return fail('finish_onboarding', 403);
  const { count } = await admin
    .from('event_comments')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', id)
    .eq('user_id', userId);
  if ((count ?? 0) >= LIMITS.commentsPerUserPerEvent) return fail('too_many_comments', 429);

  const { data: row, error } = await admin.from('event_comments').insert({ event_id: id, user_id: userId, body }).select('id').single();
  if (error || !row) return fail(`save_failed: ${error?.message}`, 500);
  if (e.creator_id !== userId) {
    const name = (me.display_name as string) || 'Someone';
    after(async () => {
      await createNotification({
        user_id: e.creator_id,
        type: 'event_comment',
        title_en: `💬 ${name} commented on "${e.title}"`,
        title_ko: `💬 ${name}님이 "${e.title}"에 댓글을 남겼어요`,
        body_en: body.slice(0, 120),
        body_ko: body.slice(0, 120),
        action_url: `/events/${id}`,
      });
    });
  }
  return { ok: true as const, id: row.id as string };
}

export async function deleteComment(userId: string, commentId: string) {
  const admin = getAdmin();
  const { data: c } = await admin.from('event_comments').select('id, user_id, event_id, events!inner(creator_id)').eq('id', commentId).maybeSingle();
  if (!c) return fail('not_found', 404);
  const hostId = (c.events as unknown as { creator_id: string }).creator_id;
  if (c.user_id !== userId && hostId !== userId && !(await isAdminUser(userId))) return fail('not_allowed', 403);
  await admin.from('event_comments').update({ deleted_at: new Date().toISOString() }).eq('id', commentId);
  return { ok: true as const };
}

export async function reportEvent(userId: string, id: string, input: { reason?: string; details?: string; comment_id?: string | null }) {
  if (!input.reason || !REPORT_REASONS.has(input.reason)) return fail('bad_reason');
  const e = await loadEvent(id);
  if (!e) return fail('not_found', 404);
  const admin = getAdmin();
  const commentId = input.comment_id || null;
  const { error } = await admin.from('event_reports').insert({
    event_id: id,
    comment_id: commentId,
    reporter_id: userId,
    reason: input.reason,
    details: clean(input.details, 500) || null,
  });
  if (error && !/duplicate key/i.test(error.message)) return fail(error.message, 500);

  // Enough distinct people → hide until an admin looks (events) / remove (comments).
  let q = admin.from('event_reports').select('reporter_id', { count: 'exact', head: true }).eq('event_id', id).is('resolved_at', null);
  q = commentId ? q.eq('comment_id', commentId) : q.is('comment_id', null);
  const { count } = await q;
  if ((count ?? 0) >= LIMITS.hideAfterReports) {
    if (commentId) await admin.from('event_comments').update({ deleted_at: new Date().toISOString() }).eq('id', commentId);
    else if (e.status === 'published') await admin.from('events').update({ status: 'hidden', hidden_reason: 'reports' }).eq('id', id);
  }
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

type Person = { id: string; display_name: string; photo_url: string | null };

async function peopleById(ids: string[]): Promise<Map<string, Person>> {
  if (ids.length === 0) return new Map();
  const { data } = await getAdmin().from('profiles').select('id, display_name, photo_url').in('id', [...new Set(ids)]);
  return new Map((data ?? []).map((p) => [p.id as string, { id: p.id as string, display_name: (p.display_name as string) ?? '', photo_url: (p.photo_url as string | null) ?? null }]));
}

async function venuesById(ids: string[]) {
  if (ids.length === 0) return new Map<string, { id: string; name: string; photo_url: string | null }>();
  const { data } = await getAdmin().from('venues').select('id, business_name_display, photo_urls').in('id', [...new Set(ids)]);
  return new Map(
    (data ?? []).map((v) => [
      v.id as string,
      { id: v.id as string, name: v.business_name_display as string, photo_url: ((v.photo_urls as string[] | null) ?? [])[0] ?? null },
    ]),
  );
}

function publicEvent(e: EventRow) {
  return {
    id: e.id,
    host_kind: e.host_kind,
    title: e.title,
    description: e.description,
    category: e.category,
    city: e.city,
    place_name: e.place_name,
    address: e.address,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    capacity: e.capacity,
    fee_text: e.fee_text,
    source_lang: e.source_lang,
    translated_to: e.translated_to,
    title_tr: e.title_tr,
    description_tr: e.description_tr,
    place_name_tr: e.place_name_tr,
    is_featured: e.is_featured,
    status: e.status,
    created_at: e.created_at,
  };
}

export async function listEvents(viewerId: string, opts: { city?: string | null; category?: string | null; scope?: 'upcoming' | 'mine' | 'past' }) {
  const admin = getAdmin();
  const scope = opts.scope ?? 'upcoming';
  const nowIso = new Date(Date.now() - 2 * 3_600_000).toISOString(); // keep events that started <2h ago

  let ids: string[] | null = null;
  if (scope === 'mine') {
    const [{ data: hosted }, { data: going }] = await Promise.all([
      admin.from('events').select('id').eq('creator_id', viewerId),
      admin.from('event_attendees').select('event_id').eq('user_id', viewerId),
    ]);
    ids = [...new Set([...(hosted ?? []).map((r) => r.id as string), ...(going ?? []).map((r) => r.event_id as string)])];
    if (ids.length === 0) return [];
  }

  let q = admin.from('events').select(EVENT_COLUMNS);
  if (ids) q = q.in('id', ids).neq('status', 'hidden');
  else q = q.eq('status', 'published');
  if (scope === 'past') q = q.lt('starts_at', nowIso).order('starts_at', { ascending: false });
  else if (scope === 'upcoming') q = q.gte('starts_at', nowIso).order('starts_at', { ascending: true });
  else q = q.order('starts_at', { ascending: false });
  if (opts.city) q = q.eq('city', opts.city);
  if (opts.category) q = q.eq('category', opts.category);
  const { data } = await q.limit(100);
  const rows = (data ?? []) as EventRow[];
  if (rows.length === 0) return [];

  const eventIds = rows.map((r) => r.id);
  const [{ data: att }, hosts, venues] = await Promise.all([
    admin.from('event_attendees').select('event_id, user_id').in('event_id', eventIds),
    peopleById(rows.map((r) => r.creator_id)),
    venuesById(rows.map((r) => r.venue_id).filter(Boolean) as string[]),
  ]);
  const count = new Map<string, number>();
  const mine = new Set<string>();
  for (const a of att ?? []) {
    count.set(a.event_id as string, (count.get(a.event_id as string) ?? 0) + 1);
    if (a.user_id === viewerId) mine.add(a.event_id as string);
  }

  const out = rows.map((e) => ({
    ...publicEvent(e),
    host: hostInfo(e, hosts, venues),
    going_count: count.get(e.id) ?? 0,
    viewer_going: mine.has(e.id),
    viewer_is_host: e.creator_id === viewerId,
  }));
  // Featured first in the upcoming feed.
  if (scope === 'upcoming') out.sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || a.starts_at.localeCompare(b.starts_at));
  return out;
}

function hostInfo(e: EventRow, hosts: Map<string, Person>, venues: Map<string, { id: string; name: string; photo_url: string | null }>) {
  if (e.host_kind === 'admin') return { kind: 'admin' as const, name: 'Doreham', photo_url: null, profile_id: null, venue_id: null };
  if (e.host_kind === 'venue' && e.venue_id && venues.get(e.venue_id)) {
    const v = venues.get(e.venue_id)!;
    return { kind: 'venue' as const, name: v.name, photo_url: v.photo_url, profile_id: null, venue_id: v.id };
  }
  const p = hosts.get(e.creator_id);
  return { kind: 'user' as const, name: p?.display_name ?? '', photo_url: p?.photo_url ?? null, profile_id: e.creator_id, venue_id: null };
}

export async function getEvent(viewerId: string, id: string) {
  const e = await loadEvent(id);
  if (!e) return fail('not_found', 404);
  const isAdmin = await isAdminUser(viewerId);
  const isHost = e.creator_id === viewerId;
  if (e.status === 'hidden' && !isHost && !isAdmin) return fail('not_found', 404);

  const admin = getAdmin();
  const [{ data: att }, { data: comments }] = await Promise.all([
    admin.from('event_attendees').select('user_id, joined_at').eq('event_id', id).order('joined_at'),
    admin.from('event_comments').select('id, user_id, body, created_at').eq('event_id', id).is('deleted_at', null).order('created_at').limit(300),
  ]);
  const attendeeIdsList = (att ?? []).map((a) => a.user_id as string);
  const viewerGoing = attendeeIdsList.includes(viewerId);
  const people = await peopleById([e.creator_id, ...attendeeIdsList, ...(comments ?? []).map((c) => c.user_id as string)]);
  const venues = await venuesById(e.venue_id ? [e.venue_id] : []);

  // Who's going is visible to the host, admins and people going; others see the count.
  const canSeeAttendees = isHost || isAdmin || viewerGoing;
  let reports: unknown[] | undefined;
  if (isAdmin) {
    const { data: r } = await admin.from('event_reports').select('id, comment_id, reason, details, created_at, resolved_at').eq('event_id', id).order('created_at', { ascending: false });
    reports = r ?? [];
  }

  return {
    ok: true as const,
    event: {
      ...publicEvent(e),
      hidden_reason: isHost || isAdmin ? e.hidden_reason : null,
      host: hostInfo(e, people, venues),
      going_count: attendeeIdsList.length,
      is_full: !!e.capacity && attendeeIdsList.length >= e.capacity,
    },
    attendees: canSeeAttendees ? attendeeIdsList.map((uid) => people.get(uid)).filter(Boolean) : [],
    comments: (comments ?? []).map((c) => ({
      id: c.id as string,
      body: c.body as string,
      created_at: c.created_at as string,
      author: people.get(c.user_id as string) ?? { id: c.user_id as string, display_name: '', photo_url: null },
      can_delete: c.user_id === viewerId || isHost || isAdmin,
    })),
    viewer: { going: viewerGoing, is_host: isHost, is_admin: isAdmin, can_edit: (isHost || isAdmin) && e.status !== 'cancelled' },
    reports,
  };
}

/** For the edit form: the raw event, host/admin only. */
export async function getEventForEdit(viewerId: string, id: string) {
  const e = await loadEvent(id);
  if (!e) return fail('not_found', 404);
  if (e.creator_id !== viewerId && !(await isAdminUser(viewerId))) return fail('not_allowed', 403);
  return { ok: true as const, event: { ...publicEvent(e), venue_id: e.venue_id } };
}

/** Admin moderation queue: hidden events and events/comments with open reports. */
export async function moderationQueue(viewerId: string) {
  if (!(await isAdminUser(viewerId))) return fail('not_admin', 403);
  const admin = getAdmin();
  const [{ data: reports }, { data: hidden }] = await Promise.all([
    admin.from('event_reports').select('id, event_id, comment_id, reason, details, created_at').is('resolved_at', null).order('created_at', { ascending: false }).limit(200),
    admin.from('events').select(EVENT_COLUMNS).eq('status', 'hidden').order('updated_at', { ascending: false }).limit(100),
  ]);
  const eventIds = [...new Set([...(reports ?? []).map((r) => r.event_id as string), ...(hidden ?? []).map((e) => (e as EventRow).id)])];
  const { data: events } = eventIds.length ? await admin.from('events').select(EVENT_COLUMNS).in('id', eventIds) : { data: [] };
  const commentIds = (reports ?? []).map((r) => r.comment_id as string | null).filter(Boolean) as string[];
  const { data: comments } = commentIds.length
    ? await admin.from('event_comments').select('id, body, user_id, deleted_at').in('id', commentIds)
    : { data: [] };
  return {
    ok: true as const,
    events: (events ?? []).map((e) => ({ ...publicEvent(e as EventRow), hidden_reason: (e as EventRow).hidden_reason })),
    reports: reports ?? [],
    comments: comments ?? [],
  };
}

// ---------------------------------------------------------------------------
// Cron: day-of reminders + translation catch-up
// ---------------------------------------------------------------------------

export async function sendEventReminders() {
  const admin = getAdmin();
  const today = kstDateString();
  const startUtc = new Date(`${today}T00:00:00+09:00`).toISOString();
  const endUtc = new Date(`${today}T23:59:59+09:00`).toISOString();
  const { data: events } = await admin
    .from('events')
    .select('id, title, starts_at, place_name')
    .eq('status', 'published')
    .is('reminded_at', null)
    .gte('starts_at', startUtc)
    .lte('starts_at', endUtc);

  let reminded = 0;
  for (const e of events ?? []) {
    const { data: claimed } = await admin
      .from('events')
      .update({ reminded_at: new Date().toISOString() })
      .eq('id', e.id)
      .is('reminded_at', null)
      .select('id');
    if (!claimed || claimed.length === 0) continue;
    const people = await attendeeIds(e.id as string);
    await createNotifications(
      people.map((uid) => ({
        user_id: uid,
        type: 'event_reminder' as const,
        title_en: `⏰ Today: ${e.title}`,
        title_ko: `⏰ 오늘: ${e.title}`,
        body_en: `${formatKst(e.starts_at as string, 'en')} · ${e.place_name}`,
        body_ko: `${formatKst(e.starts_at as string, 'ko')} · ${e.place_name}`,
        action_url: `/events/${e.id}`,
        is_important: true,
      })),
    );
    reminded += people.length;
  }
  return { ok: true as const, events: events?.length ?? 0, reminded };
}

export async function translatePendingEvents(limit = 10) {
  const { data } = await getAdmin()
    .from('events')
    .select('id, title, description, place_name, translation_source_hash')
    .eq('status', 'published')
    .gte('starts_at', new Date().toISOString())
    .limit(200);
  const todo = (data ?? []).filter((e) => e.translation_source_hash !== eventHash(e as { title: string; description: string; place_name: string })).slice(0, limit);
  let translated = 0;
  for (const e of todo) {
    const r = await translateEvent(e.id as string, 15000);
    if (r.ok) translated++;
  }
  return { pending: todo.length, translated };
}
