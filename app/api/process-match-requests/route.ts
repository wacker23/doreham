import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/process-match-requests
 *
 * Called:
 *  - Immediately after a user submits a request (from /matches page)
 *  - Every ~10 min via Vercel Cron (for stragglers)
 *  - Optionally: body { request_id: string } to process just one specific request
 *
 * Algorithm passes (based on request age):
 *  Pass 1 (0-30 min):   strict — same city, exact group size, compatibility >= 75
 *  Pass 2 (30-120 min): broadening — same city, ±1 group size, compatibility >= 60
 *  Pass 3 (2-6 hours):  loose — same city*, any group size 2-5, compatibility >= 50
 *  Give up (6h+): mark as no_match_found
 *
 * *For now "nearby cities" = same city (we don't have geographical adjacency data yet)
 *
 * Candidate pool:
 *  - Users with is_matchable = TRUE
 *  - Onboarding_completed = TRUE
 *  - Not currently in an active/pending group
 *  - Not frozen (via user_penalties.freeze_until)
 *  - Not the requester
 *  - Not in the request's excluded_user_ids (prev invitees who declined)
 *  - home_district matches the requested city (or nearby for pass 3)
 *
 * For each candidate, compute compatibility score vs requester.
 * Pick top-N by score where N = requested group size - 1.
 * Create a PENDING group with those users marked invite_state='invited'.
 * Mark the request as 'matched' with matched_group_id.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const INVITE_TIMEOUT_HOURS = 24;

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

// MBTI grouping into 4 families
function mbtiFamily(mbti: string | null): string | null {
  if (!mbti || mbti.length < 4) return null;
  const m = mbti.toUpperCase();
  // NT = Analysts, NF = Diplomats, SJ = Sentinels, SP = Explorers
  if (m.includes('NT')) return 'analyst';
  if (m.includes('NF')) return 'diplomat';
  if (m[1] === 'S' && m[3] === 'J') return 'sentinel';
  if (m[1] === 'S' && m[3] === 'P') return 'explorer';
  return null;
}

function compatibilityScore(a: Profile, b: Profile): number {
  if (!a.big_five_openness || !b.big_five_openness) return 0;
  const traits: (keyof Profile)[] = [
    'big_five_openness', 'big_five_conscientiousness', 'big_five_extraversion',
    'big_five_agreeableness', 'big_five_neuroticism',
  ];
  let sumDiff = 0;
  for (const t of traits) {
    const av = (a[t] as number) ?? 0.5;
    const bv = (b[t] as number) ?? 0.5;
    sumDiff += Math.abs(av - bv);
  }
  const avgDiff = sumDiff / traits.length;
  const bigFiveScore = Math.max(0, 100 - avgDiff * 100);

  // Shared interests
  const aInterests = new Set([...(a.activity_preferences ?? []), ...(a.interests ?? [])]);
  const bInterests = new Set([...(b.activity_preferences ?? []), ...(b.interests ?? [])]);
  const overlap = [...aInterests].filter((x) => bInterests.has(x)).length;

  // MBTI bonus
  let mbtiBonus = 0;
  if (a.mbti_type && b.mbti_type) {
    if (a.mbti_type.toUpperCase() === b.mbti_type.toUpperCase()) {
      mbtiBonus = 10; // Exact match
    } else if (mbtiFamily(a.mbti_type) === mbtiFamily(b.mbti_type) && mbtiFamily(a.mbti_type)) {
      mbtiBonus = 5; // Same family
    }
  }

  return Math.min(100, Math.round(bigFiveScore + overlap * 5 + mbtiBonus));
}

// -------------------- Pass definitions --------------------

type PassRule = {
  pass: number;
  minAgeMinutes: number;
  maxAgeMinutes: number | null; // null = no upper bound
  minCompatibility: number;
  groupSizeTolerance: number; // 0 = exact, 1 = ±1
  allowNearbyCities: boolean;
};

const PASSES: PassRule[] = [
  { pass: 1, minAgeMinutes: 0,   maxAgeMinutes: 30,  minCompatibility: 75, groupSizeTolerance: 0, allowNearbyCities: false },
  { pass: 2, minAgeMinutes: 30,  maxAgeMinutes: 120, minCompatibility: 60, groupSizeTolerance: 1, allowNearbyCities: false },
  { pass: 3, minAgeMinutes: 120, maxAgeMinutes: 360, minCompatibility: 50, groupSizeTolerance: 3, allowNearbyCities: true },
];

const GIVE_UP_MINUTES = 360; // 6 hours

// -------------------- Helpers --------------------

function cityMatch(district: string | null, requestedCity: string): boolean {
  if (!district) return false;
  const d = district.toLowerCase();
  const c = requestedCity.toLowerCase();
  // Match if district contains the city name (in Korean or English)
  const cityMap: Record<string, string[]> = {
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
  const aliases = cityMap[c] ?? [c];
  return aliases.some((a) => d.includes(a));
}

// -------------------- Main handler --------------------

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const specificRequestId = body?.request_id ?? null;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Load all searching requests (or just one if specified)
    let query = admin
      .from('match_requests')
      .select('*')
      .eq('status', 'searching');

    if (specificRequestId) query = query.eq('id', specificRequestId);

    const { data: requests, error: reqErr } = await query.order('created_at', { ascending: true });
    if (reqErr) return NextResponse.json({ error: reqErr.message }, { status: 500 });
    if (!requests || requests.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, note: 'No searching requests' });
    }

    // Load city→venue availability
    const { data: venues } = await admin
      .from('venues')
      .select('city')
      .eq('is_active', true)
      .is('deactivated_at', null);
    const citiesWithVenues = new Set((venues ?? []).map((v: any) => (v.city ?? '').toLowerCase()));

    const results: any[] = [];

    for (const req of requests) {
      const result = await processOneRequest(admin, req, citiesWithVenues);
      results.push({ request_id: req.id, ...result });
    }

    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Unknown error' }, { status: 500 });
  }
}

async function processOneRequest(admin: any, req: any, citiesWithVenues: Set<string>) {
  const ageMinutes = Math.floor((Date.now() - new Date(req.created_at).getTime()) / 60000);

  // Give up if too old
  if (ageMinutes >= GIVE_UP_MINUTES) {
    await admin
      .from('match_requests')
      .update({ status: 'no_match_found', resolved_at: new Date().toISOString() })
      .eq('id', req.id);
    return { action: 'gave_up', reason: `Age ${ageMinutes} min >= ${GIVE_UP_MINUTES}` };
  }

  // Determine which pass to use
  const currentPass = PASSES.find(
    (p) => ageMinutes >= p.minAgeMinutes && (p.maxAgeMinutes === null || ageMinutes < p.maxAgeMinutes)
  );
  if (!currentPass) {
    return { action: 'skipped', reason: `No matching pass for age ${ageMinutes} min` };
  }

  // City resolution
  let targetCity: string;
  if (req.city) {
    // Explicit city — validate has venues
    if (!citiesWithVenues.has(req.city.toLowerCase())) {
      // Shouldn't happen (UI validates), but be safe
      await admin
        .from('match_requests')
        .update({ status: 'no_match_found', resolved_at: new Date().toISOString() })
        .eq('id', req.id);
      return { action: 'gave_up', reason: `City ${req.city} has no active venues` };
    }
    targetCity = req.city;
  } else {
    // Random city — pick one that has venues
    const availableCities = Array.from(citiesWithVenues);
    if (availableCities.length === 0) {
      await admin
        .from('match_requests')
        .update({ status: 'no_match_found', resolved_at: new Date().toISOString() })
        .eq('id', req.id);
      return { action: 'gave_up', reason: 'No cities with venues at all' };
    }
    targetCity = availableCities[Math.floor(Math.random() * availableCities.length)];
  }

  // Target group size
  const targetGroupSize = req.group_size ?? (2 + Math.floor(Math.random() * 4)); // Random 2-5
  const neededInvitees = targetGroupSize - 1; // Requester counts as 1

  // Load requester profile
  const { data: requester } = await admin
    .from('profiles')
    .select('id, display_name, home_district, activity_preferences, interests, mbti_type, big_five_openness, big_five_conscientiousness, big_five_extraversion, big_five_agreeableness, big_five_neuroticism')
    .eq('id', req.user_id)
    .maybeSingle();

  if (!requester) {
    await admin
      .from('match_requests')
      .update({ status: 'no_match_found', resolved_at: new Date().toISOString() })
      .eq('id', req.id);
    return { action: 'gave_up', reason: 'Requester profile not found' };
  }

  // Get users currently in active/pending groups (exclude them)
  const { data: activeMembers } = await admin
    .from('group_members')
    .select('user_id, group_id, invite_state, left_at, accepted_at')
    .is('left_at', null);

  const busyUserIds = new Set<string>();
  for (const m of activeMembers ?? []) {
    // Active or pending
    if (m.invite_state === 'invited' || m.invite_state === 'accepted' || m.accepted_at) {
      busyUserIds.add(m.user_id);
    }
  }

  // Get frozen users
  const { data: frozenPenalties } = await admin
    .from('user_penalties')
    .select('user_id, freeze_until')
    .not('freeze_until', 'is', null)
    .gt('freeze_until', new Date().toISOString());
  const frozenUserIds = new Set((frozenPenalties ?? []).map((p: any) => p.user_id));

  // Load candidate pool
  const { data: candidates } = await admin
    .from('profiles')
    .select('id, display_name, home_district, activity_preferences, interests, mbti_type, big_five_openness, big_five_conscientiousness, big_five_extraversion, big_five_agreeableness, big_five_neuroticism')
    .eq('is_matchable', true)
    .eq('onboarding_completed', true)
    .neq('id', req.user_id);

  if (!candidates || candidates.length === 0) {
    return { action: 'no_candidates', pass: currentPass.pass, note: 'No matchable profiles at all' };
  }

  const excludedIds = new Set<string>(req.excluded_user_ids ?? []);

  // Filter candidates
  const eligible = candidates.filter((c: any) => {
    if (busyUserIds.has(c.id)) return false;
    if (frozenUserIds.has(c.id)) return false;
    if (excludedIds.has(c.id)) return false;
    if (!cityMatch(c.home_district, targetCity)) return false;
    return true;
  });

  if (eligible.length < neededInvitees) {
    // Log the attempt but keep searching
    await admin
      .from('match_requests')
      .update({
        attempt_count: (req.attempt_count ?? 0) + 1,
        last_attempt_at: new Date().toISOString(),
      })
      .eq('id', req.id);
    return { action: 'insufficient_candidates', pass: currentPass.pass, eligible: eligible.length, needed: neededInvitees };
  }

  // Score each eligible candidate
  const scored = eligible.map((c: any) => ({
    profile: c,
    score: compatibilityScore(requester, c),
  }));

  // Filter by min compatibility
  const qualified = scored.filter((s: any) => s.score >= currentPass.minCompatibility);

  if (qualified.length < neededInvitees) {
    await admin
      .from('match_requests')
      .update({
        attempt_count: (req.attempt_count ?? 0) + 1,
        last_attempt_at: new Date().toISOString(),
      })
      .eq('id', req.id);
    return { action: 'insufficient_qualified', pass: currentPass.pass, qualified: qualified.length, needed: neededInvitees };
  }

  // Sort by score desc, take top N
  qualified.sort((a: any, b: any) => b.score - a.score);
  const picked = qualified.slice(0, neededInvitees);

  // Pick venue based on group's shared interests
  const groupInterests = new Set<string>();
  for (const p of [requester, ...picked.map((p: any) => p.profile)]) {
    (p.activity_preferences ?? []).forEach((i: string) => groupInterests.add(i));
    (p.interests ?? []).forEach((i: string) => groupInterests.add(i));
  }

  const { data: cityVenues } = await admin
    .from('venues')
    .select('id, business_name_display, category, city, photo_urls')
    .eq('is_active', true)
    .is('deactivated_at', null);

  const matchingVenues = (cityVenues ?? []).filter((v: any) =>
    cityMatch(v.city, targetCity) || v.city.toLowerCase() === targetCity.toLowerCase()
  );

  if (matchingVenues.length === 0) {
    return { action: 'no_venues', pass: currentPass.pass, city: targetCity };
  }

  // Pick random venue (in the future: match by category vs interests)
  const chosenVenue = matchingVenues[Math.floor(Math.random() * matchingVenues.length)];

  // Create PENDING group
  const inviteExpiresAt = new Date(Date.now() + INVITE_TIMEOUT_HOURS * 60 * 60 * 1000).toISOString();

  const { data: group, error: groupErr } = await admin
    .from('groups')
    .insert({
      city: targetCity,
      created_by: req.user_id,
      is_pending_invites: true,
      originated_by_request_id: req.id,
      phase: 'availability', // Will trigger availability picker once invites accepted
    })
    .select('id')
    .single();

  if (groupErr || !group) {
    return { action: 'error', pass: currentPass.pass, error: `Group creation failed: ${groupErr?.message}` };
  }

  // Insert requester as ACCEPTED, invitees as INVITED
  const memberRows = [
    {
      group_id: group.id,
      user_id: req.user_id,
      invited_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
      invite_state: 'accepted' as const,
    },
    ...picked.map((p: any) => ({
      group_id: group.id,
      user_id: p.profile.id,
      invited_at: new Date().toISOString(),
      invite_state: 'invited' as const,
      invite_expires_at: inviteExpiresAt,
    })),
  ];

  const { error: memErr } = await admin.from('group_members').insert(memberRows);
  if (memErr) {
    // Rollback
    await admin.from('groups').delete().eq('id', group.id);
    return { action: 'error', pass: currentPass.pass, error: `Members insert failed: ${memErr.message}` };
  }

  // Create quest (matches will still need quest for full flow)
  const catEmoji: Record<string, string> = {
    cafe: '☕', restaurant: '🍜', board_game_cafe: '🎲', escape_room: '🧩',
    bookshop: '📚', workshop_creative: '🏺', active_sports: '🥾',
    cultural_venue: '🎨', nature_outdoor: '🌿', music_movie: '🎬', other: '🏪',
  };
  const emoji = catEmoji[chosenVenue.category] ?? '🌟';
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  await admin.from('quests').insert({
    group_id: group.id,
    venue_id: chosenVenue.id,
    title: `${emoji} ${chosenVenue.business_name_display}에서 만나기`,
    title_en: `${emoji} Meet up at ${chosenVenue.business_name_display}`,
    quest_description: `${chosenVenue.business_name_display}에서 함께 시간을 보내세요.`,
    description_en: `Spend time together at ${chosenVenue.business_name_display}.`,
    status: 'proposed',
    expires_at: expiresAt.toISOString(),
  });

  // Update request as matched
  await admin
    .from('match_requests')
    .update({
      status: 'matched',
      matched_group_id: group.id,
      resolved_at: new Date().toISOString(),
      attempt_count: (req.attempt_count ?? 0) + 1,
      last_attempt_at: new Date().toISOString(),
    })
    .eq('id', req.id);

  return {
    action: 'matched',
    pass: currentPass.pass,
    group_id: group.id,
    venue: chosenVenue.business_name_display,
    invited_count: picked.length,
    invitees: picked.map((p: any) => ({ id: p.profile.id, name: p.profile.display_name, score: p.score })),
  };
}