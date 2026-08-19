'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { supabase } from '@/lib/supabase/client';

const ADMIN_USER_ID = 'dc511479-3d65-4dc4-a2da-55cbca7f9456';

type Profile = {
  id: string;
  display_name: string;
  home_district: string | null;
  mbti_type: string | null;
  zodiac_sign: string | null;
  activity_preferences: string[] | null;
  interests: string[] | null;
  big_five_openness: number | null;
  big_five_conscientiousness: number | null;
  big_five_extraversion: number | null;
  big_five_agreeableness: number | null;
  big_five_neuroticism: number | null;
  onboarding_completed: boolean;
  photo_url: string | null;
};

type Venue = {
  id: string;
  business_name_display: string;
  category: string;
  city: string;
  district: string | null;
  photo_urls: string[];
};

type MenuItem = {
  id: string;
  name: string;
  name_en: string | null;
  price_won: number | null;
  is_signature: boolean;
};

type ExistingMatch = {
  group_id: string;
  city: string;
  created_at: string;
  quest_id: string;
  quest_title: string;
  quest_title_en: string | null;
  quest_description: string;
  quest_status: string;
  expires_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  venue_id: string;
  venue_name: string;
  venue_category: string;
  members: { user_id: string; display_name: string; photo_url: string | null }[];
};

type MatchRequestRow = {
  id: string;
  user_id: string;
  city: string | null;
  group_size: number | null;
  status: string;
  created_at: string;
  profile: {
    display_name: string;
    photo_url: string | null;
    home_district: string | null;
  } | null;
};

const CITIES = [
  { code: 'asan', label: '아산 · Asan' },
  { code: 'cheonan', label: '천안 · Cheonan' },
  { code: 'seoul', label: '서울 · Seoul' },
  { code: 'busan', label: '부산 · Busan' },
  { code: 'incheon', label: '인천 · Incheon' },
  { code: 'daegu', label: '대구 · Daegu' },
  { code: 'daejeon', label: '대전 · Daejeon' },
  { code: 'gwangju', label: '광주 · Gwangju' },
  { code: 'suwon', label: '수원 · Suwon' },
  { code: 'ulsan', label: '울산 · Ulsan' },
  { code: 'other', label: 'Other' },
];

const CATEGORY_LABELS: Record<string, { en: string; emoji: string; needsMenu: boolean }> = {
  cafe:              { en: 'Café', emoji: '☕', needsMenu: true },
  restaurant:        { en: 'Restaurant', emoji: '🍜', needsMenu: true },
  board_game_cafe:   { en: 'Board game café', emoji: '🎲', needsMenu: false },
  escape_room:       { en: 'Escape room', emoji: '🧩', needsMenu: false },
  bookshop:          { en: 'Bookshop', emoji: '📚', needsMenu: false },
  workshop_creative: { en: 'Workshop', emoji: '🏺', needsMenu: false },
  active_sports:     { en: 'Sports', emoji: '🥾', needsMenu: false },
  cultural_venue:    { en: 'Cultural venue', emoji: '🎨', needsMenu: false },
  nature_outdoor:    { en: 'Nature', emoji: '🌿', needsMenu: false },
  music_movie:       { en: 'Music/Movie', emoji: '🎬', needsMenu: false },
  other:             { en: 'Other', emoji: '🏪', needsMenu: false },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  proposed:  { label: 'Proposed',  color: 'blue' },
  scheduled: { label: 'Scheduled', color: 'jade' },
  completed: { label: 'Completed', color: 'green' },
  cancelled: { label: 'Cancelled', color: 'gray' },
  no_show:   { label: 'No show',   color: 'gray' },
};

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
  const aInterests = new Set([...(a.activity_preferences ?? []), ...(a.interests ?? [])]);
  const bInterests = new Set([...(b.activity_preferences ?? []), ...(b.interests ?? [])]);
  const overlap = [...aInterests].filter((x) => bInterests.has(x)).length;
  return Math.min(100, Math.round(bigFiveScore + overlap * 5));
}

function groupCompatibility(profiles: Profile[]): number {
  if (profiles.length < 2) return 0;
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      sum += compatibilityScore(profiles[i], profiles[j]);
      pairs++;
    }
  }
  return Math.round(sum / pairs);
}

function generateQuestTitleAndDescription(venue: Venue, menuItems: MenuItem[]) {
  const catInfo = CATEGORY_LABELS[venue.category];
  const emoji = catInfo?.emoji ?? '🌟';

  if (venue.category === 'cafe' && menuItems.length > 0) {
    const itemNames = menuItems.map((m) => m.name).join(', ');
    const itemNamesEn = menuItems.map((m) => m.name_en ?? m.name).join(', ');
    return {
      title: `${emoji} ${venue.business_name_display}에서 함께 시간 보내기`,
      title_en: `${emoji} Coffee time at ${venue.business_name_display}`,
      description: `${venue.business_name_display}에 함께 방문해서 ${itemNames}을(를) 각자 주문하고 서로 나눠 마셔보세요.`,
      description_en: `Visit ${venue.business_name_display} together and each order one of: ${itemNamesEn}. Share sips!`,
    };
  }
  if (venue.category === 'restaurant' && menuItems.length > 0) {
    const itemNames = menuItems.map((m) => m.name).join(', ');
    const itemNamesEn = menuItems.map((m) => m.name_en ?? m.name).join(', ');
    return {
      title: `${emoji} ${venue.business_name_display}에서 함께 식사`,
      title_en: `${emoji} Share a meal at ${venue.business_name_display}`,
      description: `${venue.business_name_display}에서 함께 식사해요. ${itemNames} 중 하나씩 주문해서 나눠 먹으면 좋겠어요!`,
      description_en: `Meet at ${venue.business_name_display}. Try ordering ${itemNamesEn} — sharing dishes is more fun!`,
    };
  }

  const generic: Record<string, { titleKo: string; titleEn: string; ko: string; en: string }> = {
    board_game_cafe: { titleKo: `${emoji} ${venue.business_name_display}에서 보드게임`, titleEn: `${emoji} Board game night at ${venue.business_name_display}`, ko: `${venue.business_name_display}에서 함께 보드게임을 즐겨보세요.`, en: `Head to ${venue.business_name_display} and play a board game together.` },
    escape_room: { titleKo: `${emoji} ${venue.business_name_display} 방탈출 도전`, titleEn: `${emoji} Escape ${venue.business_name_display} together`, ko: `${venue.business_name_display}에서 함께 방탈출을 도전해보세요.`, en: `Take on an escape room at ${venue.business_name_display} together.` },
    bookshop: { titleKo: `${emoji} ${venue.business_name_display}에서 서로에게 책 추천`, titleEn: `${emoji} Book swap at ${venue.business_name_display}`, ko: `${venue.business_name_display}에서 각자 상대에게 책을 추천해주세요.`, en: `Visit ${venue.business_name_display} together. Recommend books to each other!` },
    workshop_creative: { titleKo: `${emoji} ${venue.business_name_display}에서 함께 만들기`, titleEn: `${emoji} Make something at ${venue.business_name_display}`, ko: `${venue.business_name_display}에서 함께 원데이 클래스를 즐겨보세요.`, en: `Join a workshop at ${venue.business_name_display} together.` },
    active_sports: { titleKo: `${emoji} ${venue.business_name_display}에서 함께 운동`, titleEn: `${emoji} Active time at ${venue.business_name_display}`, ko: `${venue.business_name_display}에서 함께 활동해요.`, en: `Get active together at ${venue.business_name_display}.` },
    cultural_venue: { titleKo: `${emoji} ${venue.business_name_display} 함께 둘러보기`, titleEn: `${emoji} Explore ${venue.business_name_display} together`, ko: `${venue.business_name_display}을(를) 함께 둘러보세요.`, en: `Explore ${venue.business_name_display} together.` },
    nature_outdoor: { titleKo: `${emoji} ${venue.business_name_display}에서 자연 속으로`, titleEn: `${emoji} Into nature at ${venue.business_name_display}`, ko: `${venue.business_name_display}에서 함께 시간을 보내세요.`, en: `Enjoy ${venue.business_name_display} together.` },
    music_movie: { titleKo: `${emoji} ${venue.business_name_display}에서 함께 즐기기`, titleEn: `${emoji} Together at ${venue.business_name_display}`, ko: `${venue.business_name_display}에서 함께 시간을 보내세요.`, en: `Meet at ${venue.business_name_display}.` },
    other: { titleKo: `${emoji} ${venue.business_name_display}에서 만나기`, titleEn: `${emoji} Meet up at ${venue.business_name_display}`, ko: `${venue.business_name_display}에서 함께 시간을 보내세요.`, en: `Spend time together at ${venue.business_name_display}.` },
  };
  const preset = generic[venue.category] ?? generic.other;
  return { title: preset.titleKo, title_en: preset.titleEn, description: preset.ko, description_en: preset.en };
}

export default function AdminMatchesPage() {
  const router = useRouter();
  const { user, loading } = useUser();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [existingMatches, setExistingMatches] = useState<ExistingMatch[]>([]);
  const [matchRequests, setMatchRequests] = useState<MatchRequestRow[]>([]);
  const [prefilledRequestId, setPrefilledRequestId] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const [view, setView] = useState<'list' | 'create'>('list');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [processingMatchId, setProcessingMatchId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const [selectedCity, setSelectedCity] = useState('asan');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');
  const [selectedMenuIds, setSelectedMenuIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push('/sign-in?return=/admin/matches'); return; }
    if (user.id !== ADMIN_USER_ID) { router.push('/'); return; }
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router]);

  async function loadAll() {
    setLoadingData(true);
    setError(null);
    await Promise.all([loadProfilesAndVenues(), loadExistingMatches(), loadMatchRequests()]);
    setLoadingData(false);
  }

  async function loadProfilesAndVenues() {
    const [profilesRes, venuesRes] = await Promise.all([
      supabase.from('profiles').select('id, display_name, home_district, mbti_type, zodiac_sign, activity_preferences, interests, big_five_openness, big_five_conscientiousness, big_five_extraversion, big_five_agreeableness, big_five_neuroticism, onboarding_completed, photo_url').eq('onboarding_completed', true).order('display_name'),
      supabase.from('venues').select('id, business_name_display, category, city, district, photo_urls').eq('is_active', true).is('deactivated_at', null).order('business_name_display'),
    ]);
    if (profilesRes.error) setError(profilesRes.error.message);
    else setProfiles(profilesRes.data ?? []);
    if (venuesRes.error) setError(venuesRes.error.message);
    else setVenues(venuesRes.data ?? []);
  }

  async function loadExistingMatches() {
    const { data: groups } = await supabase.from('groups').select('id, city, created_at').order('created_at', { ascending: false });
    if (!groups) return;

    const groupIds = groups.map((g) => g.id);
    if (groupIds.length === 0) { setExistingMatches([]); return; }

    const [membersRes, questsRes] = await Promise.all([
      supabase.from('group_members').select('group_id, user_id, profiles:profiles!inner(id, display_name, photo_url)').in('group_id', groupIds),
      supabase.from('quests').select('id, group_id, venue_id, title, title_en, quest_description, status, expires_at, completed_at, cancelled_at, venue:venues!inner(id, business_name_display, category)').in('group_id', groupIds),
    ]);

    const members = (membersRes.data ?? []) as any[];
    const quests = (questsRes.data ?? []) as any[];

    const built: ExistingMatch[] = groups.map((g) => {
      const quest = quests.find((q) => q.group_id === g.id);
      if (!quest) return null;
      const groupMembers = members.filter((m) => m.group_id === g.id).map((m: any) => ({
        user_id: m.user_id,
        display_name: m.profiles?.display_name ?? '?',
        photo_url: m.profiles?.photo_url ?? null,
      }));
      return {
        group_id: g.id,
        city: g.city,
        created_at: g.created_at,
        quest_id: quest.id,
        quest_title: quest.title ?? 'Untitled',
        quest_title_en: quest.title_en,
        quest_description: quest.quest_description ?? '',
        quest_status: quest.status,
        expires_at: quest.expires_at,
        completed_at: quest.completed_at,
        cancelled_at: quest.cancelled_at,
        venue_id: quest.venue_id,
        venue_name: quest.venue.business_name_display,
        venue_category: quest.venue.category,
        members: groupMembers,
      } as ExistingMatch;
    }).filter(Boolean) as ExistingMatch[];

    setExistingMatches(built);
  }

  async function loadMatchRequests() {
    const { data } = await supabase
      .from('match_requests')
      .select('id, user_id, city, group_size, status, created_at, profile:profiles!inner(display_name, photo_url, home_district)')
      .eq('status', 'searching')
      .order('created_at', { ascending: true });
    if (data) setMatchRequests(data as any);
  }

  function prefillFromRequest(req: MatchRequestRow) {
    setView('create');
    if (req.city) setSelectedCity(req.city);
    setSelectedUserIds(new Set([req.user_id]));
    setPrefilledRequestId(req.id);
    setSelectedVenueId('');
    setMenuItems([]);
    setSelectedMenuIds(new Set());
    setError(null);
    setSuccess(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function rejectRequest(req: MatchRequestRow) {
    if (!confirm(`Mark ${req.profile?.display_name}'s request as "no match found"?`)) return;
    const { error: err } = await supabase
      .from('match_requests')
      .update({
        status: 'no_match_found',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', req.id);
    if (err) { setError(err.message); return; }
    setSuccess(`✓ Request marked as no-match: ${req.profile?.display_name}`);
    await loadMatchRequests();
    setTimeout(() => setSuccess(null), 4000);
  }

  async function loadMenuItemsForVenue(venueId: string) {
    setMenuItems([]);
    setSelectedMenuIds(new Set());
    if (!venueId) return;
    const venue = venues.find((v) => v.id === venueId);
    if (!venue) return;
    const cat = CATEGORY_LABELS[venue.category];
    if (!cat?.needsMenu) return;

    const { data } = await supabase.from('venue_menu_items').select('id, name, name_en, price_won, is_signature').eq('venue_id', venueId).order('is_signature', { ascending: false }).order('display_order');
    if (data) {
      setMenuItems(data);
      setSelectedMenuIds(new Set(data.filter((m) => m.is_signature).map((m) => m.id)));
    }
  }

  function toggleUser(userId: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else if (next.size < 3) next.add(userId);
      return next;
    });
  }

  function toggleMenuItem(itemId: string) {
    setSelectedMenuIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function createMatch() {
    if (selectedUserIds.size !== 3) { setError('Please select exactly 3 users.'); return; }
    if (!selectedVenueId) { setError('Please select a venue.'); return; }
    const selectedVenue = venues.find((v) => v.id === selectedVenueId);
    if (!selectedVenue) return;
    const selectedMenuItems = menuItems.filter((m) => selectedMenuIds.has(m.id));
    const catInfo = CATEGORY_LABELS[selectedVenue.category];
    if (catInfo?.needsMenu && selectedMenuItems.length === 0) { setError('Please select at least one menu item.'); return; }

    setCreating(true);
    setError(null);
    setSuccess(null);

    const selectedProfilesArr = profiles.filter((p) => selectedUserIds.has(p.id));

    try {
      const { data: group, error: groupError } = await supabase.from('groups').insert({ city: selectedCity, created_by: user!.id }).select('id').single();
      if (groupError || !group) throw new Error(`Group creation failed: ${groupError?.message}`);

      const memberRows = [...selectedUserIds].map((uid) => ({ 
        group_id: group.id, 
        user_id: uid,
        invited_at: new Date().toISOString(),
        accepted_at: new Date().toISOString(),
      }));
      const { error: membersError } = await supabase.from('group_members').insert(memberRows);
      if (membersError) throw new Error(`Members insert failed: ${membersError.message}`);

      const questContent = generateQuestTitleAndDescription(selectedVenue, selectedMenuItems);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14);

      const { data: quest, error: questError } = await supabase.from('quests').insert({
        group_id: group.id,
        venue_id: selectedVenueId,
        title: questContent.title,
        title_en: questContent.title_en,
        quest_description: questContent.description,
        description_en: questContent.description_en,
        status: 'proposed',
        expires_at: expiresAt.toISOString(),
      }).select('id').single();
      if (questError || !quest) throw new Error(`Quest creation failed: ${questError?.message}`);

      if (selectedMenuItems.length > 0) {
        await supabase.from('quest_menu_items').insert(selectedMenuItems.map((m) => ({ quest_id: quest.id, menu_item_id: m.id })));
      }

      // If this was from a match request, mark it matched
      if (prefilledRequestId) {
        await supabase
          .from('match_requests')
          .update({
            status: 'matched',
            matched_group_id: group.id,
            resolved_at: new Date().toISOString(),
          })
          .eq('id', prefilledRequestId);
        setPrefilledRequestId(null);
      }

      // Send match emails (fire and forget)
      Promise.all(selectedProfilesArr.map(async (up) => {
        const otherNames = selectedProfilesArr.filter((p) => p.id !== up.id).map((p) => p.display_name);
        try {
          await fetch('/api/emails/match-created', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: up.id, recipientName: up.display_name, otherMemberNames: otherNames,
              venueName: selectedVenue.business_name_display,
              questTitle: questContent.title, questTitleEn: questContent.title_en,
              questDescription: questContent.description, questDescriptionEn: questContent.description_en,
              daysToComplete: 14,
            }),
          });
        } catch (e) { console.error('Email failed for', up.id, e); }
      })).catch((e) => console.error(e));

      setSuccess(`✓ Match created at ${selectedVenue.business_name_display}. Emails sent.`);
      setSelectedUserIds(new Set());
      setSelectedVenueId('');
      setSelectedMenuIds(new Set());
      setMenuItems([]);
      setCreating(false);

      await loadExistingMatches();
      await loadMatchRequests();

      setView('list');
      setTimeout(() => setSuccess(null), 6000);
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  }

  async function cancelMatch(match: ExistingMatch) {
    setProcessingMatchId(match.group_id);
    setError(null);
    try {
      const { error: qErr } = await supabase.from('quests').update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      }).eq('id', match.quest_id);
      if (qErr) throw new Error(qErr.message);

      // Mark all group members as left
      await supabase.from('group_members').update({
        left_at: new Date().toISOString(),
      }).eq('group_id', match.group_id).is('left_at', null);

      // Close the group
      await supabase.from('groups').update({
        is_pending_invites: false,
        phase: 'cancelled',
      }).eq('id', match.group_id);

      setSuccess(`✓ Match cancelled: ${match.venue_name}`);
      setCancelingId(null);
      setCancelReason('');
      await loadExistingMatches();
      setProcessingMatchId(null);
      setTimeout(() => setSuccess(null), 4000);
    } catch (e) {
      setError((e as Error).message);
      setProcessingMatchId(null);
    }
  }

  async function completeMatch(match: ExistingMatch) {
    if (!confirm(`Mark ${match.venue_name} match as completed?`)) return;
    setProcessingMatchId(match.group_id);
    setError(null);
    try {
      const { error: qErr } = await supabase.from('quests').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', match.quest_id);
      if (qErr) throw new Error(qErr.message);

      // Mark all group members as left (match is done)
      await supabase.from('group_members').update({
        left_at: new Date().toISOString(),
      }).eq('group_id', match.group_id).is('left_at', null);

      setSuccess(`✓ Match completed: ${match.venue_name}`);
      await loadExistingMatches();
      setProcessingMatchId(null);
      setTimeout(() => setSuccess(null), 4000);
    } catch (e) {
      setError((e as Error).message);
      setProcessingMatchId(null);
    }
  }

  async function scheduleMatch(match: ExistingMatch) {
    if (!confirm(`Mark ${match.venue_name} as scheduled?`)) return;
    setProcessingMatchId(match.group_id);
    setError(null);
    try {
      const { error: qErr } = await supabase.from('quests').update({ status: 'scheduled' }).eq('id', match.quest_id);
      if (qErr) throw new Error(qErr.message);

      setSuccess(`✓ Match scheduled: ${match.venue_name}`);
      await loadExistingMatches();
      setProcessingMatchId(null);
      setTimeout(() => setSuccess(null), 4000);
    } catch (e) {
      setError((e as Error).message);
      setProcessingMatchId(null);
    }
  }

  if (loading || (user && user.id !== ADMIN_USER_ID)) {
    return (
      <main className="loading-wrap">
        <div className="loader" />
        <style jsx>{`.loading-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; } .loader { width: 40px; height: 40px; border: 3px solid var(--ink-12); border-top-color: var(--persimmon); border-radius: 50%; animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </main>
    );
  }
  if (!user) return null;

  const activeMatchUserIds = new Set<string>();
  for (const m of existingMatches) {
    if (m.quest_status === 'proposed' || m.quest_status === 'scheduled') {
      for (const mem of m.members) activeMatchUserIds.add(mem.user_id);
    }
  }

  const filteredMatches = existingMatches.filter((m) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'active') return m.quest_status === 'proposed' || m.quest_status === 'scheduled';
    return m.quest_status === statusFilter;
  });

  const filteredProfiles = profiles.filter((p) => {
    if (activeMatchUserIds.has(p.id)) return false;
    const cityInfo = CITIES.find((c) => c.code === selectedCity);
    if (!cityInfo) return true;
    if (!p.home_district) return false;
    const dist = p.home_district.toLowerCase();
    const cityKo = cityInfo.label.split(' · ')[0].toLowerCase();
    const cityEn = cityInfo.label.split(' · ')[1]?.toLowerCase() ?? '';
    return dist.includes(cityKo) || dist.includes(cityEn) || dist.includes(selectedCity);
  });

  const filteredVenues = venues.filter((v) => v.city === selectedCity);
  const selectedProfiles = profiles.filter((p) => selectedUserIds.has(p.id));
  const groupScore = selectedProfiles.length >= 2 ? groupCompatibility(selectedProfiles) : 0;

  function daysUntil(iso: string) { return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24)); }

  return (
    <>
      <header className="a-nav">
        <div className="wrap a-nav-in">
          <a className="brand" href="/">Doreham <span className="ko-mark">도레함</span> · Matches</a>
          <a href="/admin/venues" className="back-link">Venues admin</a>
        </div>
      </header>

      <main className="a-wrap">
        <div className="a-header">
          <h1>Matches</h1>
          <div className="view-toggle">
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
              📋 View all ({existingMatches.length})
            </button>
            <button className={view === 'create' ? 'active' : ''} onClick={() => setView('create')}>
              ✨ Create new
            </button>
          </div>
        </div>

        {error && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner">{success}</div>}

        {/* Pending match requests section */}
        {matchRequests.length > 0 && (
          <div className="requests-section">
            <div className="requests-header">
              <h2>🔔 Pending match requests <span className="req-count">{matchRequests.length}</span></h2>
              <p className="req-hint">Click a request to prefill the create-match form with that user + their city.</p>
            </div>
            <div className="requests-list">
              {matchRequests.map((req) => {
                const isPrefilled = prefilledRequestId === req.id;
                const cityLabel = req.city ? (CITIES.find((c) => c.code === req.city)?.label ?? req.city) : 'Random';
                const sizeLabel = req.group_size ? `${req.group_size} people` : 'Random size';
                const ageMinutes = Math.floor((Date.now() - new Date(req.created_at).getTime()) / 60000);
                const ageDisplay = ageMinutes < 60 ? `${ageMinutes}m ago` : `${Math.floor(ageMinutes / 60)}h ago`;

                return (
                  <div key={req.id} className={`request-row ${isPrefilled ? 'prefilled' : ''}`}>
                    <div className="req-left" onClick={() => prefillFromRequest(req)}>
                      {req.profile?.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={req.profile.photo_url} alt="" className="req-avatar" />
                      ) : (
                        <div className="req-avatar req-avatar-fb">
                          {req.profile?.display_name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <div>
                        <div className="req-name">
                          {req.profile?.display_name ?? 'Unknown'}
                          {isPrefilled && <span className="prefilled-tag">PREFILLED</span>}
                        </div>
                        <div className="req-meta">
                          📍 {cityLabel} · 👥 {sizeLabel} · ⏱ {ageDisplay}
                        </div>
                        {req.profile?.home_district && (
                          <div className="req-district">{req.profile.home_district}</div>
                        )}
                      </div>
                    </div>
                    <div className="req-actions">
                      <button className="btn-primary-req" onClick={() => prefillFromRequest(req)}>
                        Match this user →
                      </button>
                      <button className="btn-danger-outline" onClick={() => rejectRequest(req)}>
                        No match
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {loadingData ? (
          <div className="loading-inline">Loading…</div>
        ) : view === 'list' ? (
          <>
            <div className="filter-bar">
              {(['active', 'proposed', 'scheduled', 'completed', 'cancelled', 'all'] as const).map((s) => (
                <button key={s} className={`filter-btn ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                  {s === 'active' ? 'Active' : s === 'all' ? 'All' : STATUS_LABELS[s]?.label ?? s}
                </button>
              ))}
            </div>

            {filteredMatches.length === 0 ? (
              <div className="empty-state">
                <p>No matches in this filter.</p>
                {statusFilter !== 'all' && <button className="btn-link" onClick={() => setStatusFilter('all')}>Show all</button>}
              </div>
            ) : (
              <div className="matches-list">
                {filteredMatches.map((match) => {
                  const isExpanded = expandedMatchId === match.group_id;
                  const status = STATUS_LABELS[match.quest_status];
                  const days = daysUntil(match.expires_at);
                  const cat = CATEGORY_LABELS[match.venue_category];
                  const isProcessing = processingMatchId === match.group_id;
                  const isCanceling = cancelingId === match.group_id;

                  return (
                    <div key={match.group_id} className={`match-row ${isExpanded ? 'expanded' : ''}`}>
                      <div className="match-header" onClick={() => setExpandedMatchId(isExpanded ? null : match.group_id)}>
                        <div className="match-main">
                          <div className="match-title">
                            {cat?.emoji} {match.quest_title_en ?? match.quest_title}
                          </div>
                          <div className="match-meta">
                            {match.members.map((m) => m.display_name).join(' · ')} — {match.city} · {days > 0 ? `${days}d left` : 'expired'}
                          </div>
                        </div>
                        <span className={`status-badge status-${status?.color ?? 'gray'}`}>{status?.label ?? match.quest_status}</span>
                      </div>

                      {isExpanded && (
                        <div className="match-expanded">
                          <div className="match-detail">
                            <strong>Venue:</strong> {match.venue_name}
                          </div>
                          <div className="match-detail">
                            <strong>Quest:</strong> {match.quest_title}
                          </div>
                          <div className="match-detail">
                            <strong>Description:</strong>
                            <p>{match.quest_description}</p>
                          </div>
                          <div className="match-detail">
                            <strong>Members:</strong>
                            <div className="members-row">
                              {match.members.map((m) => (
                                <div key={m.user_id} className="member-pill">
                                  {m.photo_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={m.photo_url} alt="" />
                                  ) : (
                                    <span className="pill-fallback">{m.display_name[0]?.toUpperCase()}</span>
                                  )}
                                  {m.display_name}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="match-detail">
                            <strong>Created:</strong> {new Date(match.created_at).toLocaleString()}
                          </div>
                          {match.completed_at && (
                            <div className="match-detail">
                              <strong>Completed:</strong> {new Date(match.completed_at).toLocaleString()}
                            </div>
                          )}
                          {match.cancelled_at && (
                            <div className="match-detail">
                              <strong>Cancelled:</strong> {new Date(match.cancelled_at).toLocaleString()}
                            </div>
                          )}

                          {(match.quest_status === 'proposed' || match.quest_status === 'scheduled') && (
                            <div className="match-actions">
                              {isCanceling ? (
                                <div className="cancel-form">
                                  <textarea placeholder="Reason for cancellation (optional, internal)" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2} />
                                  <div className="cancel-actions">
                                    <button className="btn-secondary" onClick={() => { setCancelingId(null); setCancelReason(''); }}>Cancel</button>
                                    <button className="btn-danger" onClick={() => cancelMatch(match)} disabled={isProcessing}>Confirm cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {match.quest_status === 'proposed' && (
                                    <button className="btn-secondary" onClick={() => scheduleMatch(match)} disabled={isProcessing}>📅 Mark scheduled</button>
                                  )}
                                  <button className="btn-success" onClick={() => completeMatch(match)} disabled={isProcessing}>✓ Mark completed</button>
                                  <button className="btn-danger-outline" onClick={() => setCancelingId(match.group_id)} disabled={isProcessing}>✗ Cancel match</button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <>
            {prefilledRequestId && (
              <div className="prefill-banner">
                💡 Form is prefilled from a match request. When you create the match, the request will auto-resolve.
                <button className="clear-prefill" onClick={() => { setPrefilledRequestId(null); setSelectedUserIds(new Set()); }}>Clear prefill</button>
              </div>
            )}

            <div className="section">
              <h2>1. City</h2>
              <select value={selectedCity} onChange={(e) => { setSelectedCity(e.target.value); setSelectedUserIds(new Set()); setSelectedVenueId(''); setMenuItems([]); setPrefilledRequestId(null); }} className="input">
                {CITIES.map((c) => (<option key={c.code} value={c.code}>{c.label}</option>))}
              </select>
            </div>

            <div className="section">
              <div className="section-header">
                <h2>2. Users (select 3)</h2>
                <span className="selected-count">{selectedUserIds.size} / 3 selected</span>
              </div>
              {activeMatchUserIds.size > 0 && (
                <p className="section-hint">Users already in active matches are hidden ({activeMatchUserIds.size} users).</p>
              )}
              {filteredProfiles.length === 0 ? (
                <p className="empty-inline">No unmatched users in this city.</p>
              ) : (
                <>
                  {selectedProfiles.length >= 2 && <div className="score-preview">Group compatibility: <strong>{groupScore}</strong> / 100</div>}
                  <div className="users-grid">
                    {filteredProfiles.map((p) => {
                      const isSelected = selectedUserIds.has(p.id);
                      const canSelect = selectedUserIds.size < 3 || isSelected;
                      let scoreVsSelected = 0;
                      if (selectedProfiles.length > 0 && !isSelected) {
                        const scores = selectedProfiles.map((s) => compatibilityScore(p, s));
                        scoreVsSelected = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                      }
                      return (
                        <button key={p.id} type="button" className={`user-card ${isSelected ? 'selected' : ''} ${!canSelect ? 'disabled' : ''}`} onClick={() => canSelect && toggleUser(p.id)} disabled={!canSelect}>
                          <div className="user-top">
                            {p.photo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.photo_url} alt="" className="avatar" />
                            ) : (
                              <div className="avatar avatar-fallback">{p.display_name[0]?.toUpperCase()}</div>
                            )}
                            <div>
                              <div className="user-name">{p.display_name}</div>
                              <div className="user-district">{p.home_district}</div>
                            </div>
                          </div>
                          <div className="user-tags">
                            {p.mbti_type && <span className="tag">{p.mbti_type}</span>}
                            {p.zodiac_sign && <span className="tag">{p.zodiac_sign}</span>}
                          </div>
                          {scoreVsSelected > 0 && <div className="user-score">Compat: {scoreVsSelected}/100</div>}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="section">
              <h2>3. Venue</h2>
              {filteredVenues.length === 0 ? <p className="empty-inline">No approved venues in this city.</p> : (
                <select value={selectedVenueId} onChange={(e) => { setSelectedVenueId(e.target.value); loadMenuItemsForVenue(e.target.value); }} className="input">
                  <option value="">— Select a venue —</option>
                  {filteredVenues.map((v) => { const cat = CATEGORY_LABELS[v.category]; return (<option key={v.id} value={v.id}>{cat?.emoji} {v.business_name_display} · {cat?.en ?? v.category}</option>); })}
                </select>
              )}
            </div>

            {menuItems.length > 0 && (
              <div className="section">
                <h2>4. Menu items for quest</h2>
                <p className="section-hint">Signature items are pre-selected.</p>
                <div className="menu-grid">
                  {menuItems.map((m) => {
                    const isSelected = selectedMenuIds.has(m.id);
                    return (
                      <button key={m.id} type="button" className={`menu-card ${isSelected ? 'selected' : ''}`} onClick={() => toggleMenuItem(m.id)}>
                        <div className="menu-name">{m.name} {m.is_signature && '⭐'}</div>
                        {m.name_en && <div className="menu-name-en">{m.name_en}</div>}
                        {m.price_won && <div className="menu-price">₩{m.price_won.toLocaleString()}</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="create-actions">
              <button type="button" className="btn-create" onClick={createMatch} disabled={creating || selectedUserIds.size !== 3 || !selectedVenueId || (menuItems.length > 0 && selectedMenuIds.size === 0)}>
                {creating ? 'Creating…' : '✨ Create match'}
              </button>
            </div>
          </>
        )}
      </main>

      <style jsx>{`
        .a-nav { background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); position: sticky; top: 0; z-index: 10; backdrop-filter: blur(8px); }
        .a-nav-in { display: flex; align-items: center; justify-content: space-between; height: 68px; }
        .brand { font-family: var(--display); font-weight: 800; font-size: 18px; text-decoration: none; color: var(--ink); }
        .ko-mark { color: var(--ink-60); font-weight: 700; font-size: 15px; }
        .back-link { color: var(--ink-60); text-decoration: none; font-size: 14px; font-weight: 500; }
        .back-link:hover { color: var(--ink); }
        .a-wrap { max-width: 1100px; margin: 0 auto; padding: 32px 24px 80px; }
        .a-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 16px; }
        .a-header h1 { font-family: var(--display); font-weight: 800; font-size: 32px; margin: 0; letter-spacing: -0.02em; }
        .view-toggle { display: inline-flex; border: 1px solid var(--ink-12); border-radius: 999px; overflow: hidden; background: var(--paper-2); }
        .view-toggle button { border: 0; background: transparent; font-family: var(--body); font-weight: 600; font-size: 13px; padding: 10px 18px; cursor: pointer; color: var(--ink-60); }
        .view-toggle button.active { background: var(--ink); color: var(--paper); }
        .error-banner { background: rgba(255, 106, 61, 0.1); color: var(--persimmon); border: 1px solid rgba(255, 106, 61, 0.25); padding: 12px 16px; border-radius: 12px; margin-bottom: 16px; }
        .success-banner { background: rgba(15, 157, 119, 0.1); color: var(--jade); border: 1px solid rgba(15, 157, 119, 0.25); padding: 12px 16px; border-radius: 12px; font-weight: 600; margin-bottom: 16px; }
        .loading-inline { text-align: center; padding: 60px; color: var(--ink-60); }
        .filter-bar { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
        .filter-btn { background: #fff; border: 1px solid var(--ink-12); padding: 8px 14px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; color: var(--ink-60); }
        .filter-btn.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
        .btn-link { background: none; border: none; color: var(--persimmon); font-weight: 600; cursor: pointer; text-decoration: underline; padding: 8px 0; }
        .empty-state { text-align: center; padding: 60px 20px; color: var(--ink-60); background: #fff; border-radius: 12px; }
        .empty-inline { color: var(--ink-60); text-align: center; padding: 20px; }
        .matches-list { display: flex; flex-direction: column; gap: 8px; }
        .match-row { background: #fff; border: 1px solid var(--ink-12); border-radius: 12px; overflow: hidden; }
        .match-row.expanded { border-color: var(--persimmon); }
        .match-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 16px; cursor: pointer; user-select: none; }
        .match-header:hover { background: var(--paper-2); }
        .match-main { flex: 1; min-width: 0; }
        .match-title { font-weight: 700; font-size: 15px; color: var(--ink); margin-bottom: 4px; }
        .match-meta { font-size: 13px; color: var(--ink-60); }
        .status-badge { padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.03em; flex-shrink: 0; }
        .status-blue { background: rgba(37, 99, 235, 0.15); color: #1D4ED8; }
        .status-jade { background: rgba(15, 157, 119, 0.15); color: var(--jade); }
        .status-green { background: rgba(15, 157, 119, 0.15); color: var(--jade); }
        .status-gray { background: rgba(30, 34, 48, 0.08); color: var(--ink-60); }
        .match-expanded { padding: 16px; border-top: 1px solid var(--ink-12); background: var(--paper-2); }
        .match-detail { margin-bottom: 12px; font-size: 14px; }
        .match-detail strong { display: block; font-size: 12px; color: var(--ink-60); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
        .match-detail p { margin: 0; color: var(--ink); }
        .members-row { display: flex; gap: 8px; flex-wrap: wrap; }
        .member-pill { display: flex; align-items: center; gap: 6px; background: #fff; border: 1px solid var(--ink-12); padding: 4px 12px 4px 4px; border-radius: 999px; font-size: 13px; font-weight: 600; }
        .member-pill img, .pill-fallback { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
        .pill-fallback { background: var(--persimmon); color: #fff; display: grid; place-items: center; font-size: 11px; font-weight: 700; }
        .match-actions { display: flex; gap: 8px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--ink-12); flex-wrap: wrap; }
        .btn-secondary, .btn-success, .btn-danger, .btn-danger-outline { padding: 8px 16px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid transparent; }
        .btn-secondary { background: #fff; border-color: var(--ink-12); color: var(--ink); }
        .btn-secondary:hover:not(:disabled) { background: var(--ink); color: var(--paper); }
        .btn-success { background: var(--jade); color: #fff; }
        .btn-success:hover:not(:disabled) { transform: translateY(-1px); }
        .btn-danger { background: var(--persimmon); color: #fff; }
        .btn-danger-outline { background: transparent; border-color: var(--persimmon); color: var(--persimmon); }
        .btn-danger-outline:hover:not(:disabled) { background: var(--persimmon); color: #fff; }
        .btn-secondary:disabled, .btn-success:disabled, .btn-danger:disabled, .btn-danger-outline:disabled { opacity: 0.5; cursor: not-allowed; }
        .cancel-form { flex: 1; }
        .cancel-form textarea { width: 100%; padding: 10px 14px; border: 1px solid var(--ink-12); border-radius: 10px; font-family: var(--body); font-size: 14px; resize: vertical; margin-bottom: 8px; }
        .cancel-actions { display: flex; gap: 8px; justify-content: flex-end; }
        .section { background: #fff; border: 1px solid var(--ink-12); border-radius: 16px; padding: 20px 24px; margin-bottom: 16px; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .section h2 { font-family: var(--display); font-weight: 700; font-size: 18px; margin: 0 0 12px; color: var(--ink); }
        .selected-count { font-size: 14px; color: var(--persimmon); font-weight: 600; }
        .section-hint { font-size: 13px; color: var(--ink-60); margin: 0 0 12px; }
        .input { width: 100%; padding: 12px 16px; border: 1px solid var(--ink-12); border-radius: 12px; background: #fff; font-size: 15px; outline: none; }
        .input:focus { border-color: var(--persimmon); }
        .score-preview { background: rgba(15, 157, 119, 0.08); color: var(--jade); font-size: 14px; padding: 10px 14px; border-radius: 10px; margin-bottom: 12px; font-weight: 500; }
        .users-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
        .user-card { display: flex; flex-direction: column; gap: 8px; padding: 14px; background: var(--paper-2); border: 2px solid transparent; border-radius: 12px; cursor: pointer; text-align: left; }
        .user-card:hover:not(.disabled) { border-color: var(--ink-60); }
        .user-card.selected { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.05); }
        .user-card.disabled { opacity: 0.4; cursor: not-allowed; }
        .user-top { display: flex; gap: 10px; align-items: center; }
        .avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }
        .avatar-fallback { background: var(--persimmon); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 14px; }
        .user-name { font-weight: 700; font-size: 14px; color: var(--ink); }
        .user-district { font-size: 12px; color: var(--ink-60); }
        .user-tags { display: flex; gap: 4px; flex-wrap: wrap; }
        .tag { background: #fff; border: 1px solid var(--ink-12); padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; color: var(--ink-60); }
        .user-score { font-size: 12px; font-weight: 700; color: var(--jade); margin-top: 4px; }
        .menu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; }
        .menu-card { padding: 12px; background: var(--paper-2); border: 2px solid transparent; border-radius: 10px; cursor: pointer; text-align: left; }
        .menu-card:hover { border-color: var(--ink-60); }
        .menu-card.selected { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.05); }
        .menu-name { font-weight: 700; font-size: 14px; color: var(--ink); }
        .menu-name-en { font-size: 12px; color: var(--ink-60); margin-top: 2px; }
        .menu-price { font-size: 12px; color: var(--jade); font-weight: 700; margin-top: 4px; }
        .create-actions { display: flex; justify-content: flex-end; padding-top: 12px; }
        .btn-create { background: var(--persimmon); color: #fff; border: 0; padding: 16px 40px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 16px; cursor: pointer; }
        .btn-create:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .btn-create:disabled { opacity: 0.55; cursor: not-allowed; }

        /* Pending requests section */
        .requests-section { background: linear-gradient(135deg, rgba(255, 106, 61, 0.05), rgba(255, 106, 61, 0.02)); border: 2px solid rgba(255, 106, 61, 0.2); border-radius: 16px; padding: 20px; margin-bottom: 24px; }
        .requests-header { margin-bottom: 14px; }
        .requests-header h2 { font-family: var(--display); font-weight: 800; font-size: 20px; margin: 0 0 4px; display: flex; align-items: center; gap: 8px; }
        .req-count { background: var(--persimmon); color: #fff; font-size: 12px; font-weight: 800; padding: 3px 10px; border-radius: 999px; }
        .req-hint { font-size: 13px; color: var(--ink-60); margin: 0; }
        .requests-list { display: flex; flex-direction: column; gap: 10px; }
        .request-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; background: #fff; border: 1px solid var(--ink-12); border-radius: 12px; padding: 12px 14px; flex-wrap: wrap; }
        .request-row.prefilled { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.03); }
        .req-left { display: flex; gap: 12px; align-items: center; flex: 1; cursor: pointer; min-width: 0; }
        .req-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .req-avatar-fb { background: var(--persimmon); color: #fff; display: grid; place-items: center; font-weight: 700; font-size: 16px; }
        .req-name { font-weight: 700; font-size: 15px; color: var(--ink); display: flex; align-items: center; gap: 8px; }
        .prefilled-tag { background: var(--persimmon); color: #fff; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.05em; }
        .req-meta { font-size: 12px; color: var(--ink-60); margin-top: 2px; }
        .req-district { font-size: 11px; color: var(--ink-60); font-style: italic; margin-top: 2px; }
        .req-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .btn-primary-req { background: var(--persimmon); color: #fff; border: 0; padding: 8px 16px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .btn-primary-req:hover { transform: translateY(-1px); }

        .prefill-banner { background: rgba(255, 106, 61, 0.08); border: 1px solid rgba(255, 106, 61, 0.25); color: var(--ink); padding: 12px 16px; border-radius: 12px; margin-bottom: 16px; font-size: 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
        .clear-prefill { background: transparent; border: 1px solid var(--ink-12); color: var(--ink-60); padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .clear-prefill:hover { color: var(--persimmon); border-color: var(--persimmon); }
      `}</style>
    </>
  );
}