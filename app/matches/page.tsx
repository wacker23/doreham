'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { MATCH_CATEGORIES } from '@/lib/matchCategories';
import { KOREAN_CITIES, LAUNCH_CITY_SET, MAX_REQUEST_CITIES, VOLUNTEER_CITY_SET } from '@/lib/cities';
import { useLang } from '@/lib/hooks/useLang';
import { VolunteerConsentModal } from '@/components/VolunteerConsentModal';
import { AppTabBar } from '@/components/AppTabBar';
import { AppHeader } from '@/components/AppHeader';
import { MeetPeopleCard } from '@/components/MeetPeopleCard';
import { isVenueAccount } from '@/lib/accountType';
import { supabase } from '@/lib/supabase/client';
import { FREE_MATCH_REQUESTS_PER_MONTH, planError, planUnlocked, type PlanStatus } from '@/lib/plan';
import { Icon } from '@/components/icons/Icon';
import { CategoryIcon } from '@/components/icons/CategoryIcon';
import { stripEmoji, venueCategoryArt, type CategoryArt } from '@/lib/icons';

type Tab = 'pending' | 'request' | 'history';

type GroupMember = {
  user_id: string;
  display_name: string;
  photo_url: string | null;
  mbti_type: string | null;
  zodiac_sign: string | null;
  activity_preferences: string[] | null;
  invite_state: string | null;
  accepted_at: string | null;
};

type QuestMenuItem = {
  id: string;
  name: string;
  name_en: string | null;
  price_won: number | null;
  is_signature: boolean;
  photo_url: string | null;
};

type Match = {
  group_id: string;
  city: string;
  members: GroupMember[];
  is_pending_invites: boolean;
  my_invite_state: string | null;
  my_invite_expires_at: string | null;
  unread_count: number;
  availability_submitted_count: number;
  my_availability_submitted: boolean;
  quest_scheduled_at: string | null;
  phase: string;
  i_left: boolean;
  /** When it happened (or ended), for sorting the History tab newest first. */
  history_at: string | null;
  quest: {
    id: string;
    title: string;
    title_en: string | null;
    quest_description: string;
    description_en: string | null;
    status: string;
    expires_at: string;
    quest_type: 'venue' | 'volunteer';
    venue: {
      id: string;
      business_name_display: string;
      category: string;
      address: string;
      road_address: string | null;
      city: string;
      photo_urls: string[];
      per_person_cost_won: number | null;
      discount_offer: string | null;
      discount_offer_en: string | null;
    } | null;
    program: {
      id: string;
      title: string;
      title_en: string | null;
      org_name: string | null;
      org_name_en: string | null;
      place: string | null;
      place_en: string | null;
      detail_url: string | null;
    } | null;
    menu_items: QuestMenuItem[];
  };
};

type MatchRequest = {
  id: string;
  city: string | null;
  cities: string[] | null;
  group_size: number | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  matched_group_id: string | null;
};



const CATEGORY_LABELS: Record<string, { en: string; ko: string }> = {
  cafe: { en: 'Café', ko: '카페' },
  restaurant: { en: 'Restaurant', ko: '식당' },
  board_game_cafe: { en: 'Board game café', ko: '보드게임 카페' },
  escape_room: { en: 'Escape room', ko: '방탈출' },
  bookshop: { en: 'Bookshop', ko: '서점' },
  workshop_creative: { en: 'Workshop', ko: '원데이 클래스' },
  active_sports: { en: 'Sports', ko: '스포츠' },
  cultural_venue: { en: 'Cultural venue', ko: '문화 공간' },
  nature_outdoor: { en: 'Nature', ko: '자연' },
  music_movie: { en: 'Music/Movie', ko: '음악·영화' },
  bar_club: { en: 'Bar/Club', ko: '바·클럽' },
  other: { en: 'Other', ko: '기타' },
};

const STATUS_LABELS: Record<string, { en: string; ko: string; color: string }> = {
  proposed: { en: 'New match!', ko: '새 매칭!', color: 'persimmon' },
  scheduled: { en: 'Scheduled', ko: '예정됨', color: 'jade' },
  completed: { en: 'Completed', ko: '완료', color: 'jade' },
  cancelled: { en: 'Cancelled', ko: '취소됨', color: 'gray' },
  no_show: { en: 'Missed', ko: '불참', color: 'gray' },
};

export default function MatchesPage() {
  const router = useRouter();
  const { user, profile, loading } = useUser();
  const venueOnly = isVenueAccount(profile);
  const [lang, setLang] = useLang();
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [matches, setMatches] = useState<Match[]>([]);
  const [requests, setRequests] = useState<MatchRequest[]>([]);
  const [availableCities, setAvailableCities] = useState<Set<string>>(new Set());
  const [volunteerCities, setVolunteerCities] = useState<Set<string>>(new Set());
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Request form state
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  // 봉사 (help) turns the request into a volunteer quest; it can't be mixed with venue categories.
  const isVolunteerRequest = selectedCategories.includes('help');
  // Pickable cities: volunteer quests run in fixed cities; venue quests in the launch cities plus any city
  // that already has venues. Whether a city has venues / open 1365 activities right now is shown as a note.
  const venueCities = new Set([...LAUNCH_CITY_SET, ...availableCities]);
  const citiesForRequest: ReadonlySet<string> = isVolunteerRequest ? VOLUNTEER_CITY_SET : venueCities;
  const citiesWithoutQuests = selectedCities.filter((c) => !(isVolunteerRequest ? volunteerCities : availableCities).has(c));
  const [randomCity, setRandomCity] = useState(false);
  const [selectedGroupSize, setSelectedGroupSize] = useState<number | null>(3);
  const [randomSize, setRandomSize] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  // Plan (Free / Doreham+). Locks show only once it's known, so Doreham+ members never see them flash.
  const [plan, setPlan] = useState<PlanStatus | null>(null);
  // Locks only when plans are enforced (not during the test period) and the person isn't a member.
  const isFree = plan !== null && !planUnlocked(plan);
  const requestsLeft = plan ? Math.max(0, plan.match_requests_limit - plan.match_requests_used) : null;
  const outOfRequests = isFree && requestsLeft === 0 && !isVolunteerRequest;
  const [planNote, setPlanNote] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [isMatchable, setIsMatchable] = useState(true);
  const [pendingReviews, setPendingReviews] = useState<any[]>([]);
  const [savingMatchable, setSavingMatchable] = useState(false);

  // Freeze
  const [isFrozen, setIsFrozen] = useState(false);
  const [frozenUntil, setFrozenUntil] = useState<string | null>(null);
  const [strikeCount, setStrikeCount] = useState(0);

  // Touch swipe
  const touchStartX = useRef<number | null>(null);

  // Volunteer-photo consent (needed before requesting or joining a 봉사 quest)
  const [hasVolunteerConsent, setHasVolunteerConsent] = useState<boolean | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const afterConsent = useRef<(() => void) | null>(null);
  function askConsent(then: () => void) {
    afterConsent.current = then;
    setConsentOpen(true);
  }
  const touchEndX = useRef<number | null>(null);

  useEffect(() => {
    document.body.setAttribute('data-lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/sign-in?return=/matches');
      return;
    }
    if (venueOnly) return; // venue-only account: nothing to load, the page invites them to meet people
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router, venueOnly]);

  function loadPlan() {
    fetch('/api/plan')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setPlan(d as PlanStatus);
        if (!planUnlocked(d as PlanStatus)) {
          // Free plan: random group size, any category (봉사 can still be picked)
          setRandomSize(true);
          setSelectedGroupSize(null);
          setSelectedCategories((prev) => prev.filter((x) => x === 'help'));
        }
      })
      .catch(() => {});
  }

  async function loadAll() {
    setLoadingData(true);
    setError(null);

    loadPlan();
    fetch('/api/consents')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setHasVolunteerConsent((d.consents ?? []).some((c: { kind: string }) => c.kind === 'volunteer_photos')))
      .catch(() => {});

    // Available cities
    const { data: venues } = await supabase
      .from('venues')
      .select('city')
      .eq('is_active', true)
      .is('deactivated_at', null);
    const cities = new Set((venues ?? []).map((v: any) => (v.city ?? '').toLowerCase()));
    setAvailableCities(cities);

    // Cities with upcoming 1365 volunteer activities (for volunteer quests)
    const { data: programCities } = await supabase
      .from('volunteer_programs')
      .select('city')
      .gte('program_end', new Date().toISOString().slice(0, 10));
    setVolunteerCities(new Set((programCities ?? []).map((p: any) => (p.city ?? '').toLowerCase()).filter(Boolean)));

    // Penalties
    const { data: penalties } = await supabase
      .from('user_penalties')
      .select('freeze_until, strike_number')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    if (penalties && penalties.length > 0) {
      const maxStrike = Math.max(...penalties.map((p: any) => p.strike_number));
      setStrikeCount(maxStrike);
      const activeFreeze = (penalties as any[]).find(
        (p) => p.freeze_until && new Date(p.freeze_until) > new Date()
      );
      if (activeFreeze) {
        setIsFrozen(true);
        setFrozenUntil(activeFreeze.freeze_until);
      }
    }

    // Load matchable status
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('is_matchable')
      .eq('id', user!.id)
      .maybeSingle();
    if (myProfile) setIsMatchable(myProfile.is_matchable ?? true);

    // Match requests
    const { data: reqs } = await supabase
      .from('match_requests')
      .select('id, city, cities, group_size, status, created_at, resolved_at, matched_group_id')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    if (reqs) setRequests(reqs as MatchRequest[]);

    // Matches
       const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id, last_read_at, left_at, accepted_at')
      .eq('user_id', user!.id);

    if (!memberships || memberships.length === 0) {
      setMatches([]);
      setLoadingData(false);
      return;
    }

    const groupIds = memberships.map((m) => m.group_id);

    const { data: groups } = await supabase
      .from('groups')
      .select('id, city, phase, availability_phase_ends_at, quest_scheduled_at, is_pending_invites, created_at, updated_at, completed_at')
      .in('id', groupIds);

    const { data: allMembers } = await supabase
      .from('group_members')
      .select('group_id, user_id, invite_state, accepted_at, left_at, profiles:profiles!inner(id, display_name, photo_url, mbti_type, zodiac_sign, activity_preferences)')
      .in('group_id', groupIds)
      .is('left_at', null);

    const { data: quests } = await supabase
      .from('quests')
      .select(`
        id, group_id, title, title_en, quest_description, description_en, status, expires_at, quest_type,
        venue:venues(id, business_name_display, category, address, road_address, city, photo_urls, per_person_cost_won, discount_offer, discount_offer_en),
        program:volunteer_programs(id, title, title_en, org_name, org_name_en, place, place_en, detail_url)
      `)
      .in('group_id', groupIds);

    const questIds = (quests ?? []).map((q: any) => q.id);
    const { data: questMenus } = questIds.length > 0
      ? await supabase
          .from('quest_menu_items')
          .select('quest_id, menu_item:venue_menu_items!inner(id, name, name_en, price_won, is_signature, photo_url)')
          .in('quest_id', questIds)
      : { data: [] };

    const unreadCounts: Record<string, number> = {};
    for (const membership of memberships) {
      const lastRead = membership.last_read_at ?? '1970-01-01';
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', membership.group_id)
        .eq('is_hidden', false)
        .neq('sender_id', user!.id)
        .gt('created_at', lastRead);
      unreadCounts[membership.group_id] = count ?? 0;
    }

    const { data: submissions } = await supabase
      .from('availability_submissions')
      .select('group_id, user_id')
      .in('group_id', groupIds);

    const submissionCounts: Record<string, number> = {};
    const mySubmitted: Record<string, boolean> = {};
    (submissions ?? []).forEach((s: any) => {
      submissionCounts[s.group_id] = (submissionCounts[s.group_id] ?? 0) + 1;
      if (s.user_id === user!.id) mySubmitted[s.group_id] = true;
    });

    const built: Match[] = (groups ?? []).map((g: any) => {
      const membersRaw = ((allMembers ?? []).filter((m: any) => m.group_id === g.id) as any[]);
      const groupIsActive = ['availability', 'voting', 'scheduled'].includes(g.phase ?? 'availability');
      // Hide people who declined / let the invite expire, and (while the group is running) people who left.
      const visibleMembers = membersRaw.filter((m: any) =>
        m.invite_state !== 'declined' && m.invite_state !== 'expired' && !(groupIsActive && m.left_at)
      );
      const members: GroupMember[] = visibleMembers.map((m: any) => ({
        user_id: m.user_id,
        display_name: m.profiles.display_name,
        photo_url: m.profiles.photo_url,
        mbti_type: m.profiles.mbti_type,
        zodiac_sign: m.profiles.zodiac_sign,
        activity_preferences: m.profiles.activity_preferences,
        invite_state: m.invite_state,
        accepted_at: m.accepted_at,
      }));
      const myMember = membersRaw.find((m: any) => m.user_id === user!.id);

      const quest = (quests as any[])?.find((q: any) => q.group_id === g.id);
      if (!quest) return null;

      const menuItems: QuestMenuItem[] = ((questMenus ?? []).filter((qm: any) => qm.quest_id === quest.id) as any[])
        .map((qm: any) => qm.menu_item);

      return {
        group_id: g.id,
        city: g.city,
        members,
        unread_count: unreadCounts[g.id] ?? 0,
        availability_submitted_count: submissionCounts[g.id] ?? 0,
        my_availability_submitted: mySubmitted[g.id] ?? false,
        quest_scheduled_at: g.quest_scheduled_at ?? null,
        phase: g.phase ?? 'availability',
        // I left (or declined) a group that is still running for others → show it in history.
        i_left: groupIsActive && !!(memberships.find((mm: any) => mm.group_id === g.id)?.left_at),
        history_at:
          g.completed_at ??
          memberships.find((mm: any) => mm.group_id === g.id)?.left_at ??
          g.quest_scheduled_at ??
          g.updated_at ??
          g.created_at ??
          null,
        is_pending_invites: g.is_pending_invites ?? false,
        my_invite_state: myMember?.invite_state ?? null,
        my_invite_expires_at: null,
        quest: {
          id: quest.id,
          title: quest.title,
          title_en: quest.title_en,
          quest_description: quest.quest_description,
          description_en: quest.description_en,
          status: quest.status,
          expires_at: quest.expires_at,
          quest_type: quest.quest_type ?? 'venue',
          venue: quest.venue ?? null,
          program: quest.program ?? null,
          menu_items: menuItems,
        },
      } as Match;
    }).filter(Boolean) as Match[];

    built.sort((a, b) => new Date(a.quest.expires_at).getTime() - new Date(b.quest.expires_at).getTime());
    setMatches(built);

    // Load pending reviews
    try {
      const prResp = await fetch('/api/pending-reviews');
      const prData = await prResp.json();
      setPendingReviews(prData.pending ?? []);
    } catch (e) {
      console.error('Load pending reviews failed:', e);
    }

    setLoadingData(false);
  }

  async function submitMatchRequest(consentJustGiven = false) {
    if (isVolunteerRequest && hasVolunteerConsent === false && !consentJustGiven) {
      askConsent(() => submitMatchRequest(true));
      return;
    }
    if (isFrozen) {
      setError(lang === 'ko' ? '현재 계정이 일시 정지되어 있습니다.' : 'Your account is currently frozen.');
      return;
    }
    if (!randomCity && selectedCities.length === 0) {
      setError(lang === 'ko' ? '도시를 하나 이상 선택해주세요.' : 'Please pick at least one city.');
      return;
    }

    // A venue quest needs at least one chosen city with partner venues.
    if (!isVolunteerRequest && !randomCity && !selectedCities.some((c) => availableCities.has(c))) {
      setError(lang === 'ko'
        ? '선택한 도시에는 아직 제휴 장소가 없어요. 아산이나 천안을 추가하거나 봉사 퀘스트를 선택해 주세요.'
        : 'The cities you picked have no partner venues yet. Add Asan or Cheonan, or pick a 봉사 (volunteer) quest.');
      return;
    }

    if (outOfRequests) {
      setError(planError('monthly_limit', lang));
      return;
    }

    setSubmittingRequest(true);
    setError(null);
    setRequestSuccess(false);

    const { data: insertedRequest, error: err } = await supabase.from('match_requests').insert({
      user_id: user!.id,
      city: randomCity ? null : selectedCities[0],
      cities: randomCity ? null : selectedCities,
      group_size: randomSize ? null : selectedGroupSize,
      preferred_categories: selectedCategories.length > 0 ? selectedCategories : null,
      quest_type: isVolunteerRequest ? 'volunteer' : 'venue',
      status: 'searching',
    }).select('id').single();

    if (err) {
      // The database enforces these rules too (see guard_match_request_insert).
      if (err.message.includes('already_searching')) {
        setError(lang === 'ko' ? '이미 매칭을 찾고 있어요. 진행 중 탭을 확인해 주세요.' : "You're already searching for a match — check the Pending tab.");
      } else if (err.message.includes('finish_onboarding')) {
        setError(lang === 'ko' ? '매칭을 요청하려면 먼저 프로필을 완성해 주세요.' : 'Finish your profile first to request a match.');
      } else if (err.message.includes('account_frozen')) {
        setError(lang === 'ko' ? '현재 계정이 일시 정지되어 있습니다.' : 'Your account is currently frozen.');
      } else if (err.message.includes('too_many_requests')) {
        setError(lang === 'ko' ? '24시간 동안 매칭 요청은 5번까지 할 수 있어요. 잠시 후 다시 시도해 주세요.' : 'You can make up to 5 match requests in 24 hours. Please try again later.');
      } else if (err.message.includes('consent_required')) {
        setHasVolunteerConsent(false);
        askConsent(() => submitMatchRequest(true));
      } else if (planError(err.message, lang)) {
        setError(planError(err.message, lang));
        loadPlan();
      } else {
        console.error('match request failed:', err);
        setError(lang === 'ko' ? '요청하지 못했어요. 다시 시도해 주세요.' : "Couldn't send the request. Please try again.");
      }
      setSubmittingRequest(false);
      return;
    }

    // Try to match right away (the server only processes the caller's own request).
    // If nobody fits yet, the 10-minute cron keeps searching.
    try {
      await fetch('/api/process-match-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: insertedRequest?.id }),
      });
    } catch (e) {
      console.error('Immediate match attempt failed (cron will retry):', e);
    }

    setSubmittingRequest(false);
    setRequestSuccess(true);
    setSelectedCities([]);
    setRandomCity(false);
    setSelectedGroupSize(isFree ? null : 3);
    setRandomSize(isFree);
    setSelectedCategories([]);
    await loadAll();
    setTimeout(() => setActiveTab('pending'), 800);
  }

  async function toggleMatchable() {
    if (!user) return;

    const nextValue = !isMatchable;
    setSavingMatchable(true);

    const { error } = await supabase
      .from('profiles')
      .update({ is_matchable: nextValue })
      .eq('id', user.id);

    if (error) {
      setError(error.message);
    } else {
      setIsMatchable(nextValue);
    }

    setSavingMatchable(false);
  }

  async function cancelRequest(requestId: string) {
    if (!confirm(lang === 'ko' ? '이 요청을 취소하시겠습니까?' : 'Cancel this request?')) return;
    
    // Call the API to properly clean up group + members
    try {
      const resp = await fetch('/api/cancel-match-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: requestId }),
      });
      const result = await resp.json();
      if (result.error) throw new Error(result.error);
      await loadAll();
    } catch (e: any) {
      setError(e.message ?? 'Cancel failed');
    }
  }

  const cityDisplayName = (slug: string | null): string => {
    if (!slug) return lang === 'ko' ? '랜덤' : 'Random';
    const c = KOREAN_CITIES.find((c) => c.slug === slug);
    if (!c) return slug;
    return lang === 'ko' ? c.name_ko : c.name_en;
  };
  const requestCitiesLabel = (req: MatchRequest): string =>
    req.cities && req.cities.length > 0 ? req.cities.map(cityDisplayName).join(', ') : cityDisplayName(req.city);

  function daysRemaining(expiresAt: string): number {
    const ms = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  // Split
  const isClosed = (m: Match) =>
    m.quest.status === 'completed' || m.quest.status === 'cancelled' ||
    m.phase === 'cancelled' || m.phase === 'completed' || m.i_left;
  const pendingMatches = matches.filter((m) => !isClosed(m));
  const historyMatches = matches.filter((m) => isClosed(m));
  const activeRequests = requests.filter((r) => r.status === 'searching');
  const pastRequests = requests.filter((r) => r.status !== 'searching');
  // History: finished groups and past requests in one list, newest first.
  const timeOf = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() || 0 : 0);
  const historyItems = [
    ...historyMatches.map((m) => ({ kind: 'match' as const, at: timeOf(m.history_at ?? m.quest.expires_at), match: m })),
    ...pastRequests.map((r) => ({ kind: 'request' as const, at: timeOf(r.resolved_at ?? r.created_at), req: r })),
  ].sort((a, b) => b.at - a.at);
  const totalPending = pendingMatches.length + activeRequests.length;

  // Swipe handlers
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchEndX.current = null;
  }
  function handleTouchMove(e: React.TouchEvent) {
    touchEndX.current = e.touches[0].clientX;
  }
  function handleTouchEnd() {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const dx = touchEndX.current - touchStartX.current;
    const threshold = 60;
    if (Math.abs(dx) < threshold) return;

    const tabs: Tab[] = ['pending', 'request', 'history'];
    const currentIdx = tabs.indexOf(activeTab);
    if (dx < 0 && currentIdx < tabs.length - 1) setActiveTab(tabs[currentIdx + 1]);
    if (dx > 0 && currentIdx > 0) setActiveTab(tabs[currentIdx - 1]);

    touchStartX.current = null;
    touchEndX.current = null;
  }

  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  async function acceptInvite(groupId: string) {
    setRespondingTo(groupId);
    setError(null);
    try {
      const resp = await fetch('/api/accept-match-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId }),
      });
      const result = await resp.json();
      if (result.error === 'consent_required') {
        // Volunteer group: agree to the photo consent first, then accept.
        setRespondingTo(null);
        askConsent(() => acceptInvite(groupId));
        return;
      }
      if (result.error) throw new Error(result.error);
      await loadAll();
    } catch (e: any) {
      setError(e.message ?? 'Accept failed');
    }
    setRespondingTo(null);
  }

  async function declineInvite(groupId: string) {
    if (!confirm(lang === 'ko' ? '이 매칭 초대를 거절하시겠습니까?' : 'Decline this match invite?')) return;
    setRespondingTo(groupId);
    setError(null);
    try {
      const resp = await fetch('/api/decline-match-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId }),
      });
      const result = await resp.json();
      if (result.error) throw new Error(result.error);
      await loadAll();
    } catch (e: any) {
      setError(e.message ?? 'Decline failed');
    }
    setRespondingTo(null);
  }

  async function leaveGroup(groupId: string, isConfirmed: boolean) {
    const msg = isConfirmed
      ? (lang === 'ko'
          ? '정말 이 그룹을 나가시겠습니까?\n\n확정된 그룹을 나가면 경고 1회가 부과돼요 (3회: 48시간 정지, 4회 이상: 1주일 정지). 남은 멤버가 2명 이상이면 그룹은 계속 진행돼요.'
          : 'Leave this group?\n\nLeaving a confirmed group gives you a strike (3rd strike: 48h freeze, 4th+: 1 week). If 2 or more people remain, the group continues without you.')
      : (lang === 'ko'
          ? '이 그룹을 나가시겠습니까? 아직 확정 전이라 경고는 없어요.'
          : "Leave this group? It isn't confirmed yet, so there's no strike.");
    if (!confirm(msg)) return;
    setRespondingTo(groupId);
    setError(null);
    try {
      const resp = await fetch('/api/leave-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId }),
      });
      const result = await resp.json();
      if (result.error) {
        if (result.error === 'meetup_already_started') {
          throw new Error(lang === 'ko' ? '만남이 이미 시작되어 나갈 수 없어요.' : 'The meetup has already started, so you can no longer leave.');
        }
        throw new Error(result.error);
      }
      await loadAll();
    } catch (e: any) {
      setError(e.message ?? 'Leave failed');
    }
    setRespondingTo(null);
  }

  if (!loading && user && venueOnly) {
    return <VenueAccountMatches lang={lang} setLang={setLang} />;
  }

  if (loading || loadingData) {
    return (
      <main className="loading-wrap">
        <div className="loader" />
        <style jsx>{`
          .loading-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
          .loader { width: 40px; height: 40px; border: 3px solid var(--ink-12); border-top-color: var(--persimmon); border-radius: 50%; animation: spin 0.8s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </main>
    );
  }

  if (!user) return null;

  return (
    <>
      <AppHeader lang={lang} setLang={setLang} />

      {/* Top tab bar */}
      <div className="tab-bar-wrap">
        <div className="wrap tab-bar">
          <button
            className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            {lang === 'ko' ? '진행 중' : 'Pending'}
            {totalPending > 0 && <span className="tab-count">{totalPending}</span>}
          </button>
          <button
            className={`tab ${activeTab === 'request' ? 'active' : ''}`}
            onClick={() => setActiveTab('request')}
          >
            {lang === 'ko' ? '매칭 요청' : 'Request a match'}
          </button>
          <button
            className={`tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            {lang === 'ko' ? '기록' : 'History'}
          </button>
        </div>
      </div>

      <main
        className="wrap main-wrap"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* ============ PENDING TAB ============ */}
        {activeTab === 'pending' && (
          <>
            {/* Pending reviews banner */}
            {pendingReviews.length > 0 && (
              <div className="review-banner-list">
                {pendingReviews.map((pr: any) => (
                  <a key={pr.quest_id} href={`/matches/review/${pr.quest_id}`} className="review-banner">
                    <div className="rb-icon"><Icon name="matches" size={30} /></div>
                    <div className="rb-content">
                      <div className="rb-title">
                        {lang === 'ko' ? '리뷰를 남겨주세요' : 'Leave a review'}
                      </div>
                      <div className="rb-sub">
                        {lang === 'ko'
                          ? `${pr.venue_name}에서의 만남을 리뷰해주세요 · ${pr.unreviewed_members.length}명 대기 중`
                          : `Your meetup at ${pr.venue_name} · ${pr.unreviewed_members.length} to review`}
                      </div>
                    </div>
                    <div className="rb-arrow">→</div>
                  </a>
                ))}
              </div>
            )}

            {/* Searching requests */}
            {activeRequests.length > 0 && (
              <div className="active-requests">
                {activeRequests.map((req) => (
                  <div key={req.id} className="searching-card">
                    <div className="searching-left">
                      <div className="pulse-wrap">
                        <div className="pulse-dot" />
                      </div>
                      <div>
                        <div className="searching-title">
                          {lang === 'ko' ? '매칭 찾는 중…' : 'Searching for your match…'}
                        </div>
                        <div className="searching-meta">
                          {requestCitiesLabel(req)} · {req.group_size ?? (lang === 'ko' ? '랜덤 인원' : 'Random size')}
                        </div>
                        <div className="searching-est">
                          <Icon name="time" size={16} /> {lang === 'ko' ? '예상 시간: 몇 시간 정도 걸릴 수 있어요' : 'Est. wait: could be a few hours'}
                        </div>
                      </div>
                    </div>
                    <button className="cancel-btn" onClick={() => cancelRequest(req.id)}>
                      {lang === 'ko' ? '취소' : 'Cancel'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {pendingMatches.length === 0 && activeRequests.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><Icon name="matches" size={56} /></div>
                <h2>
                  {lang === 'ko' ? '아직 매칭이 없어요' : 'No matches yet'}
                </h2>
                <p>
                  {lang === 'ko'
                    ? '매칭 요청 탭에서 새로운 친구를 찾아보세요.'
                    : "Head to the Request tab to find new friends."}
                </p>
                <button className="cta-btn" onClick={() => setActiveTab('request')}>
                  {lang === 'ko' ? '매칭 요청하기' : 'Request a match →'}
                </button>
              </div>
            ) : (
              <div className="matches-list">
                {pendingMatches.map((match) => (
                  <FullMatchCard
                    key={match.group_id}
                    match={match}
                    lang={lang}
                    user={user}
                    onAccept={acceptInvite}
                    onDecline={declineInvite}
                    onLeave={leaveGroup}
                    respondingTo={respondingTo}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ============ REQUEST TAB ============ */}
        {activeTab === 'request' && (
          <div className="request-container">
            <div className="request-hero">
              <h1>{lang === 'ko' ? '매칭 요청' : 'Request a match'}</h1>
              <p>
                {isFree
                  ? (lang === 'ko' ? '만나고 싶은 도시를 고르면 그룹을 찾아드려요.' : "Pick where you'd like to meet and we'll find your group.")
                  : (lang === 'ko' ? '도시와 인원을 선택하고 새로운 친구를 만나보세요.' : 'Pick a city and group size to meet new friends.')}
              </p>
              {plan && (
                plan.plus ? (
                  <a className="plan-tag plus" href="/plus"><Icon name="plus" size={16} /> Doreham+</a>
                ) : !plan.enforced ? (
                  <a className="plan-tag plus" href="/plus">
                    <Icon name="events" size={16} /> {lang === 'ko' ? '테스트 기간 · 모든 기능 무료' : 'Test period · everything is free'}
                  </a>
                ) : (
                  <a className="plan-tag" href="/plus">
                    {lang === 'ko'
                      ? `무료 플랜 · 이번 달 요청 ${requestsLeft}/${FREE_MATCH_REQUESTS_PER_MONTH}번 남음 · 봉사 무제한`
                      : `Free plan · ${requestsLeft} of ${FREE_MATCH_REQUESTS_PER_MONTH} requests left this month · 봉사 unlimited`}
                  </a>
                )
              )}
            </div>

            <div className="matchable-toggle">
              <div className="matchable-left">
                <div className="matchable-title">
                  <Icon name={isMatchable ? 'done' : 'pending'} size={18} />{' '}
                  {lang === 'ko' ? '매칭 활성화' : 'Matching enabled'}
                </div>
                <div className="matchable-sub">
                  {isMatchable
                    ? (lang === 'ko' ? '다른 사용자의 매칭 초대를 받을 수 있어요.' : 'You can receive match invites from other users.')
                    : (lang === 'ko' ? '매칭 초대를 받지 않습니다.' : "You won't receive any match invites.")}
                </div>
              </div>
              <button
                className={`toggle-switch ${isMatchable ? 'on' : 'off'}`}
                onClick={toggleMatchable}
                disabled={savingMatchable}
                aria-label="Toggle matchable"
              >
                <div className="switch-knob" />
              </button>
            </div>

            {isFrozen ? (
              <div className="frozen-notice">
                <div className="frozen-icon"><Icon name="icebreaker" size={48} /></div>
                <h3>{lang === 'ko' ? '계정 일시 정지' : 'Account frozen'}</h3>
                <p className="frozen-when">
                  {lang === 'ko'
                    ? `해제 시간: ${frozenUntil ? new Date(frozenUntil).toLocaleString('ko-KR') : ''}`
                    : `Until: ${frozenUntil ? new Date(frozenUntil).toLocaleString('en-US') : ''}`}
                </p>
                <p className="frozen-note">
                  {lang === 'ko'
                    ? '매칭 취소가 반복되어 일시 정지되었습니다.'
                    : 'Frozen due to repeated cancellations.'}
                </p>
              </div>
            ) : activeRequests.length > 0 ? (
              <div className="already-searching">
                <div className="pulse-wrap large"><div className="pulse-dot" /></div>
                <h3>{lang === 'ko' ? '이미 매칭을 찾고 있어요' : "You're already in the queue"}</h3>
                <p>
                  {lang === 'ko'
                    ? '진행 중 탭에서 요청 상태를 확인하세요.'
                    : 'Check the Pending tab to see your request status.'}
                </p>
                <button className="cta-btn secondary" onClick={() => setActiveTab('pending')}>
                  {lang === 'ko' ? '진행 중 보기' : 'View pending →'}
                </button>
              </div>
            ) : (
              <>
                {strikeCount > 0 && (
                  <div className="strike-warning">
                    <Icon name="warning" size={18} /> {lang === 'ko' ? `주의: ${strikeCount}회 취소 기록` : `Heads up: ${strikeCount} previous strike${strikeCount > 1 ? 's' : ''}`}
                  </div>
                )}

                {/* City */}
                <div className="form-section">
                  <label className="form-label">
                    <Icon name="map" size={18} /> {lang === 'ko' ? `도시 선택 (최대 ${MAX_REQUEST_CITIES}곳)` : `Pick cities (up to ${MAX_REQUEST_CITIES})`}
                  </label>
                  <p className="form-hint">
                    {lang === 'ko'
                      ? '여러 도시를 고르면 더 빨리 매칭될 수 있어요.'
                      : 'Pick more than one city to get matched faster.'}
                  </p>
                  <div className="cities-grid">
                    <button
                      className={`city-card random ${randomCity ? 'selected' : ''}`}
                      onClick={() => { setRandomCity(!randomCity); if (!randomCity) setSelectedCities([]); }}
                    >
                      <div className="city-emoji"><Icon name="explore" size={30} /></div>
                      <div className="city-name">
                        {lang === 'ko' ? '어디든' : 'Anywhere'}
                      </div>
                    </button>
                    {KOREAN_CITIES.map((c) => {
                      const hasVenues = citiesForRequest.has(c.slug);
                      const isSelected = selectedCities.includes(c.slug) && !randomCity;
                      return (
                        <button
                          key={c.slug}
                          className={`city-card ${isSelected ? 'selected' : ''} ${!hasVenues ? 'disabled' : ''}`}
                          onClick={() => {
                            if (!hasVenues) return;
                            setRandomCity(false);
                            setError(null);
                            if (isSelected) {
                              setSelectedCities((prev) => prev.filter((x) => x !== c.slug));
                            } else if (selectedCities.length >= MAX_REQUEST_CITIES) {
                              setError(lang === 'ko'
                                ? `도시는 최대 ${MAX_REQUEST_CITIES}곳까지 고를 수 있어요.`
                                : `You can pick up to ${MAX_REQUEST_CITIES} cities.`);
                            } else {
                              setSelectedCities((prev) => [...prev, c.slug]);
                            }
                          }}
                          disabled={!hasVenues}
                          title={!hasVenues ? (lang === 'ko' ? '아직 준비 중' : 'Coming soon') : ''}
                        >
                          <div className="city-emoji"><Icon name={c.icon} size={30} /></div>
                          <div className="city-name">
                            {lang === 'ko' ? c.name_ko : c.name_en}
                          </div>
                          {!hasVenues && (
                            <div className="city-soon">
                              {lang === 'ko' ? '준비 중' : 'Soon'}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {!randomCity && citiesWithoutQuests.length > 0 && (
                    <div className="volunteer-hint quiet">
                      {isVolunteerRequest
                        ? (lang === 'ko'
                            ? `${citiesWithoutQuests.map(cityDisplayName).join(', ')}: 지금 모집 중인 1365 봉사활동을 아직 찾지 못했어요. 그래도 신청할 수 있어요. 1365를 하루 두 번 확인하고, 24시간 안에 맞는 활동이 없으면 알려 드릴게요.`
                            : `${citiesWithoutQuests.map(cityDisplayName).join(', ')}: no open 1365 activities found yet. You can still request: we check 1365 twice a day and will let you know within 24 hours if nothing fits.`)
                        : (lang === 'ko'
                            ? `${citiesWithoutQuests.map(cityDisplayName).join(', ')}: 아직 제휴 장소가 없어요. 이 도시에서는 봉사 퀘스트만 가능하고, 장소가 등록되면 다른 퀘스트도 열려요.`
                            : `${citiesWithoutQuests.map(cityDisplayName).join(', ')}: no partner venues yet. Only 봉사 (volunteer) quests run there until venues join.`)}
                    </div>
                  )}
                </div>

                {/* Categories */}
                <div className="form-section">
                  <label className="form-label">
                    <Icon name="goal" size={18} /> {lang === 'ko' ? '카테고리 선택 (선택 사항)' : 'Pick categories (optional)'}
                    {isFree && <a className="plus-chip" href="/plus"><Icon name="plus" size={14} /> Doreham+</a>}
                  </label>
                  <p className="form-hint">
                    {isFree
                      ? (lang === 'ko'
                          ? '무료 플랜은 모든 카테고리에서 매칭돼요. 봉사 퀘스트는 누구나 고를 수 있어요.'
                          : 'On the free plan you match with any category. Anyone can pick a 봉사 volunteer quest.')
                      : (lang === 'ko'
                          ? '아무것도 선택하지 않으면 모든 카테고리에서 매칭됩니다'
                          : 'Leave empty to match with any category')}
                  </p>
                  <div className="cat-grid">
                    {MATCH_CATEGORIES.map((c) => {
                      const isSelected = selectedCategories.includes(c.slug);
                      const planLocked = isFree && !c.volunteer; // free plan: only 봉사 can be picked
                      return (
                        <button
                          key={c.slug}
                          className={`cat-card ${isSelected ? 'selected' : ''} ${c.coming_soon ? 'disabled' : ''} ${planLocked && !c.coming_soon ? 'locked' : ''}`}
                          onClick={() => {
                            if (c.coming_soon) return;
                            if (planLocked) {
                              setPlanNote(lang === 'ko' ? '카테고리 선택은 Doreham+ 기능이에요.' : 'Choosing categories is part of Doreham+.');
                              return;
                            }
                            setSelectedCategories((prev) => {
                              if (isSelected) return prev.filter((x) => x !== c.slug);
                              if (c.volunteer) return [c.slug];                 // 봉사 alone
                              return [...prev.filter((x) => x !== 'help'), c.slug];
                            });
                            // A city chosen for venues may have no volunteer activities (and vice versa)
                            const nextIsVolunteer = c.volunteer ? !isSelected : false;
                            const nextCities: ReadonlySet<string> = nextIsVolunteer ? VOLUNTEER_CITY_SET : venueCities;
                            setSelectedCities((prev) => prev.filter((x) => nextCities.has(x)));
                          }}
                          disabled={c.coming_soon}
                          title={c.coming_soon ? (lang === 'ko' ? '곧 출시' : 'Coming soon') : ''}
                        >
                          <span className="cat-icon"><CategoryIcon art={c.icon as CategoryArt} size={44} /></span>
                          <div className="cat-name">{lang === 'ko' ? c.label_ko : c.label_en}</div>
                          {c.coming_soon && <div className="cat-soon">{lang === 'ko' ? '준비 중' : 'Soon'}</div>}
                          {planLocked && !c.coming_soon && <div className="cat-lock" aria-hidden="true"><Icon name="lock" size={16} /></div>}
                        </button>
                      );
                    })}
                  </div>
                  {isVolunteerRequest && (
                    <div className="volunteer-hint">
                      <Icon name="volunteer" size={18} />{' '}
                      {lang === 'ko'
                        ? '봉사 퀘스트: 그룹이 함께할 1365 봉사활동을 찾아드려요. 각자 1365에서 무료로 신청하고, 당일에 단체 사진 한 장만 찍으면 끝! 봉사시간은 1365에 그대로 인정돼요.'
                        : "Volunteer quest: we'll find a 1365 volunteer activity for your group. Each of you signs up on 1365 (free), and on the day you just take one group selfie. Your hours count on 1365 as usual."}
                    </div>
                  )}
                </div>

                {/* Group size */}
                <div className="form-section">
                  <label className="form-label">
                    <Icon name="people" size={18} /> {lang === 'ko' ? '인원 선택' : 'Group size'}
                    {isFree && <a className="plus-chip" href="/plus"><Icon name="plus" size={14} /> Doreham+</a>}
                  </label>
                  {isFree && (
                    <p className="form-hint">
                      {lang === 'ko' ? '무료 플랜은 랜덤 인원(2–5명)으로 매칭돼요.' : 'On the free plan your group size is random (2–5 people).'}
                    </p>
                  )}
                  <div className="size-options">
                    {[2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        className={`size-btn ${!randomSize && selectedGroupSize === n ? 'selected' : ''} ${isFree ? 'locked' : ''}`}
                        onClick={() => {
                          if (isFree) {
                            setPlanNote(lang === 'ko' ? '인원 선택은 Doreham+ 기능이에요.' : 'Picking the group size is part of Doreham+.');
                            return;
                          }
                          setRandomSize(false); setSelectedGroupSize(n);
                        }}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      className={`size-btn size-random ${randomSize ? 'selected' : ''}`}
                      onClick={() => {
                        if (isFree) return; // random is the only option on the free plan
                        setRandomSize(!randomSize); if (!randomSize) setSelectedGroupSize(null);
                      }}
                    >
                      <Icon name="explore" size={18} /> {lang === 'ko' ? '랜덤' : 'Random'}
                    </button>
                  </div>
                </div>

                {planNote && (
                  <div className="plan-note">
                    <Icon name="plus" size={16} /> {planNote}{' '}
                    <a href="/plus">{lang === 'ko' ? 'Doreham+ 보기 →' : 'See Doreham+ →'}</a>
                  </div>
                )}
                {outOfRequests && (
                  <div className="plan-note">
                    {planError('monthly_limit', lang)}{' '}
                    <a href="/plus">{lang === 'ko' ? 'Doreham+ 보기 →' : 'See Doreham+ →'}</a>
                  </div>
                )}
                {error && <div className="error-msg">{error}</div>}
                {requestSuccess && (
                  <div className="success-msg">
                    ✓ {lang === 'ko' ? '요청 접수 완료!' : 'Request submitted!'}
                  </div>
                )}

                <button className="find-btn" onClick={() => submitMatchRequest()} disabled={submittingRequest || outOfRequests}>
                  {submittingRequest
                    ? (lang === 'ko' ? '요청 중…' : 'Requesting…')
                    : <><Icon name="search" size={18} tone="light" /> {lang === 'ko' ? '매칭 찾기' : 'Find a match'}</>}
                </button>

                <div className="commit-note">
                  <Icon name="tip" size={16} />{' '}
                  {lang === 'ko'
                    ? '매칭 확정 후 취소하면 경고를 받습니다. 3회 이상 취소 시 계정이 일시 정지됩니다.'
                    : 'Cancelling after a match is confirmed counts as a strike. 3 strikes → account frozen.'}
                </div>
              </>
            )}
          </div>
        )}

        {/* ============ HISTORY TAB ============ */}
        {activeTab === 'history' && (
          <>
            {historyMatches.length === 0 && pastRequests.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><Icon name="doc" size={52} /></div>
                <h2>{lang === 'ko' ? '아직 기록이 없어요' : 'No history yet'}</h2>
                <p>{lang === 'ko' ? '완료된 매칭과 지난 요청이 여기에 표시됩니다.' : 'Completed matches and past requests will appear here.'}</p>
              </div>
            ) : (
              <div className="history-list">
                {historyItems.map((item) =>
                  item.kind === 'match' ? (
                    <FullMatchCard
                      key={item.match.group_id}
                      match={item.match}
                      lang={lang}
                      user={user}
                      isHistory
                      onAccept={acceptInvite}
                      onDecline={declineInvite}
                      respondingTo={respondingTo}
                    />
                  ) : (
                    <div key={item.req.id} className="request-history-card">
                      <div className="history-status">
                        {item.req.status === 'no_match_found'
                          ? `✗ ${lang === 'ko' ? '매칭 실패' : 'No match found'}`
                          : item.req.status === 'cancelled_by_user'
                            ? `✗ ${lang === 'ko' ? '요청 취소됨' : 'Request cancelled'}`
                            : item.req.status === 'expired'
                              ? `${lang === 'ko' ? '만료됨' : 'Expired'}`
                              : item.req.status === 'matched'
                                ? `✓ ${lang === 'ko' ? '매칭됨' : 'Matched'}`
                                : item.req.status}
                      </div>
                      <div className="history-body">
                        <div className="history-title">
                          {requestCitiesLabel(item.req)} · {item.req.group_size ?? (lang === 'ko' ? '랜덤 인원' : 'Random size')}
                        </div>
                        <div className="history-date">
                          {new Date(item.req.resolved_at ?? item.req.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
                            year: 'numeric', month: 'long', day: 'numeric',
                          })}
                        </div>
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </>
        )}
      </main>

      <VolunteerConsentModal
        lang={lang}
        open={consentOpen}
        onClose={() => { setConsentOpen(false); afterConsent.current = null; }}
        onAgreed={() => {
          setConsentOpen(false);
          setHasVolunteerConsent(true);
          const next = afterConsent.current;
          afterConsent.current = null;
          next?.();
        }}
      />

      <AppTabBar lang={lang} />

      <style jsx>{`
        .v-nav { background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); position: sticky; top: 0; z-index: 20; backdrop-filter: blur(8px); }
        .v-nav-in { display: flex; align-items: center; justify-content: space-between; height: 68px; }
        .brand { display: flex; align-items: baseline; gap: 9px; font-family: var(--display); font-weight: 800; font-size: 20px; text-decoration: none; color: var(--ink); }
        .ko-mark { color: var(--ink-60); font-weight: 700; font-size: 17px; }
        .toggle { display: inline-flex; border: 1px solid var(--ink-12); border-radius: 999px; overflow: hidden; background: var(--paper-2); }
        .toggle button { border: 0; background: transparent; font-family: var(--body); font-weight: 600; font-size: 13px; padding: 7px 13px; cursor: pointer; color: var(--ink-60); }
        .toggle button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }

        /* Tab bar */
        .tab-bar-wrap { background: rgba(245, 242, 235, 0.95); border-bottom: 1px solid var(--ink-12); position: sticky; top: 64px; z-index: 15; backdrop-filter: blur(8px); }
        .tab-bar {
          display: flex;
          gap: 4px;
          padding: 8px 12px 0;
          max-width: 900px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .tab-bar::-webkit-scrollbar { display: none; }
        .tab {
          position: relative;
          background: transparent;
          border: 0;
          padding: 14px 20px;
          font-family: var(--body);
          font-weight: 700;
          font-size: 15px;
          color: var(--ink-60);
          cursor: pointer;
          white-space: nowrap;
          border-bottom: 3px solid transparent;
          transition: color 0.15s, border-color 0.15s;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tab:hover { color: var(--ink); }
        .tab.active { color: var(--persimmon); border-bottom-color: var(--persimmon); }
        .tab-count {
          background: var(--persimmon);
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 999px;
          min-width: 20px;
          text-align: center;
        }

        .main-wrap { padding: 32px 24px 48px; max-width: 900px; min-height: 60vh; }

        /* Empty states */
        .empty-state { text-align: center; padding: 80px 20px; background: var(--paper-2); border-radius: 24px; }
        .empty-icon { display: flex; justify-content: center; margin-bottom: 20px; }
        .empty-state h2 { font-family: var(--display); font-weight: 700; font-size: 24px; margin: 0 0 8px; }
        .empty-state p { color: var(--ink-60); font-size: 16px; margin: 0 0 24px; max-width: 500px; margin-left: auto; margin-right: auto; }
        .cta-btn {
          background: var(--persimmon);
          color: #fff;
          border: 0;
          padding: 12px 26px;
          border-radius: 999px;
          font-family: var(--body);
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
        }
        .cta-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .cta-btn.secondary { background: transparent; color: var(--ink); border: 1px solid var(--ink-12); }
        .cta-btn.secondary:hover { background: var(--paper-2); box-shadow: none; transform: none; }

        /* PENDING tab: searching cards */
        .active-requests { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
        .searching-card {
          display: flex; justify-content: space-between; align-items: center; gap: 16px;
          background: linear-gradient(135deg, rgba(255, 106, 61, 0.06), rgba(255, 106, 61, 0.02));
          border: 2px solid rgba(255, 106, 61, 0.25);
          border-radius: 16px;
          padding: 18px 20px;
        }
        .searching-left { display: flex; align-items: center; gap: 14px; }
        .pulse-wrap { position: relative; width: 40px; height: 40px; display: grid; place-items: center; flex-shrink: 0; }
        .pulse-wrap.large { width: 60px; height: 60px; }
        .pulse-dot { width: 16px; height: 16px; border-radius: 50%; background: var(--persimmon); position: relative; }
        .pulse-wrap.large .pulse-dot { width: 24px; height: 24px; }
        .pulse-dot::before, .pulse-dot::after {
          content: ''; position: absolute; inset: -8px;
          border-radius: 50%; border: 2px solid var(--persimmon);
          animation: pulse-ring 2s infinite; opacity: 0;
        }
        .pulse-dot::after { animation-delay: 1s; }
        @keyframes pulse-ring {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(2); opacity: 0; }
        }
        .searching-title { font-family: var(--display); font-weight: 800; font-size: 17px; color: var(--ink); margin-bottom: 2px; }
        .searching-meta { font-size: 13px; color: var(--ink); font-weight: 600; }
        .searching-est { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--ink-60); margin-top: 2px; }
        .cancel-btn {
          background: transparent; border: 1px solid var(--ink-12);
          padding: 8px 16px; border-radius: 999px;
          font-family: var(--body); font-weight: 600; font-size: 13px;
          color: var(--ink-60); cursor: pointer; flex-shrink: 0;
        }
        .cancel-btn:hover { color: var(--persimmon); border-color: var(--persimmon); }

        .matches-list, .history-list { display: flex; flex-direction: column; gap: 20px; }

        /* REQUEST tab */
        .request-container { max-width: 700px; margin: 0 auto; }
        .request-hero { text-align: center; margin-bottom: 32px; }
        .request-hero h1 { font-family: var(--display); font-weight: 800; font-size: 32px; margin: 0 0 8px; letter-spacing: -0.02em; }
        .request-hero p { color: var(--ink-60); font-size: 15px; margin: 0 0 16px; }
        .plan-tag { display: inline-flex; align-items: center; gap: 5px; background: #fff; border: 1px solid var(--ink-12); color: var(--ink-60); font-weight: 700; font-size: 12.5px; padding: 6px 14px; border-radius: 999px; text-decoration: none; line-height: 1.4; }
        .plan-tag.plus { background: linear-gradient(135deg, rgba(255, 106, 61, 0.12), rgba(199, 184, 224, 0.25)); border-color: rgba(255, 106, 61, 0.35); color: var(--persimmon); }
        .plus-chip { display: inline-flex; align-items: center; gap: 3px; text-transform: none; letter-spacing: 0; margin-left: 8px; font-size: 11px; font-weight: 800; color: var(--persimmon); background: rgba(255, 106, 61, 0.1); border-radius: 999px; padding: 3px 9px; text-decoration: none; vertical-align: middle; }
        .plan-note { background: rgba(199, 184, 224, 0.18); border: 1px solid rgba(199, 184, 224, 0.6); color: var(--ink); padding: 12px 16px; border-radius: 12px; font-size: 14px; margin-bottom: 16px; line-height: 1.5; }
        .plan-note a { color: var(--persimmon); font-weight: 700; text-decoration: none; white-space: nowrap; }
        .cat-card.locked { opacity: 0.55; }
        .cat-card.locked:hover:not(.disabled) { transform: none; border-color: var(--ink-12); }
        .cat-lock { position: absolute; top: 4px; right: 6px; display: flex; }
        .size-btn.locked { opacity: 0.45; cursor: not-allowed; }
        .size-btn.locked:hover, .size-btn.locked.selected { transform: none; border-color: var(--ink-12); }

        .frozen-notice { text-align: center; padding: 60px 30px; background: rgba(91, 124, 250, 0.06); border: 1px solid rgba(91, 124, 250, 0.2); border-radius: 20px; }
        .frozen-icon { display: flex; justify-content: center; margin-bottom: 16px; }
        .frozen-notice h3 { font-family: var(--display); font-size: 24px; margin: 0 0 12px; color: var(--ink); }
        .frozen-when { font-weight: 700; color: var(--ink); font-size: 15px; margin: 0 0 6px; }
        .frozen-note { font-size: 13px; color: var(--ink-60); font-style: italic; margin: 0; }

        .already-searching { text-align: center; padding: 60px 30px; background: rgba(255, 106, 61, 0.04); border-radius: 20px; }
        .already-searching .pulse-wrap { margin: 0 auto 16px; }
        .already-searching h3 { font-family: var(--display); font-size: 22px; margin: 0 0 8px; }
        .already-searching p { color: var(--ink-60); font-size: 14px; margin: 0 0 20px; }

        .strike-warning { background: rgba(232, 169, 63, 0.15); color: #a86720; padding: 12px 18px; border-radius: 12px; font-size: 13px; font-weight: 600; margin-bottom: 20px; text-align: center; border: 1px solid rgba(232, 169, 63, 0.3); }

        .form-section { margin-bottom: 24px; }
        .form-label { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-family: var(--display); font-weight: 700; font-size: 14px; color: var(--ink); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; }

        .cities-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(105px, 1fr)); gap: 8px; }
        .city-card {
          display: flex; flex-direction: column; align-items: center; gap: 4px;
          padding: 16px 8px;
          background: #fff;
          border: 2px solid var(--ink-12);
          border-radius: 14px;
          cursor: pointer;
          transition: all 0.15s;
          font-family: var(--body);
          position: relative;
        }
        .city-card:hover:not(.disabled) { transform: translateY(-2px); border-color: var(--persimmon); box-shadow: 0 6px 16px rgba(255, 106, 61, 0.15); }
        .city-card.selected { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.08); }
        .city-card.disabled { opacity: 0.4; cursor: not-allowed; }
        .city-card.random { background: linear-gradient(135deg, rgba(255, 106, 61, 0.05), rgba(15, 157, 119, 0.05)); }
        .city-emoji { display: flex; justify-content: center; }
        .city-name { font-weight: 700; font-size: 13px; color: var(--ink); }
        .city-soon { font-size: 10px; color: var(--ink-60); font-weight: 600; }
        .form-hint { font-size: 12px; color: var(--ink-60); margin: 0 0 12px; }
        .cat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 8px; }
        .cat-card { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 12px 6px; background: #fff; border: 2px solid var(--ink-12); border-radius: 12px; cursor: pointer; transition: all 0.15s; position: relative; }
        .cat-card:hover:not(.disabled) { transform: translateY(-2px); border-color: var(--persimmon); }
        .cat-card.selected { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.08); }
        .cat-card.disabled { opacity: 0.4; cursor: not-allowed; }
        .volunteer-hint.quiet { background: rgba(255, 106, 61, 0.08); }
        .volunteer-hint { margin-top: 12px; padding: 12px 14px; border-radius: 12px; background: rgba(15, 157, 119, 0.08); color: var(--ink); font-size: 13.5px; line-height: 1.6; }
        .cat-icon { display: flex; }
        .cat-name { font-weight: 700; font-size: 11px; color: var(--ink); text-align: center; line-height: 1.2; }
        .cat-soon { font-size: 9px; color: var(--ink-60); font-weight: 600; }

        .size-options { display: flex; gap: 8px; flex-wrap: wrap; }
        .size-btn {
          padding: 14px 24px;
          background: #fff;
          border: 2px solid var(--ink-12);
          border-radius: 14px;
          font-family: var(--body);
          font-weight: 800;
          font-size: 18px;
          cursor: pointer;
          color: var(--ink);
          min-width: 60px;
        }
        .size-btn.size-random { font-size: 14px; min-width: auto; display: inline-flex; align-items: center; gap: 5px; }
        .size-btn:hover { border-color: var(--persimmon); transform: translateY(-1px); }
        .size-btn.selected { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.08); color: var(--persimmon); }

        .error-msg { background: rgba(255, 106, 61, 0.1); color: var(--persimmon); border: 1px solid rgba(255, 106, 61, 0.25); padding: 12px 16px; border-radius: 12px; font-size: 14px; margin-bottom: 16px; }
        .success-msg { background: rgba(15, 157, 119, 0.1); color: var(--jade); border: 1px solid rgba(15, 157, 119, 0.25); padding: 12px 16px; border-radius: 12px; font-size: 14px; margin-bottom: 16px; text-align: center; font-weight: 600; }

        .find-btn {
          width: 100%;
          background: var(--persimmon);
          color: #fff;
          border: 0;
          padding: 18px 28px;
          border-radius: 14px;
          font-family: var(--body);
          font-weight: 800;
          font-size: 17px;
          cursor: pointer;
          transition: transform 0.12s, box-shadow 0.12s;
        }
        .find-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(255, 106, 61, 0.35); }
        .find-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .commit-note { font-size: 12px; color: var(--ink-60); margin-top: 16px; text-align: center; line-height: 1.5; padding: 0 20px; }

        .matchable-toggle {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          background: #fff;
          border: 1px solid var(--ink-12);
          border-radius: 14px;
          padding: 14px 18px;
          margin-bottom: 24px;
        }
        .matchable-left { flex: 1; min-width: 0; }
        .matchable-title { display: flex; align-items: center; gap: 4px; font-weight: 700; font-size: 15px; color: var(--ink); margin-bottom: 2px; }
        .matchable-sub { font-size: 12px; color: var(--ink-60); line-height: 1.4; }
        .toggle-switch {
          width: 48px; height: 28px;
          border-radius: 999px;
          border: 0;
          padding: 3px;
          cursor: pointer;
          transition: background 0.15s;
          flex-shrink: 0;
          position: relative;
        }
        .toggle-switch.on { background: var(--jade); }
        .toggle-switch.off { background: var(--ink-12); }
        .toggle-switch:disabled { opacity: 0.6; cursor: not-allowed; }
        .switch-knob {
          width: 22px; height: 22px;
          border-radius: 50%;
          background: #fff;
          box-shadow: 0 2px 4px rgba(0,0,0,0.15);
          transition: transform 0.15s;
          transform: translateX(0);
        }
        .toggle-switch.on .switch-knob { transform: translateX(20px); }

        /* History card for requests */
        .request-history-card {
          background: var(--paper-2);
          border: 1px solid var(--ink-12);
          border-radius: 14px;
          padding: 14px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }
        .history-status { font-weight: 700; font-size: 12px; color: var(--ink-60); text-transform: uppercase; letter-spacing: 0.05em; flex-shrink: 0; }
        .history-body { flex: 1; text-align: right; }
        .history-title { font-weight: 700; font-size: 14px; color: var(--ink); margin-bottom: 2px; }
        .history-date { font-size: 12px; color: var(--ink-60); }

        .review-banner-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
        .review-banner { display: flex; align-items: center; gap: 14px; background: linear-gradient(135deg, rgba(255, 106, 61, 0.08), rgba(122, 88, 168, 0.06)); border: 1.5px solid rgba(255, 106, 61, 0.2); border-radius: 14px; padding: 14px 18px; text-decoration: none; color: var(--ink); transition: all 0.15s; }
        .review-banner:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(255, 106, 61, 0.15); border-color: var(--persimmon); }
        .rb-icon { display: flex; flex-shrink: 0; }
        .rb-content { flex: 1; min-width: 0; }
        .rb-title { font-family: var(--display); font-weight: 800; font-size: 15px; margin-bottom: 2px; color: var(--ink); }
        .rb-sub { font-size: 12px; color: var(--ink-60); line-height: 1.4; }
        .rb-arrow { font-size: 20px; color: var(--persimmon); flex-shrink: 0; }
      `}</style>
    </>
  );
}

// Full match card (same design as old /matches page)
function FullMatchCard({ match, lang, user, isHistory, onAccept, onDecline, onLeave, respondingTo }: {
  match: Match;
  lang: 'en' | 'ko';
  user: any;
  isHistory?: boolean;
  onAccept?: (groupId: string) => void;
  onDecline?: (groupId: string) => void;
  onLeave?: (groupId: string, isConfirmed: boolean) => void;
  respondingTo?: string | null;
}) {
  const isVolunteer = match.quest.quest_type === 'volunteer';
  const cat = match.quest.venue ? CATEGORY_LABELS[match.quest.venue.category] : undefined;
  const status = STATUS_LABELS[match.quest.status] ?? STATUS_LABELS.proposed;

  function daysRemaining(iso: string) {
    const ms = new Date(iso).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }
  const days = daysRemaining(match.quest.expires_at);

  return (
    <div className="match-card">
      <div className="match-header">
        <span className={`status-badge status-${status.color}`}>
          {lang === 'ko' ? status.ko : status.en}
        </span>
        {!isHistory && (
          <span className="days-remaining">
            {days > 0
              ? (lang === 'ko' ? `${days}일 남음` : `${days} days left`)
              : (lang === 'ko' ? '기한 만료' : 'Expired')}
          </span>
        )}
      </div>
      {match.is_pending_invites && match.my_invite_state === 'invited' && (
        <div className="invite-banner">
          <div className="invite-title"><Icon name="matchFound" size={22} /> {lang === 'ko' ? '매칭 초대!' : "You've been invited!"}</div>
          <div className="invite-desc">
            {lang === 'ko'
              ? '이 그룹에 합류하시겠습니까? 수락하면 그룹 채팅과 일정 조율에 참여할 수 있어요.'
              : 'Want to join this group? Accept to unlock the group chat and schedule the meetup.'}
          </div>
        </div>
      )}

      {match.is_pending_invites && match.my_invite_state === 'accepted' && (
        <div className="invite-banner accepted">
          <div className="invite-title"><Icon name="pending" size={22} /> {lang === 'ko' ? '다른 멤버의 응답 대기 중' : 'Waiting for other members'}</div>
          <div className="invite-desc">
            {(() => {
              const waiting = match.members.filter((m) => m.invite_state === 'invited').map((m) => m.display_name);
              return waiting.length > 0
                ? (lang === 'ko' ? `${waiting.join(', ')}님의 응답을 기다리고 있어요.` : `Waiting on ${waiting.join(', ')} to respond.`)
                : (lang === 'ko' ? '곧 확정될 예정입니다.' : 'Should be confirmed soon.');
            })()}
          </div>
        </div>
      )}

      <h2 className="quest-title">
        {stripEmoji(lang === 'ko' ? match.quest.title : (match.quest.title_en ?? match.quest.title))}
      </h2>

      <p className="quest-description">
        {lang === 'ko'
          ? match.quest.quest_description
          : (match.quest.description_en ?? match.quest.quest_description)}
      </p>

      <div className="members-section">
        <h3>{lang === 'ko' ? '함께할 친구들' : 'Your group'}</h3>
        <div className="members-grid">
          {match.members.map((m) => {
            const isMe = m.user_id === user.id;
            return (
              <a key={m.user_id} href={`/profile/${m.user_id}`} className={`member-card ${isMe ? 'is-me' : ''}`}>
                {m.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.photo_url} alt="" className="member-avatar" />
                ) : (
                  <div className="member-avatar avatar-fallback">
                    {m.display_name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="member-info">
                  <div className="member-name">
                    {m.display_name}
                    {isMe && <span className="you-tag">{lang === 'ko' ? '나' : 'you'}</span>}
                  </div>
                  <div className="member-tags">
                    {m.mbti_type && <span className="mini-tag">{m.mbti_type}</span>}
                    {m.zodiac_sign && <span className="mini-tag">{m.zodiac_sign}</span>}
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>

      {isVolunteer && (
        <div className="venue-section">
          <h3>{lang === 'ko' ? '함께할 봉사활동' : 'Volunteer activity'}</h3>
          {match.quest.program ? (
            <div className="venue-card volunteer-card">
              <div className="volunteer-emoji"><Icon name="volunteer" size={36} /></div>
              <div className="venue-info">
                <div className="venue-name">
                  {lang === 'en' ? (match.quest.program.title_en || match.quest.program.title) : match.quest.program.title}
                </div>
                {match.quest.program.org_name && (
                  <div className="venue-category">
                    {lang === 'en' ? (match.quest.program.org_name_en || match.quest.program.org_name) : match.quest.program.org_name}
                  </div>
                )}
                {match.quest.program.place && (
                  <div className="venue-address">
                    <Icon name="location" size={15} /> {lang === 'en' ? (match.quest.program.place_en || match.quest.program.place) : match.quest.program.place}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="venue-card volunteer-card">
              <div className="volunteer-emoji"><Icon name="vote" size={36} /></div>
              <div className="venue-info">
                <div className="venue-name">
                  {lang === 'ko' ? '함께 고를 1365 봉사활동' : 'A 1365 activity you choose together'}
                </div>
                <div className="venue-address">
                  {lang === 'ko'
                    ? '모두 수락하면 우리 도시의 봉사활동 중에서 투표로 골라요.'
                    : "Once everyone accepts, you'll vote on volunteer activities in your city."}
                </div>
              </div>
            </div>
          )}
          {match.quest_scheduled_at && (
            <div className="scheduled-info">
              <div className="scheduled-label"><Icon name="date" size={16} /> {lang === 'ko' ? '봉사 시간' : 'Volunteering time'}</div>
              <div className="scheduled-time">
                {new Date(match.quest_scheduled_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                {' · '}
                {new Date(match.quest_scheduled_at).toLocaleTimeString(lang === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )}
        </div>
      )}

      {match.quest.venue && (
      <div className="venue-section">
        <h3>{lang === 'ko' ? '만날 장소' : 'Where to meet'}</h3>
        <a className="venue-card venue-link" href={`/venues/${match.quest.venue.id}`}>
          {match.quest.venue.photo_urls?.[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.quest.venue.photo_urls[0]} alt="" className="venue-photo" />
          )}
          <div className="venue-info">
            <div className="venue-name">
              <CategoryIcon art={venueCategoryArt(match.quest.venue.category)} size={22} /> {match.quest.venue.business_name_display}
            </div>
            <div className="venue-category">
              {cat ? (lang === 'ko' ? cat.ko : cat.en) : match.quest.venue.category}
            </div>
            <div className="venue-address">
              {match.quest.venue.road_address ?? match.quest.venue.address}
            </div>
            {(() => {
              const v = match.quest.venue;
              const perk = lang === 'ko' ? v.discount_offer : v.discount_offer_en || v.discount_offer;
              if (!v.per_person_cost_won && !perk) return null;
              return (
                <div className="venue-chips">
                  {!!v.per_person_cost_won && (
                    <span className="venue-chip">
                      <Icon name="price" size={14} /> ~₩{v.per_person_cost_won.toLocaleString()} {lang === 'ko' ? '/ 1인' : '/ person'}
                    </span>
                  )}
                  {perk && <span className="venue-chip perk"><Icon name="perk" size={14} /> {perk}</span>}
                </div>
              );
            })()}
            <div className="venue-more">{lang === 'ko' ? '사진·영업시간·메뉴 보기 →' : 'Photos, hours and menu →'}</div>
          </div>
        </a>
        {match.quest_scheduled_at && (
          <div className="scheduled-info">
            <div className="scheduled-label">
              <Icon name="date" size={16} /> {lang === 'ko' ? '만나는 시간' : 'Meeting time'}
            </div>
            <div className="scheduled-time">
              {new Date(match.quest_scheduled_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              {' · '}
              {new Date(match.quest_scheduled_at).toLocaleTimeString(lang === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
              {' — '}
              {new Date(new Date(match.quest_scheduled_at).getTime() + 2 * 60 * 60 * 1000).toLocaleTimeString(lang === 'ko' ? 'ko-KR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )}
      </div>
      )}

      {match.quest.menu_items.length > 0 && (
        <div className="menu-section">
          <h3>{lang === 'ko' ? '함께 시도할 메뉴' : 'What to try together'}</h3>
          <div className="menu-grid">
            {match.quest.menu_items.map((item) => (
              <div key={item.id} className="menu-tile">
                {item.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.photo_url} alt="" className="menu-photo" />
                )}
                <div className="menu-name">
                  {lang === 'ko' ? item.name : (item.name_en ?? item.name)}
                  {item.is_signature && <> <Icon name="starFilled" size={14} label={lang === 'ko' ? '대표 메뉴' : 'Signature'} /></>}
                </div>
                {item.price_won && (
                  <div className="menu-price">₩{item.price_won.toLocaleString()}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accept/Decline buttons for invited users */}
      {match.is_pending_invites && match.my_invite_state === 'invited' && onAccept && onDecline && (
        <div className="invite-actions">
          <button
            className="btn-decline"
            onClick={() => onDecline(match.group_id)}
            disabled={respondingTo === match.group_id}
          >
            ✗ {lang === 'ko' ? '거절' : 'Decline'}
          </button>
          <button
            className="btn-accept"
            onClick={() => onAccept(match.group_id)}
            disabled={respondingTo === match.group_id}
          >
            {respondingTo === match.group_id
              ? '…'
              : `✓ ${lang === 'ko' ? '수락' : 'Accept invite'}`}
          </button>
        </div>
      )}

      {/* Check-in button — shows when quest is scheduled and we're in the check-in window */}
      {!isHistory && !isVolunteer && !match.is_pending_invites && match.quest_scheduled_at && (() => {
        const scheduled = new Date(match.quest_scheduled_at).getTime();
        const now = Date.now();
        const windowStart = scheduled - 40 * 60 * 1000;
        const windowEnd = scheduled + 120 * 60 * 1000;
        const inWindow = now >= windowStart && now <= windowEnd;
        const beforeWindow = now < windowStart;

        if (inWindow) {
          return (
            <a href={`/matches/${match.group_id}/check-in`} className="checkin-btn active">
              <Icon name="location" size={20} tone="light" /> {lang === 'ko' ? '지금 체크인' : 'Check in now'}
              <span className="checkin-live">● {lang === 'ko' ? '진행 중' : 'Open'}</span>
            </a>
          );
        }

        if (beforeWindow) {
          const minsUntil = Math.ceil((windowStart - now) / 60000);
          const hoursLeft = Math.floor(minsUntil / 60);
          const minsLeft = minsUntil % 60;
          const timeStr = hoursLeft > 0
            ? (lang === 'ko' ? `${hoursLeft}시간 ${minsLeft}분 후` : `in ${hoursLeft}h ${minsLeft}m`)
            : (lang === 'ko' ? `${minsLeft}분 후` : `in ${minsLeft} min`);
          return (
            <div className="checkin-btn upcoming">
              <Icon name="pending" size={20} /> {lang === 'ko' ? `체크인 ${timeStr} 열림` : `Check-in opens ${timeStr}`}
            </div>
          );
        }

        return null;
      })()}

      {/* Availability button — only if match is active (not pending) and quest not scheduled */}
      {/* Volunteer quest: one page for voting, 1365 signup and the group selfie */}
      {!isHistory && isVolunteer && !match.is_pending_invites && (
        <a href={`/matches/${match.group_id}/volunteer`} className="volunteer-btn">
          <Icon name={match.phase === 'voting' ? 'vote' : 'volunteer'} size={20} />{' '}
          {match.phase === 'voting'
            ? (lang === 'ko' ? '봉사활동 투표하기' : 'Vote on an activity')
            : match.phase === 'scheduled'
              ? (lang === 'ko' ? '1365 신청 · 단체 사진' : '1365 signup · group selfie')
              : (lang === 'ko' ? '봉사 퀘스트 열기' : 'Open volunteer quest')}
        </a>
      )}

      {!isHistory && !isVolunteer && !match.is_pending_invites && !match.quest_scheduled_at && (
        <a
          href={`/matches/${match.group_id}/availability`}
          className={`avail-btn ${match.my_availability_submitted ? 'submitted' : 'pending'}`}
        >
          <Icon name="date" size={20} />{' '}
          {match.my_availability_submitted
            ? (lang === 'ko' ? '가능한 시간 업데이트' : 'Update your availability')
            : (lang === 'ko' ? '가능한 시간 선택' : 'Pick your availability')}
          <span className="avail-progress">
            {match.availability_submitted_count} / {match.members.length}
          </span>
        </a>
      )}

      {!isHistory && !match.is_pending_invites && (
        <a href={`/matches/${match.group_id}/chat`} className="chat-open-btn">
          <Icon name="chat" size={20} /> {lang === 'ko' ? '그룹 채팅 열기' : 'Open group chat'}
          {match.unread_count > 0 && <span className="unread-badge">{match.unread_count}</span>}
        </a>
      )}

      {!isHistory && !match.is_pending_invites && (
        <a href={`/matches/${match.group_id}/questions`} className="ice-btn">
          <Icon name="icebreaker" size={20} /> {lang === 'ko' ? '얼음 깨기' : 'Break the Ice'}
          <span className="ice-badge">{lang === 'ko' ? '대화 질문' : 'Conversation'}</span>
        </a>
      )}

      {/* Leave group — accepted members, until the meetup starts */}
      {!isHistory && onLeave && match.my_invite_state === 'accepted' &&
        !(match.quest_scheduled_at && Date.now() >= new Date(match.quest_scheduled_at).getTime()) && (
        <button
          type="button"
          className="leave-btn"
          onClick={() => onLeave(match.group_id, !match.is_pending_invites)}
          disabled={respondingTo === match.group_id}
        >
          {lang === 'ko' ? '그룹 나가기' : 'Leave group'}
        </button>
      )}

      <style jsx>{`
        .match-card { background: #fff; border: 1px solid var(--ink-12); border-radius: 20px; padding: 28px; }
        .match-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .status-badge { padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: 0.03em; }
        .status-persimmon { background: rgba(255, 106, 61, 0.15); color: var(--persimmon); }
        .status-jade { background: rgba(15, 157, 119, 0.15); color: var(--jade); }
        .status-gray { background: rgba(30, 34, 48, 0.08); color: var(--ink-60); }
        .days-remaining { font-size: 13px; font-weight: 600; color: var(--ink-60); }
        .quest-title { font-family: var(--display); font-weight: 800; font-size: 24px; letter-spacing: -0.01em; margin: 0 0 12px; color: var(--ink); }
        .quest-description { font-size: 15.5px; line-height: 1.6; color: var(--ink-60); margin: 0 0 28px; }
        .members-section, .venue-section, .menu-section { margin-bottom: 24px; }
        h3 { font-family: var(--display); font-weight: 700; font-size: 15px; margin: 0 0 12px; color: var(--ink); text-transform: uppercase; letter-spacing: 0.06em; }
        .members-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
        .member-card { display: flex; gap: 10px; align-items: center; padding: 12px; background: var(--paper-2); border-radius: 12px; color: var(--ink); cursor: pointer; text-decoration: none; }
        .member-card:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
        .member-card.is-me { background: rgba(255, 106, 61, 0.06); border: 1px solid rgba(255, 106, 61, 0.2); }
        .member-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .avatar-fallback { background: var(--persimmon); color: #fff; display: grid; place-items: center; font-weight: 700; }
        .member-info { min-width: 0; flex: 1; }
        .member-name { font-weight: 700; font-size: 14px; color: var(--ink); display: flex; align-items: center; gap: 6px; }
        .you-tag { font-size: 10px; font-weight: 700; color: var(--persimmon); text-transform: uppercase; }
        .member-tags { display: flex; gap: 4px; margin-top: 3px; flex-wrap: wrap; }
        .mini-tag { font-size: 10px; font-weight: 600; color: var(--ink-60); background: #fff; padding: 2px 6px; border-radius: 4px; border: 1px solid var(--ink-12); }
        .venue-card { display: flex; gap: 14px; background: var(--paper-2); border-radius: 12px; padding: 12px; }
        .volunteer-card { align-items: center; }
        .volunteer-emoji { width: 64px; height: 64px; border-radius: 12px; background: rgba(15, 157, 119, 0.12); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .volunteer-btn { display: flex; align-items: center; justify-content: center; gap: 10px; background: linear-gradient(135deg, #0f9d77, #34c39a); color: #fff; padding: 14px 16px; border-radius: 12px; font-size: 15px; font-weight: 700; margin-top: 16px; text-decoration: none; }
        .venue-photo { width: 100px; height: 100px; border-radius: 10px; object-fit: cover; flex-shrink: 0; }
        .venue-info { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
        .venue-name { display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 17px; color: var(--ink); margin-bottom: 4px; }
        .venue-category { color: var(--ink-60); font-size: 13px; margin-bottom: 6px; }
        .venue-address { color: var(--ink-60); font-size: 13px; line-height: 1.4; }
        .venue-link { text-decoration: none; color: inherit; border: 1px solid transparent; transition: border-color 0.15s; }
        .venue-link:hover { border-color: var(--ink-12); }
        .venue-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; min-width: 0; }
        .venue-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; line-height: 1.35; color: var(--ink); background: #fff; border: 1px solid var(--ink-12); border-radius: 10px; padding: 3px 9px; max-width: 100%; overflow-wrap: anywhere; }
        .venue-chip.perk { color: var(--persimmon); border-color: rgba(255, 106, 61, 0.3); }
        .venue-more { margin-top: 8px; font-size: 13px; font-weight: 700; color: var(--persimmon); }
        @media (max-width: 420px) { .venue-link { flex-direction: column; } .venue-link .venue-photo { width: 100%; height: 140px; } }
        .scheduled-info { margin-top: 12px; padding: 14px 18px; background: linear-gradient(135deg, rgba(15, 157, 119, 0.08), rgba(255, 106, 61, 0.05)); border: 1px solid rgba(15, 157, 119, 0.2); border-radius: 12px; }
        .scheduled-label { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; color: var(--jade); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
        .scheduled-time { font-family: var(--display); font-weight: 700; font-size: 17px; color: var(--ink); }
        .menu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
        .menu-tile { background: var(--paper-2); border-radius: 10px; padding: 8px; text-align: center; }
        .menu-photo { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; margin-bottom: 6px; }
        .menu-name { font-weight: 600; font-size: 12px; color: var(--ink); }
        .menu-price { font-size: 11px; color: var(--jade); font-weight: 700; margin-top: 2px; }
        .avail-btn { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 14px 16px; border-radius: 12px; font-size: 14px; font-weight: 700; margin-top: 8px; text-decoration: none; }
        .avail-btn.pending { background: var(--jade); color: #fff; }
        .avail-btn.submitted { background: rgba(15, 157, 119, 0.1); color: var(--jade); border: 1px solid rgba(15, 157, 119, 0.3); }
        .avail-progress { background: rgba(255, 255, 255, 0.25); padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; }
        .avail-btn.submitted .avail-progress { background: rgba(15, 157, 119, 0.15); }
        .chat-open-btn { display: flex; align-items: center; justify-content: center; gap: 10px; background: var(--persimmon); color: #fff; padding: 14px 16px; border-radius: 12px; font-size: 15px; font-weight: 700; margin-top: 8px; text-decoration: none; }
        .leave-btn { display: block; width: 100%; margin-top: 14px; padding: 10px 16px; background: transparent; border: none; color: var(--ink-60); font-size: 13px; font-weight: 600; text-decoration: underline; cursor: pointer; }
        .leave-btn:hover { color: #d64545; }
        .leave-btn:disabled { opacity: 0.5; cursor: default; }
        .ice-btn { display: flex; align-items: center; justify-content: center; gap: 10px; background: linear-gradient(135deg, #7c9df0, #a78bfa); color: #fff; padding: 14px 16px; border-radius: 12px; font-size: 15px; font-weight: 700; margin-top: 8px; text-decoration: none; }
        .ice-btn:hover { opacity: 0.92; }
        .ice-badge { background: rgba(255, 255, 255, 0.25); color: #fff; font-weight: 700; font-size: 12px; padding: 2px 10px; border-radius: 999px; }
        .unread-badge { background: #fff; color: var(--persimmon); font-weight: 800; font-size: 13px; padding: 2px 10px; border-radius: 999px; min-width: 24px; text-align: center; }
        .invite-banner { background: linear-gradient(135deg, rgba(255, 106, 61, 0.08), rgba(15, 157, 119, 0.05)); border: 1px solid rgba(255, 106, 61, 0.25); border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; }
        .invite-banner.accepted { background: linear-gradient(135deg, rgba(15, 157, 119, 0.06), rgba(255, 106, 61, 0.02)); border-color: rgba(15, 157, 119, 0.25); }
        .invite-title { display: flex; align-items: center; gap: 6px; font-family: var(--display); font-weight: 800; font-size: 17px; color: var(--ink); margin-bottom: 4px; }
        .invite-desc { font-size: 13px; color: var(--ink-60); line-height: 1.5; }
        .member-status { font-size: 10px; font-weight: 700; margin-top: 4px; padding: 2px 8px; border-radius: 999px; display: inline-block; }
        .member-status.status-accepted { background: rgba(15, 157, 119, 0.15); color: var(--jade); }
        .member-status.status-invited { background: rgba(232, 169, 63, 0.15); color: #a86720; }
        .member-status.status-declined { background: rgba(255, 106, 61, 0.15); color: var(--persimmon); }
        .member-status.status-expired { background: rgba(30, 34, 48, 0.08); color: var(--ink-60); }
        .invite-actions { display: flex; gap: 8px; margin-top: 8px; }
        .btn-accept { flex: 1; background: var(--jade); color: #fff; border: 0; padding: 14px 20px; border-radius: 12px; font-weight: 800; font-size: 15px; cursor: pointer; }
        .btn-accept:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(15, 157, 119, 0.25); }
        .btn-accept:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-decline { background: transparent; border: 2px solid var(--ink-12); color: var(--ink-60); padding: 14px 24px; border-radius: 12px; font-weight: 700; font-size: 14px; cursor: pointer; }
        .btn-decline:hover:not(:disabled) { border-color: var(--persimmon); color: var(--persimmon); }
        .btn-decline:disabled { opacity: 0.5; cursor: not-allowed; }
        .checkin-btn { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 14px 16px; border-radius: 12px; font-size: 15px; font-weight: 700; margin-top: 8px; text-decoration: none; }
        .checkin-btn.active { background: var(--persimmon); color: #fff; box-shadow: 0 6px 18px rgba(255, 106, 61, 0.35); animation: pulse-glow 2s ease-in-out infinite; }
        .checkin-btn.active:hover { transform: translateY(-1px); box-shadow: 0 10px 22px rgba(255, 106, 61, 0.4); }
        .checkin-btn.upcoming { background: rgba(255, 106, 61, 0.08); color: var(--persimmon); border: 1px solid rgba(255, 106, 61, 0.25); }
        .checkin-live { background: rgba(255, 255, 255, 0.25); padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 6px 18px rgba(255, 106, 61, 0.35); }
          50% { box-shadow: 0 8px 28px rgba(255, 106, 61, 0.5); }
        }

      `}</style>
    </div>
  );
}

/** Matches for a venue-only account: no groups yet, just the invitation to make a friend profile. */
function VenueAccountMatches({ lang, setLang }: { lang: 'en' | 'ko'; setLang: (l: 'en' | 'ko') => void }) {
  const ko = lang === 'ko';
  return (
    <>
      <AppHeader lang={lang} setLang={setLang} />
      <main className="vam-wrap">
        <h1>{ko ? '매칭' : 'Matches'}</h1>
        <p className="vam-sub">
          {ko
            ? '도레함은 성격과 관심사가 맞는 2~5명을 묶어 파트너 가게나 봉사 활동에서 만나게 해요.'
            : 'Doreham puts 2 to 5 people with matching personalities and interests together, to meet at a partner venue or a volunteer activity.'}
        </p>
        <MeetPeopleCard lang={lang} />
      </main>
      <AppTabBar lang={lang} />
      <style jsx>{`
        .vam-wrap { max-width: 720px; margin: 0 auto; padding: 24px 16px 96px; }
        h1 { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 6px; color: var(--ink); }
        .vam-sub { color: var(--ink-60); font-size: 15px; line-height: 1.55; margin: 0 0 18px; }
      `}</style>
    </>
  );
}
