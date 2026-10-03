import 'server-only';
import { after } from 'next/server';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { createNotifications, createNotification, type NotificationPayload } from '@/lib/notifications';
import { expandCategoriesToVenueCategories } from '@/lib/matchCategories';
import { expireOverdueInvites, ACTIVE_PHASES } from '@/lib/server/groupLifecycle';
import { sendMatchInviteEmail } from '@/lib/server/emails/match-invite';
import { LAUNCH_CITY_SLUGS, NEARBY_CITIES, VOLUNTEER_CITY_SET } from '@/lib/cities';
import { PRIORITY_MATCHING_LEVEL } from '@/lib/points';
import { levelsById } from '@/lib/server/points';

/**
 * Matching algorithm.
 *
 * Runs:
 *  - immediately when a user submits a request (POST /api/process-match-requests, own request only)
 *  - every 10 minutes via Vercel Cron (all searching requests)
 *  - immediately after a pending group is cancelled and the requester's search reopens
 *
 * Passes are based on how long the request has been searching (search_started_at,
 * which resets when a cancelled group reopens the request):
 *  Pass 1 (0–30 min):   exact group size, compatibility ≥ 75
 *  Pass 2 (30 min–2 h): size may shrink by 1, compatibility ≥ 60, neighbouring cities join the pool
 *  Pass 3 (2 h–24 h):   any size down to 2, compatibility ≥ 50
 *
 * A request can list up to 3 cities (or none = anywhere). Each city is tried; invitees are people who
 * live there, are searching for it themselves, or (pass 2+) live in a neighbouring city (Asan ↔ Cheonan).
 * The city that gives the biggest, best-fitting group wins.
 *  After 24 h:          no_match_found (user is notified and can request again)
 */

export const INVITE_TIMEOUT_HOURS = 24;
export const GIVE_UP_MINUTES = 24 * 60; // Sophia, Sep 29: 48 h was too long

type PassRule = {
  pass: number;
  minAgeMinutes: number;
  maxAgeMinutes: number;
  minCompatibility: number;
  sizeShrink: number; // how many fewer people than requested we accept
};

const PASSES: PassRule[] = [
  { pass: 1, minAgeMinutes: 0, maxAgeMinutes: 30, minCompatibility: 75, sizeShrink: 0 },
  { pass: 2, minAgeMinutes: 30, maxAgeMinutes: 120, minCompatibility: 60, sizeShrink: 1 },
  { pass: 3, minAgeMinutes: 120, maxAgeMinutes: GIVE_UP_MINUTES, minCompatibility: 50, sizeShrink: 3 },
];

// -------------------- Compatibility scoring --------------------

type Profile = {
  id: string;
  display_name: string;
  home_district: string | null;
  activity_preferences: string[] | null;
  interests: string[] | null;
  mbti_type: string | null;
  big_five_openness: number | null;
  big_five_conscientiousness: number | null;
  big_five_extraversion: number | null;
  big_five_agreeableness: number | null;
  big_five_neuroticism: number | null;
};

const PROFILE_COLUMNS =
  'id, display_name, home_district, activity_preferences, interests, mbti_type, big_five_openness, big_five_conscientiousness, big_five_extraversion, big_five_agreeableness, big_five_neuroticism';

function mbtiFamily(mbti: string | null): string | null {
  if (!mbti || mbti.length < 4) return null;
  const m = mbti.toUpperCase();
  if (m.includes('NT')) return 'analyst';
  if (m.includes('NF')) return 'diplomat';
  if (m[1] === 'S' && m[3] === 'J') return 'sentinel';
  if (m[1] === 'S' && m[3] === 'P') return 'explorer';
  return null;
}

export function compatibilityScore(a: Profile, b: Profile): number {
  // A score of 0.00 on a trait is valid — only a missing test disqualifies.
  if (a.big_five_openness == null || b.big_five_openness == null) return 0;
  const traits: (keyof Profile)[] = [
    'big_five_openness', 'big_five_conscientiousness', 'big_five_extraversion',
    'big_five_agreeableness', 'big_five_neuroticism',
  ];
  let sumDiff = 0;
  for (const t of traits) {
    const av = Number(a[t] ?? 0.5);
    const bv = Number(b[t] ?? 0.5);
    sumDiff += Math.abs(av - bv);
  }
  const bigFiveScore = Math.max(0, 100 - (sumDiff / traits.length) * 100);

  const aInterests = new Set([...(a.activity_preferences ?? []), ...(a.interests ?? [])]);
  const bInterests = new Set([...(b.activity_preferences ?? []), ...(b.interests ?? [])]);
  const overlap = [...aInterests].filter((x) => bInterests.has(x)).length;

  let mbtiBonus = 0;
  if (a.mbti_type && b.mbti_type) {
    if (a.mbti_type.trim().toUpperCase() === b.mbti_type.trim().toUpperCase()) mbtiBonus = 10;
    else if (mbtiFamily(a.mbti_type) && mbtiFamily(a.mbti_type) === mbtiFamily(b.mbti_type)) mbtiBonus = 5;
  }

  return Math.min(100, Math.round(bigFiveScore + overlap * 5 + mbtiBonus));
}

// -------------------- City matching --------------------

const CITY_ALIASES: Record<string, string[]> = {
  asan: ['asan', '아산'],
  cheonan: ['cheonan', '천안'],
  seoul: ['seoul', '서울'],
  busan: ['busan', '부산'],
  incheon: ['incheon', '인천'],
  daegu: ['daegu', '대구'],
  daejeon: ['daejeon', '대전'],
  gwangju: ['gwangju', '광주'],
  suwon: ['suwon', '수원'],
  ulsan: ['ulsan', '울산'],
  jeonju: ['jeonju', '전주'],
  jeju: ['jeju', '제주'],
};

export function cityMatch(district: string | null, requestedCity: string): boolean {
  if (!district) return false;
  const d = district.toLowerCase();
  const c = requestedCity.toLowerCase();
  const aliases = CITY_ALIASES[c] ?? [c];
  return aliases.some((a) => d.includes(a));
}

// -------------------- Entry point --------------------

type MatchRequestRow = {
  id: string;
  user_id: string;
  city: string | null;
  cities: string[] | null;
  group_size: number | null;
  status: string;
  created_at: string;
  search_started_at: string | null;
  attempt_count: number | null;
  excluded_user_ids: string[] | null;
  preferred_categories: string[] | null;
  quest_type: string | null;
};

export async function processMatchRequests(opts: { requestId?: string; userId?: string } = {}) {
  const admin = getAdmin();

  const expireResult = await expireOverdueInvites();

  let query = admin.from('match_requests').select('*').eq('status', 'searching');
  if (opts.requestId) query = query.eq('id', opts.requestId);
  if (opts.userId) query = query.eq('user_id', opts.userId);

  const { data: requests, error } = await query.order('search_started_at', { ascending: true });
  if (error) return { ok: false as const, error: error.message };
  if (!requests || requests.length === 0) {
    return { ok: true as const, processed: 0, expired_invites: expireResult, results: [] };
  }

  // Priority matching (a level perk): higher-level members' requests go first, oldest first within each group.
  const levels = await levelsById(requests.map((r) => r.user_id as string));
  const priority = (r: { user_id: string }) => ((levels.get(r.user_id) ?? 1) >= PRIORITY_MATCHING_LEVEL ? 1 : 0);
  requests.sort((a, b) => priority(b as MatchRequestRow) - priority(a as MatchRequestRow));

  const { data: venues } = await admin
    .from('venues')
    .select('city')
    .eq('is_active', true)
    .is('deactivated_at', null);
  const citiesWithVenues = new Set((venues ?? []).map((v) => String(v.city ?? '').toLowerCase()));

  // Volunteer quests need cached 1365 programs in the city (synced daily).
  const { data: programCities } = await admin
    .from('volunteer_programs')
    .select('city')
    .gte('program_end', new Date().toISOString().slice(0, 10))
    .not('adult_ok', 'is', false);
  const citiesWithPrograms = new Set((programCities ?? []).map((p) => String(p.city ?? '').toLowerCase()).filter(Boolean));

  const results: Record<string, unknown>[] = [];
  // Sequential on purpose: each match changes who is "busy" for the next request.
  for (const req of requests as MatchRequestRow[]) {
    try {
      const r = await processOneRequest(req, citiesWithVenues, citiesWithPrograms);
      results.push({ request_id: req.id, ...r });
    } catch (e: unknown) {
      results.push({ request_id: req.id, action: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { ok: true as const, processed: results.length, expired_invites: expireResult, results };
}

const NO_VENUES_MESSAGE = {
  en: "There are no partner venues in the cities you picked yet. Add Asan or Cheonan, or try a 봉사 (volunteer) quest.",
  ko: '선택한 도시에는 아직 제휴 장소가 없어요. 아산이나 천안을 추가하거나 봉사 퀘스트를 선택해 주세요.',
};

const NO_PROGRAMS_MESSAGE = {
  en: 'There are no 1365 volunteer activities open to adults in this city right now. Try again in a few days, or pick another category.',
  ko: '지금 이 도시에는 성인이 참여할 수 있는 1365 봉사활동이 없어요. 며칠 뒤 다시 시도하거나 다른 카테고리를 골라 주세요.',
};

async function giveUp(req: MatchRequestRow, reason: string, message?: { en: string; ko: string }) {
  await getAdmin()
    .from('match_requests')
    .update({ status: 'no_match_found', resolved_at: new Date().toISOString() })
    .eq('id', req.id)
    .eq('status', 'searching');

  after(async () => {
    await createNotification({
      user_id: req.user_id,
      type: 'no_match_found',
      title_en: "We couldn't find a group this time",
      title_ko: '이번에는 그룹을 찾지 못했어요',
      body_en: message?.en ?? 'Not enough people were available. Try again — new people join every week.',
      body_ko: message?.ko ?? '참여 가능한 사람이 부족했어요. 다시 시도해 보세요 — 매주 새로운 사람들이 가입해요.',
      action_url: '/matches',
    });
  });
  return { action: 'gave_up', reason };
}

async function recordAttempt(req: MatchRequestRow) {
  await getAdmin()
    .from('match_requests')
    .update({ attempt_count: (req.attempt_count ?? 0) + 1, last_attempt_at: new Date().toISOString() })
    .eq('id', req.id);
}

/** The cities a request is open to, lowercased. Empty = anywhere. */
function requestCities(r: { city: string | null; cities?: string[] | null }): string[] {
  const list = r.cities && r.cities.length > 0 ? r.cities : r.city ? [r.city] : [];
  return [...new Set(list.map((c) => c.trim().toLowerCase()).filter(Boolean))];
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function processOneRequest(req: MatchRequestRow, citiesWithVenues: Set<string>, citiesWithPrograms: Set<string>) {
  const isVolunteer = req.quest_type === 'volunteer';
  const questCities = isVolunteer ? citiesWithPrograms : citiesWithVenues;
  const admin = getAdmin();
  const startedAt = new Date(req.search_started_at ?? req.created_at).getTime();
  const ageMinutes = Math.max(0, Math.floor((Date.now() - startedAt) / 60000));

  // ---- cities: the ones this request is open to that can host this kind of quest right now
  const requested = requestCities(req);
  const wanted = requested.length > 0 ? requested : [...new Set([...LAUNCH_CITY_SLUGS, ...questCities])];
  const usable = wanted.filter((c) => questCities.has(c) && (!isVolunteer || VOLUNTEER_CITY_SET.has(c)));
  // Volunteer programs are re-synced twice a day, so a supported city with none cached yet is worth waiting for.
  const waitingForPrograms = isVolunteer && usable.length === 0 && wanted.some((c) => VOLUNTEER_CITY_SET.has(c));

  if (ageMinutes >= GIVE_UP_MINUTES) {
    return giveUp(req, `searching for ${ageMinutes} min`, waitingForPrograms ? NO_PROGRAMS_MESSAGE : undefined);
  }

  const pass = PASSES.find((p) => ageMinutes >= p.minAgeMinutes && ageMinutes < p.maxAgeMinutes);
  if (!pass) return { action: 'skipped', reason: `no pass for age ${ageMinutes}` };

  if (usable.length === 0) {
    if (waitingForPrograms) return { action: 'skipped', reason: `waiting for 1365 programs in ${wanted.join(', ')}` };
    return giveUp(
      req,
      `no ${isVolunteer ? 'volunteer programs' : 'active venues'} in ${wanted.join(', ') || 'any city'}`,
      isVolunteer ? NO_PROGRAMS_MESSAGE : NO_VENUES_MESSAGE,
    );
  }

  // ---- requester
  const { data: requester } = await admin
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', req.user_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!requester) return giveUp(req, 'requester profile not found');

  // ---- who is busy: anyone invited to / in a group that is still pending or active
  const { data: activeGroups } = await admin.from('groups').select('id').in('phase', [...ACTIVE_PHASES]);
  const activeGroupIds = (activeGroups ?? []).map((g) => g.id as string);
  const busy = new Set<string>();
  if (activeGroupIds.length > 0) {
    const { data: activeMembers } = await admin
      .from('group_members')
      .select('user_id, invite_state, accepted_at')
      .is('left_at', null)
      .in('group_id', activeGroupIds);
    for (const m of activeMembers ?? []) {
      if (m.invite_state === 'invited' || m.invite_state === 'accepted' || m.accepted_at) busy.add(m.user_id as string);
    }
  }
  if (busy.has(req.user_id)) {
    // The requester is already in an active group (e.g. accepted someone else's invite). Park the request.
    return { action: 'skipped', reason: 'requester already in an active group' };
  }

  // ---- frozen users
  const { data: frozen } = await admin
    .from('user_penalties')
    .select('user_id')
    .gt('freeze_until', new Date().toISOString());
  const frozenIds = new Set((frozen ?? []).map((p) => p.user_id as string));

  // ---- blocks in either direction
  const { data: blocks } = await admin
    .from('user_blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${req.user_id},blocked_id.eq.${req.user_id}`);
  const blockedIds = new Set<string>();
  for (const b of blocks ?? []) blockedIds.add((b.blocker_id === req.user_id ? b.blocked_id : b.blocker_id) as string);

  // ---- candidate pool (city is decided below, per city)
  const { data: candidates } = await admin
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('is_matchable', true)
    .eq('onboarding_completed', true)
    .is('deleted_at', null)
    .neq('id', req.user_id);

  const excluded = new Set<string>(req.excluded_user_ids ?? []);
  const eligible = ((candidates ?? []) as Profile[]).filter(
    (c) => !busy.has(c.id) && !frozenIds.has(c.id) && !excluded.has(c.id) && !blockedIds.has(c.id),
  );

  // Other people's open searches say where they are willing to go.
  const { data: searchers } = await admin
    .from('match_requests')
    .select('user_id, city, cities, quest_type')
    .eq('status', 'searching')
    .neq('user_id', req.user_id);
  const willing = new Map<string, Set<string> | 'any'>();
  const wantsToVolunteer = new Set<string>();
  for (const r of searchers ?? []) {
    const cs = requestCities(r as { city: string | null; cities: string[] | null });
    willing.set(r.user_id as string, cs.length > 0 ? new Set(cs) : 'any');
    if (r.quest_type === 'volunteer') wantsToVolunteer.add(r.user_id as string);
  }

  let interested = eligible;
  if (isVolunteer && pass.pass < 3) {
    interested = eligible.filter(
      (c) => wantsToVolunteer.has(c.id) || (c.activity_preferences ?? []).includes('volunteering_community'),
    );
  }

  /** Lives in the city, is searching for it, or (from pass 2) lives in a neighbouring city. */
  const canJoin = (c: Profile, city: string) => {
    const w = willing.get(c.id);
    if (w === 'any' || (w && w.has(city))) return true;
    if (cityMatch(c.home_district, city)) return true;
    return pass.pass >= 2 && (NEARBY_CITIES[city] ?? []).some((n) => cityMatch(c.home_district, n));
  };

  // ---- group size: requested size, shrinking per pass, never below 2 people total
  const requestedSize = req.group_size ?? 2 + Math.floor(Math.random() * 4);
  const minSize = Math.max(2, requestedSize - pass.sizeShrink);

  type CityOption = { city: string; scored: { profile: Profile; score: number }[]; groupSize: number; avg: number };
  const perCity: Record<string, number> = {};
  let best: CityOption | null = null;
  for (const city of shuffle(usable)) {
    const scored = interested
      .filter((c) => canJoin(c, city))
      .map((profile) => ({ profile, score: compatibilityScore(requester as Profile, profile) }))
      .filter((x) => x.score >= pass.minCompatibility)
      .sort((a, b) => b.score - a.score);
    perCity[city] = scored.length;

    let size = 0;
    for (let n = requestedSize; n >= minSize; n--) {
      if (scored.length >= n - 1) {
        size = n;
        break;
      }
    }
    if (size === 0) continue;
    const top = scored.slice(0, size - 1);
    const avg = top.reduce((sum, x) => sum + x.score, 0) / top.length;
    // Prefer the bigger group, then the better fit.
    if (!best || size > best.groupSize || (size === best.groupSize && avg > best.avg)) {
      best = { city, scored, groupSize: size, avg };
    }
  }

  if (!best) {
    await recordAttempt(req);
    return {
      action: 'insufficient_candidates',
      pass: pass.pass,
      eligible: eligible.length,
      qualified_per_city: perCity,
      needed: minSize - 1,
    };
  }
  const targetCity = best.city;
  const groupSize = best.groupSize;
  const picked = best.scored.slice(0, groupSize - 1);

  // ---- venue: in the city, honouring everyone's category preferences (fallback to any)
  type VenuePick = { id: string; business_name_display: string; category: string };
  let venue = null as VenuePick | null;
  let categoryFilterApplied = false;
  if (!isVolunteer) {
    const { data: allVenues } = await admin
      .from('venues')
      .select('id, business_name_display, category, city')
      .eq('is_active', true)
      .is('deactivated_at', null);
    const cityVenues = (allVenues ?? []).filter(
      (v) => cityMatch(v.city as string, targetCity) || String(v.city).toLowerCase() === targetCity.toLowerCase(),
    );
    if (cityVenues.length === 0) {
      await recordAttempt(req);
      return { action: 'no_venues', pass: pass.pass, city: targetCity };
    }

    const preferred = new Set<string>(req.preferred_categories ?? []);
    const { data: inviteeRequests } = await admin
      .from('match_requests')
      .select('preferred_categories')
      .eq('status', 'searching')
      .in('user_id', picked.map((p) => p.profile.id));
    for (const r of inviteeRequests ?? []) for (const c of (r.preferred_categories as string[] | null) ?? []) preferred.add(c);

    const venueCategories = expandCategoriesToVenueCategories(Array.from(preferred).filter((c) => c !== 'help'));
    let venuePool = cityVenues;
    if (venueCategories && venueCategories.length > 0) {
      const filtered = cityVenues.filter((v) => venueCategories.includes(String(v.category)));
      if (filtered.length > 0) {
        venuePool = filtered;
        categoryFilterApplied = true;
      }
    }
    venue = venuePool[Math.floor(Math.random() * venuePool.length)] as VenuePick;
  }

  // ---- create the pending group (conditional on the request still searching)
  const { data: claimed } = await admin
    .from('match_requests')
    .update({ status: 'matched', resolved_at: new Date().toISOString() })
    .eq('id', req.id)
    .eq('status', 'searching')
    .select('id');
  if (!claimed || claimed.length === 0) return { action: 'skipped', reason: 'request no longer searching' };

  const now = new Date().toISOString();
  const inviteExpiresAt = new Date(Date.now() + INVITE_TIMEOUT_HOURS * 60 * 60 * 1000).toISOString();

  const { data: group, error: groupErr } = await admin
    .from('groups')
    .insert({
      city: targetCity,
      created_by: req.user_id,
      is_pending_invites: true,
      originated_by_request_id: req.id,
      phase: 'availability',
      quest_type: isVolunteer ? 'volunteer' : 'venue',
    })
    .select('id')
    .single();
  if (groupErr || !group) {
    await admin.from('match_requests').update({ status: 'searching', resolved_at: null }).eq('id', req.id);
    return { action: 'error', pass: pass.pass, error: `group insert failed: ${groupErr?.message}` };
  }

  const { error: memErr } = await admin.from('group_members').insert([
    { group_id: group.id, user_id: req.user_id, invited_at: now, accepted_at: now, invite_state: 'accepted' },
    ...picked.map((p) => ({
      group_id: group.id,
      user_id: p.profile.id,
      invited_at: now,
      invite_state: 'invited',
      invite_expires_at: inviteExpiresAt,
    })),
  ]);
  if (memErr) {
    await admin.from('groups').delete().eq('id', group.id);
    await admin.from('match_requests').update({ status: 'searching', resolved_at: null }).eq('id', req.id);
    return { action: 'error', pass: pass.pass, error: `members insert failed: ${memErr.message}` };
  }

  const questExpires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  if (venue) {
    await admin.from('quests').insert({
      group_id: group.id,
      quest_type: 'venue',
      venue_id: venue.id,
      title: `${venue.business_name_display}에서 만나기`,
      title_en: `Meet up at ${venue.business_name_display}`,
      quest_description: `${venue.business_name_display}에서 함께 시간을 보내세요.`,
      description_en: `Spend time together at ${venue.business_name_display}.`,
      status: 'proposed',
      expires_at: questExpires,
    });
  } else {
    await admin.from('quests').insert({
      group_id: group.id,
      quest_type: 'volunteer',
      venue_id: null,
      title: '함께 봉사하기',
      title_en: 'Volunteer together',
      quest_description: '1365 자원봉사 활동 중 하나를 함께 골라 참여해요.',
      description_en: 'Pick a 1365 volunteer activity together and do it as a group.',
      status: 'proposed',
      expires_at: questExpires,
    });
  }

  await admin
    .from('match_requests')
    .update({
      matched_group_id: group.id,
      attempt_count: (req.attempt_count ?? 0) + 1,
      last_attempt_at: now,
    })
    .eq('id', req.id);

  // ---- notify (after the response)
  const venueName = venue ? String(venue.business_name_display) : '';
  const requesterName = (requester as Profile).display_name;
  const inviteeNames = picked.map((p) => p.profile.display_name);
  const allNames = [requesterName, ...inviteeNames];

  after(async () => {
    const notifs: NotificationPayload[] = picked.map((p) => ({
      user_id: p.profile.id,
      type: 'match_invite',
      title_en: "You've been invited to a group!",
      title_ko: '새로운 그룹 초대가 왔어요!',
      body_en: isVolunteer
        ? `Volunteer together as a group. Accept within ${INVITE_TIMEOUT_HOURS} hours to join.`
        : `Meet up at ${venueName}. Accept within ${INVITE_TIMEOUT_HOURS} hours to join.`,
      body_ko: isVolunteer
        ? `그룹으로 함께 봉사해요. ${INVITE_TIMEOUT_HOURS}시간 안에 수락해 주세요.`
        : `${venueName}에서 만나요. ${INVITE_TIMEOUT_HOURS}시간 안에 수락해 주세요.`,
      action_url: '/matches',
      is_important: true,
    }));
    notifs.push({
      user_id: req.user_id,
      type: 'match_found',
      title_en: 'We found your group!',
      title_ko: '그룹을 찾았어요!',
      body_en: isVolunteer
        ? `We invited ${picked.length} ${picked.length === 1 ? 'person' : 'people'} to volunteer with you. We'll tell you when they accept.`
        : `We invited ${picked.length} ${picked.length === 1 ? 'person' : 'people'} to meet at ${venueName}. We'll tell you when they accept.`,
      body_ko: isVolunteer
        ? `함께 봉사할 ${picked.length}명을 초대했어요. 수락하면 알려드릴게요.`
        : `${venueName}에서 만날 ${picked.length}명을 초대했어요. 수락하면 알려드릴게요.`,
      action_url: '/matches',
    });
    await createNotifications(notifs);

    await Promise.all(
      picked.map((p) =>
        sendMatchInviteEmail({
          user_id: p.profile.id,
          group_id: group.id,
          venue_name: isVolunteer ? '봉사활동 · Volunteering' : venueName,
          other_member_names: allNames.filter((n) => n !== p.profile.display_name),
        }).then((r) => r.error && console.error('Invite email failed:', p.profile.id, r.error)),
      ),
    );
  });

  return {
    action: 'matched',
    pass: pass.pass,
    group_id: group.id,
    group_size: groupSize,
    quest_type: isVolunteer ? 'volunteer' : 'venue',
    venue: venueName || null,
    category_filter_applied: categoryFilterApplied,
    invitees: picked.map((p) => ({ id: p.profile.id, score: p.score })),
  };
}
