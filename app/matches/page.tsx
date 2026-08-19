'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { supabase } from '@/lib/supabase/client';

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
  quest: {
    id: string;
    title: string;
    title_en: string | null;
    quest_description: string;
    description_en: string | null;
    status: string;
    expires_at: string;
    venue: {
      id: string;
      business_name_display: string;
      category: string;
      address: string;
      road_address: string | null;
      city: string;
      photo_urls: string[];
    };
    menu_items: QuestMenuItem[];
  };
};

type MatchRequest = {
  id: string;
  city: string | null;
  group_size: number | null;
  status: string;
  created_at: string;
  matched_group_id: string | null;
};

type KoreanCity = {
  slug: string;
  name_en: string;
  name_ko: string;
  emoji: string;
};

const KOREAN_CITIES: KoreanCity[] = [
  { slug: 'seoul', name_en: 'Seoul', name_ko: '서울', emoji: '🏙️' },
  { slug: 'busan', name_en: 'Busan', name_ko: '부산', emoji: '🌊' },
  { slug: 'incheon', name_en: 'Incheon', name_ko: '인천', emoji: '✈️' },
  { slug: 'daegu', name_en: 'Daegu', name_ko: '대구', emoji: '⛰️' },
  { slug: 'daejeon', name_en: 'Daejeon', name_ko: '대전', emoji: '🔬' },
  { slug: 'gwangju', name_en: 'Gwangju', name_ko: '광주', emoji: '🎨' },
  { slug: 'suwon', name_en: 'Suwon', name_ko: '수원', emoji: '🏯' },
  { slug: 'ulsan', name_en: 'Ulsan', name_ko: '울산', emoji: '🏭' },
  { slug: 'cheonan', name_en: 'Cheonan', name_ko: '천안', emoji: '🌸' },
  { slug: 'asan', name_en: 'Asan', name_ko: '아산', emoji: '🍃' },
  { slug: 'jeonju', name_en: 'Jeonju', name_ko: '전주', emoji: '🍚' },
  { slug: 'jeju', name_en: 'Jeju', name_ko: '제주', emoji: '🌴' },
];

const CATEGORY_LABELS: Record<string, { en: string; ko: string; emoji: string }> = {
  cafe: { en: 'Café', ko: '카페', emoji: '☕' },
  restaurant: { en: 'Restaurant', ko: '식당', emoji: '🍜' },
  board_game_cafe: { en: 'Board game café', ko: '보드게임 카페', emoji: '🎲' },
  escape_room: { en: 'Escape room', ko: '방탈출', emoji: '🧩' },
  bookshop: { en: 'Bookshop', ko: '서점', emoji: '📚' },
  workshop_creative: { en: 'Workshop', ko: '원데이 클래스', emoji: '🏺' },
  active_sports: { en: 'Sports', ko: '스포츠', emoji: '🥾' },
  cultural_venue: { en: 'Cultural venue', ko: '문화 공간', emoji: '🎨' },
  nature_outdoor: { en: 'Nature', ko: '자연', emoji: '🌿' },
  music_movie: { en: 'Music/Movie', ko: '음악·영화', emoji: '🎬' },
  other: { en: 'Other', ko: '기타', emoji: '🏪' },
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
  const { user, loading } = useUser();
  const [lang, setLang] = useState<'en' | 'ko'>('en');
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [matches, setMatches] = useState<Match[]>([]);
  const [requests, setRequests] = useState<MatchRequest[]>([]);
  const [availableCities, setAvailableCities] = useState<Set<string>>(new Set());
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Request form state
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [randomCity, setRandomCity] = useState(false);
  const [selectedGroupSize, setSelectedGroupSize] = useState<number | null>(3);
  const [randomSize, setRandomSize] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);
  const [isMatchable, setIsMatchable] = useState(true);
  const [savingMatchable, setSavingMatchable] = useState(false);

  // Freeze
  const [isFrozen, setIsFrozen] = useState(false);
  const [frozenUntil, setFrozenUntil] = useState<string | null>(null);
  const [strikeCount, setStrikeCount] = useState(0);

  // Touch swipe
  const touchStartX = useRef<number | null>(null);
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
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router]);

  async function loadAll() {
    setLoadingData(true);
    setError(null);

    // Available cities
    const { data: venues } = await supabase
      .from('venues')
      .select('city')
      .eq('is_active', true)
      .is('deactivated_at', null);
    const cities = new Set((venues ?? []).map((v: any) => (v.city ?? '').toLowerCase()));
    setAvailableCities(cities);

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
      .select('id, city, group_size, status, created_at, matched_group_id')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    if (reqs) setRequests(reqs as MatchRequest[]);

    // Matches
    const { data: memberships } = await supabase
      .from('group_members')
      .select('group_id, last_read_at')
      .eq('user_id', user!.id)
      .is('left_at', null);

    if (!memberships || memberships.length === 0) {
      setMatches([]);
      setLoadingData(false);
      return;
    }

    const groupIds = memberships.map((m) => m.group_id);

    const { data: groups } = await supabase
      .from('groups')
      .select('id, city, phase, availability_phase_ends_at, quest_scheduled_at, is_pending_invites')
      .in('id', groupIds);

    const { data: allMembers } = await supabase
      .from('group_members')
      .select('group_id, user_id, invite_state, accepted_at, profiles:profiles!inner(id, display_name, photo_url, mbti_type, zodiac_sign, activity_preferences)')
      .in('group_id', groupIds)
      .is('left_at', null);

    const { data: quests } = await supabase
      .from('quests')
      .select(`
        id, group_id, title, title_en, quest_description, description_en, status, expires_at,
        venue:venues!inner(id, business_name_display, category, address, road_address, city, photo_urls)
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
      const members: GroupMember[] = membersRaw.map((m: any) => ({
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
          venue: quest.venue,
          menu_items: menuItems,
        },
      } as Match;
    }).filter(Boolean) as Match[];

    built.sort((a, b) => new Date(a.quest.expires_at).getTime() - new Date(b.quest.expires_at).getTime());
    setMatches(built);
    setLoadingData(false);
  }

  async function submitMatchRequest() {
    if (isFrozen) {
      setError(lang === 'ko' ? '현재 계정이 일시 정지되어 있습니다.' : 'Your account is currently frozen.');
      return;
    }
    if (!randomCity && !selectedCity) {
      setError(lang === 'ko' ? '도시를 선택해주세요.' : 'Please select a city.');
      return;
    }

    // Server-side city validation — check the city has venues
    if (!randomCity && selectedCity && !availableCities.has(selectedCity)) {
      setError(lang === 'ko'
        ? '이 도시에는 아직 매장이 없습니다. 다른 도시를 선택해주세요.'
        : 'No venues in this city yet. Please pick another city.');
      return;
    }

    setSubmittingRequest(true);
    setError(null);
    setRequestSuccess(false);

    const { data: insertedRequest, error: err } = await supabase.from('match_requests').insert({
      user_id: user!.id,
      city: randomCity ? null : selectedCity,
      group_size: randomSize ? null : selectedGroupSize,
      status: 'searching',
    }).select('id').single();

    if (err) {
      setError(err.message);
      setSubmittingRequest(false);
      return;
    }

    // Trigger the algorithm immediately
    console.log('DEBUG: about to trigger algorithm for request', insertedRequest?.id);
    try {
      const resp = await fetch('/api/process-match-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: insertedRequest?.id }),
      });
      const respData = await resp.json();
      console.log('DEBUG: algorithm response:', respData);
    } catch (e) {
      console.error('DEBUG: immediate trigger failed', e);
    }

    setSubmittingRequest(false);
    setRequestSuccess(true);
    setSelectedCity(null);
    setRandomCity(false);
    setSelectedGroupSize(3);
    setRandomSize(false);
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
        body: JSON.stringify({ request_id: requestId, user_id: user!.id }),
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

  function daysRemaining(expiresAt: string): number {
    const ms = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  // Split
  const pendingMatches = matches.filter((m) =>
    m.quest.status !== 'completed' && m.quest.status !== 'cancelled' && m.phase !== 'cancelled'
  );
  const historyMatches = matches.filter((m) =>
    m.quest.status === 'completed' || m.quest.status === 'cancelled' || m.phase === 'cancelled'
  );
  const activeRequests = requests.filter((r) => r.status === 'searching');
  const pastRequests = requests.filter((r) => r.status !== 'searching');
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
    console.log('DEBUG accept — group:', groupId, 'user:', user!.id);
    setRespondingTo(groupId);
    setError(null);
    try {
      const resp = await fetch('/api/accept-match-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: groupId, user_id: user!.id }),
      });
      const result = await resp.json();
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
        body: JSON.stringify({ group_id: groupId, user_id: user!.id }),
      });
      const result = await resp.json();
      if (result.error) throw new Error(result.error);
      await loadAll();
    } catch (e: any) {
      setError(e.message ?? 'Decline failed');
    }
    setRespondingTo(null);
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
      <header className="v-nav">
        <div className="wrap v-nav-in">
          <a className="brand" href="/">Doreham <span className="ko-mark">도레함</span></a>
          <div className="toggle">
            <button aria-pressed={lang === 'ko'} onClick={() => setLang('ko')}>한국어</button>
            <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
          </div>
        </div>
      </header>

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
            <span className="premium-dot" title="Premium">⭐</span>
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
                          {cityDisplayName(req.city)} · {req.group_size ?? (lang === 'ko' ? '랜덤 인원' : 'Random size')}
                        </div>
                        <div className="searching-est">
                          {lang === 'ko' ? '⏱ 예상 시간: 몇 시간 정도 걸릴 수 있어요' : '⏱ Est. wait: could be a few hours'}
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
                <div className="empty-icon">🌸</div>
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
                {lang === 'ko'
                  ? '도시와 인원을 선택하고 새로운 친구를 만나보세요.'
                  : 'Pick a city and group size to meet new friends.'}
              </p>
              <div className="premium-tag">
                {lang === 'ko' ? '⭐ 프리미엄 기능' : '⭐ Premium feature'}
              </div>
            </div>

            <div className="matchable-toggle">
              <div className="matchable-left">
                <div className="matchable-title">
                  {isMatchable ? '✅ ' : '💤 '}
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
                <div className="frozen-icon">❄️</div>
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
                    ⚠️ {lang === 'ko' ? `주의: ${strikeCount}회 취소 기록` : `Heads up: ${strikeCount} previous strike${strikeCount > 1 ? 's' : ''}`}
                  </div>
                )}

                {/* City */}
                <div className="form-section">
                  <label className="form-label">
                    {lang === 'ko' ? '🗺 도시 선택' : '🗺 Pick a city'}
                  </label>
                  <div className="cities-grid">
                    <button
                      className={`city-card random ${randomCity ? 'selected' : ''}`}
                      onClick={() => { setRandomCity(!randomCity); if (!randomCity) setSelectedCity(null); }}
                    >
                      <div className="city-emoji">🎲</div>
                      <div className="city-name">
                        {lang === 'ko' ? '랜덤' : 'Random'}
                      </div>
                    </button>
                    {KOREAN_CITIES.map((c) => {
                      const hasVenues = availableCities.has(c.slug);
                      const isSelected = selectedCity === c.slug && !randomCity;
                      return (
                        <button
                          key={c.slug}
                          className={`city-card ${isSelected ? 'selected' : ''} ${!hasVenues ? 'disabled' : ''}`}
                          onClick={() => {
                            if (!hasVenues) return;
                            setRandomCity(false);
                            setSelectedCity(isSelected ? null : c.slug);
                          }}
                          disabled={!hasVenues}
                          title={!hasVenues ? (lang === 'ko' ? '아직 준비 중' : 'Coming soon') : ''}
                        >
                          <div className="city-emoji">{c.emoji}</div>
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
                </div>

                {/* Group size */}
                <div className="form-section">
                  <label className="form-label">
                    {lang === 'ko' ? '👥 인원 선택' : '👥 Group size'}
                  </label>
                  <div className="size-options">
                    {[2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        className={`size-btn ${!randomSize && selectedGroupSize === n ? 'selected' : ''}`}
                        onClick={() => { setRandomSize(false); setSelectedGroupSize(n); }}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      className={`size-btn size-random ${randomSize ? 'selected' : ''}`}
                      onClick={() => { setRandomSize(!randomSize); if (!randomSize) setSelectedGroupSize(null); }}
                    >
                      🎲 {lang === 'ko' ? '랜덤' : 'Random'}
                    </button>
                  </div>
                </div>

                {error && <div className="error-msg">{error}</div>}
                {requestSuccess && (
                  <div className="success-msg">
                    ✓ {lang === 'ko' ? '요청 접수 완료!' : 'Request submitted!'}
                  </div>
                )}

                <button className="find-btn" onClick={submitMatchRequest} disabled={submittingRequest}>
                  {submittingRequest
                    ? (lang === 'ko' ? '요청 중…' : 'Requesting…')
                    : (lang === 'ko' ? '🔍 매칭 찾기' : '🔍 Find a match')}
                </button>

                <div className="commit-note">
                  {lang === 'ko'
                    ? '💡 매칭 확정 후 취소하면 경고를 받습니다. 3회 이상 취소 시 계정이 일시 정지됩니다.'
                    : '💡 Cancelling after a match is confirmed counts as a strike. 3 strikes → account frozen.'}
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
                <div className="empty-icon">📜</div>
                <h2>{lang === 'ko' ? '아직 기록이 없어요' : 'No history yet'}</h2>
                <p>{lang === 'ko' ? '완료된 매칭과 지난 요청이 여기에 표시됩니다.' : 'Completed matches and past requests will appear here.'}</p>
              </div>
            ) : (
              <div className="history-list">
                {historyMatches.map((match) => (
                  <FullMatchCard
                    key={match.group_id}
                    match={match}
                    lang={lang}
                    user={user}
                    isHistory
                    onAccept={acceptInvite}
                    onDecline={declineInvite}
                    respondingTo={respondingTo}
                  />
                ))}
                {pastRequests.map((req) => (
                  <div key={req.id} className="request-history-card">
                    <div className="history-status">
                      {req.status === 'no_match_found'
                        ? `✗ ${lang === 'ko' ? '매칭 실패' : 'No match found'}`
                        : req.status === 'cancelled_by_user'
                          ? `✗ ${lang === 'ko' ? '요청 취소됨' : 'Request cancelled'}`
                          : req.status === 'expired'
                            ? `⏱ ${lang === 'ko' ? '만료됨' : 'Expired'}`
                            : req.status}
                    </div>
                    <div className="history-body">
                      <div className="history-title">
                        {cityDisplayName(req.city)} · {req.group_size ?? (lang === 'ko' ? '랜덤 인원' : 'Random size')}
                      </div>
                      <div className="history-date">
                        {new Date(req.created_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
                          year: 'numeric', month: 'long', day: 'numeric',
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <style jsx>{`
        .v-nav { background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); position: sticky; top: 0; z-index: 20; backdrop-filter: blur(8px); }
        .v-nav-in { display: flex; align-items: center; justify-content: space-between; height: 68px; }
        .brand { display: flex; align-items: baseline; gap: 9px; font-family: var(--display); font-weight: 800; font-size: 20px; text-decoration: none; color: var(--ink); }
        .ko-mark { color: var(--ink-60); font-weight: 700; font-size: 17px; }
        .toggle { display: inline-flex; border: 1px solid var(--ink-12); border-radius: 999px; overflow: hidden; background: var(--paper-2); }
        .toggle button { border: 0; background: transparent; font-family: var(--body); font-weight: 600; font-size: 13px; padding: 7px 13px; cursor: pointer; color: var(--ink-60); }
        .toggle button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }

        /* Tab bar */
        .tab-bar-wrap { background: rgba(245, 242, 235, 0.95); border-bottom: 1px solid var(--ink-12); position: sticky; top: 68px; z-index: 15; backdrop-filter: blur(8px); }
        .tab-bar {
          display: flex;
          gap: 4px;
          padding: 8px 20px 0;
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
        .premium-dot { font-size: 12px; }

        .main-wrap { padding: 32px 24px 80px; max-width: 900px; min-height: 60vh; }

        /* Empty states */
        .empty-state { text-align: center; padding: 80px 20px; background: var(--paper-2); border-radius: 24px; }
        .empty-icon { font-size: 64px; margin-bottom: 20px; }
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
        .searching-est { font-size: 12px; color: var(--ink-60); margin-top: 2px; }
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
        .premium-tag {
          display: inline-block;
          background: linear-gradient(135deg, #fbbf24, #f97316);
          color: #fff; font-weight: 700; font-size: 12px;
          padding: 5px 14px; border-radius: 999px;
        }

        .frozen-notice { text-align: center; padding: 60px 30px; background: rgba(91, 124, 250, 0.06); border: 1px solid rgba(91, 124, 250, 0.2); border-radius: 20px; }
        .frozen-icon { font-size: 64px; margin-bottom: 16px; }
        .frozen-notice h3 { font-family: var(--display); font-size: 24px; margin: 0 0 12px; color: var(--ink); }
        .frozen-when { font-weight: 700; color: var(--ink); font-size: 15px; margin: 0 0 6px; }
        .frozen-note { font-size: 13px; color: var(--ink-60); font-style: italic; margin: 0; }

        .already-searching { text-align: center; padding: 60px 30px; background: rgba(255, 106, 61, 0.04); border-radius: 20px; }
        .already-searching .pulse-wrap { margin: 0 auto 16px; }
        .already-searching h3 { font-family: var(--display); font-size: 22px; margin: 0 0 8px; }
        .already-searching p { color: var(--ink-60); font-size: 14px; margin: 0 0 20px; }

        .strike-warning { background: rgba(232, 169, 63, 0.15); color: #a86720; padding: 12px 18px; border-radius: 12px; font-size: 13px; font-weight: 600; margin-bottom: 20px; text-align: center; border: 1px solid rgba(232, 169, 63, 0.3); }

        .form-section { margin-bottom: 24px; }
        .form-label { display: block; font-family: var(--display); font-weight: 700; font-size: 14px; color: var(--ink); margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; }

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
        .city-emoji { font-size: 32px; }
        .city-name { font-weight: 700; font-size: 13px; color: var(--ink); }
        .city-soon { font-size: 10px; color: var(--ink-60); font-weight: 600; }

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
        .size-btn.size-random { font-size: 14px; min-width: auto; }
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
        .matchable-title { font-weight: 700; font-size: 15px; color: var(--ink); margin-bottom: 2px; }
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
      `}</style>
    </>
  );
}

// Full match card (same design as old /matches page)
function FullMatchCard({ match, lang, user, isHistory, onAccept, onDecline, respondingTo }: { 
  match: Match; 
  lang: 'en' | 'ko'; 
  user: any; 
  isHistory?: boolean;
  onAccept?: (groupId: string) => void;
  onDecline?: (groupId: string) => void;
  respondingTo?: string | null;
}) {
  const cat = CATEGORY_LABELS[match.quest.venue.category];
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
          <div className="invite-title">🎉 {lang === 'ko' ? '매칭 초대!' : "You've been invited!"}</div>
          <div className="invite-desc">
            {lang === 'ko'
              ? '이 그룹에 합류하시겠습니까? 수락하면 그룹 채팅과 일정 조율에 참여할 수 있어요.'
              : 'Want to join this group? Accept to unlock the group chat and schedule the meetup.'}
          </div>
        </div>
      )}

      {match.is_pending_invites && match.my_invite_state === 'accepted' && (
        <div className="invite-banner accepted">
          <div className="invite-title">⏳ {lang === 'ko' ? '다른 멤버의 응답 대기 중' : 'Waiting for other members'}</div>
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
        {lang === 'ko' ? match.quest.title : (match.quest.title_en ?? match.quest.title)}
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

      <div className="venue-section">
        <h3>{lang === 'ko' ? '만날 장소' : 'Where to meet'}</h3>
        <div className="venue-card">
          {match.quest.venue.photo_urls?.[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={match.quest.venue.photo_urls[0]} alt="" className="venue-photo" />
          )}
          <div className="venue-info">
            <div className="venue-name">
              {cat?.emoji} {match.quest.venue.business_name_display}
            </div>
            <div className="venue-category">
              {cat ? (lang === 'ko' ? cat.ko : cat.en) : match.quest.venue.category}
            </div>
            <div className="venue-address">
              {match.quest.venue.road_address ?? match.quest.venue.address}
            </div>
          </div>
        </div>
        {match.quest_scheduled_at && (
          <div className="scheduled-info">
            <div className="scheduled-label">
              {lang === 'ko' ? '📅 만나는 시간' : '📅 Meeting time'}
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
                  {item.is_signature && ' ⭐'}
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

      {/* Availability button — only if match is active (not pending) and quest not scheduled */}
      {!isHistory && !match.is_pending_invites && !match.quest_scheduled_at && (
        <a
          href={`/matches/${match.group_id}/availability`}
          className={`avail-btn ${match.my_availability_submitted ? 'submitted' : 'pending'}`}
        >
          {match.my_availability_submitted
            ? (lang === 'ko' ? '📅 가능한 시간 업데이트' : '📅 Update your availability')
            : (lang === 'ko' ? '📅 가능한 시간 선택' : '📅 Pick your availability')}
          <span className="avail-progress">
            {match.availability_submitted_count} / {match.members.length}
          </span>
        </a>
      )}

      {!isHistory && !match.is_pending_invites && (
        <a href={`/matches/${match.group_id}/chat`} className="chat-open-btn">
          💬 {lang === 'ko' ? '그룹 채팅 열기' : 'Open group chat'}
          {match.unread_count > 0 && <span className="unread-badge">{match.unread_count}</span>}
        </a>
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
        .venue-photo { width: 100px; height: 100px; border-radius: 10px; object-fit: cover; flex-shrink: 0; }
        .venue-info { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
        .venue-name { font-weight: 700; font-size: 17px; color: var(--ink); margin-bottom: 4px; }
        .venue-category { color: var(--ink-60); font-size: 13px; margin-bottom: 6px; }
        .venue-address { color: var(--ink-60); font-size: 13px; line-height: 1.4; }
        .scheduled-info { margin-top: 12px; padding: 14px 18px; background: linear-gradient(135deg, rgba(15, 157, 119, 0.08), rgba(255, 106, 61, 0.05)); border: 1px solid rgba(15, 157, 119, 0.2); border-radius: 12px; }
        .scheduled-label { font-size: 11px; font-weight: 700; color: var(--jade); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px; }
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
        .unread-badge { background: #fff; color: var(--persimmon); font-weight: 800; font-size: 13px; padding: 2px 10px; border-radius: 999px; min-width: 24px; text-align: center; }
        .invite-banner { background: linear-gradient(135deg, rgba(255, 106, 61, 0.08), rgba(15, 157, 119, 0.05)); border: 1px solid rgba(255, 106, 61, 0.25); border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; }
        .invite-banner.accepted { background: linear-gradient(135deg, rgba(15, 157, 119, 0.06), rgba(255, 106, 61, 0.02)); border-color: rgba(15, 157, 119, 0.25); }
        .invite-title { font-family: var(--display); font-weight: 800; font-size: 17px; color: var(--ink); margin-bottom: 4px; }
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

      `}</style>
    </div>
  );
}