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

// Preset cities matching the KOREAN_CITIES list
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

// Compatibility scoring — simple Big Five difference
function compatibilityScore(a: Profile, b: Profile): number {
  if (!a.big_five_openness || !b.big_five_openness) return 0;
  const traits: (keyof Profile)[] = [
    'big_five_openness',
    'big_five_conscientiousness',
    'big_five_extraversion',
    'big_five_agreeableness',
    'big_five_neuroticism',
  ];
  let sumDiff = 0;
  for (const t of traits) {
    const av = (a[t] as number) ?? 0.5;
    const bv = (b[t] as number) ?? 0.5;
    sumDiff += Math.abs(av - bv);
  }
  // Lower diff = better match. Score: 100 - (avg diff * 100)
  const avgDiff = sumDiff / traits.length;
  const bigFiveScore = Math.max(0, 100 - avgDiff * 100);

  // Interest overlap bonus
  const aInterests = new Set([...(a.activity_preferences ?? []), ...(a.interests ?? [])]);
  const bInterests = new Set([...(b.activity_preferences ?? []), ...(b.interests ?? [])]);
  const overlap = [...aInterests].filter((x) => bInterests.has(x)).length;
  const interestBonus = overlap * 5;

  return Math.min(100, Math.round(bigFiveScore + interestBonus));
}

// Group compatibility = average of all pairs
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

function generateQuestTitleAndDescription(
  venue: Venue,
  menuItems: MenuItem[]
): { title: string; title_en: string; description: string; description_en: string } {
  const catInfo = CATEGORY_LABELS[venue.category];
  const emoji = catInfo?.emoji ?? '🌟';

  if (venue.category === 'cafe' && menuItems.length > 0) {
    const itemNames = menuItems.map((m) => m.name).join(', ');
    const itemNamesEn = menuItems.map((m) => m.name_en ?? m.name).join(', ');
    return {
      title: `${emoji} ${venue.business_name_display}에서 함께 시간 보내기`,
      title_en: `${emoji} Coffee time at ${venue.business_name_display}`,
      description: `${venue.business_name_display}에 함께 방문해서 ${itemNames}을(를) 각자 주문하고 서로 나눠 마셔보세요. 어떤 메뉴가 가장 마음에 들었는지 이야기해보세요!`,
      description_en: `Visit ${venue.business_name_display} together and each order one of these: ${itemNamesEn}. Share sips and talk about which was your favorite!`,
    };
  }

  if (venue.category === 'restaurant' && menuItems.length > 0) {
    const itemNames = menuItems.map((m) => m.name).join(', ');
    const itemNamesEn = menuItems.map((m) => m.name_en ?? m.name).join(', ');
    return {
      title: `${emoji} ${venue.business_name_display}에서 함께 식사`,
      title_en: `${emoji} Share a meal at ${venue.business_name_display}`,
      description: `${venue.business_name_display}에서 함께 식사해요. ${itemNames} 중 하나씩 주문해서 나눠 먹으면 좋겠어요!`,
      description_en: `Meet at ${venue.business_name_display} for a meal. Try ordering ${itemNamesEn} — sharing dishes is more fun!`,
    };
  }

  // Generic templates for other categories
  const genericByCategory: Record<string, { ko: string; en: string; titleKo: string; titleEn: string }> = {
    board_game_cafe: {
      titleKo: `${emoji} ${venue.business_name_display}에서 보드게임`,
      titleEn: `${emoji} Board game night at ${venue.business_name_display}`,
      ko: `${venue.business_name_display}에서 함께 보드게임을 즐겨보세요. 잘 모르는 게임이라도 도전해보는 게 재미의 시작이에요!`,
      en: `Head to ${venue.business_name_display} and play a board game together. Pick something none of you have tried — that's where the fun starts!`,
    },
    escape_room: {
      titleKo: `${emoji} ${venue.business_name_display} 방탈출 도전`,
      titleEn: `${emoji} Escape ${venue.business_name_display} together`,
      ko: `${venue.business_name_display}에서 함께 방탈출을 도전해보세요. 협력이 관건이에요!`,
      en: `Take on an escape room at ${venue.business_name_display} together. Teamwork is everything!`,
    },
    bookshop: {
      titleKo: `${emoji} ${venue.business_name_display}에서 서로에게 책 추천`,
      titleEn: `${emoji} Book swap at ${venue.business_name_display}`,
      ko: `${venue.business_name_display}에 함께 방문해서 각자 상대방에게 추천할 책을 골라주세요. 왜 그 책을 골랐는지 이야기해요.`,
      en: `Visit ${venue.business_name_display} together. Each pick a book to recommend to another group member — then explain your choice!`,
    },
    workshop_creative: {
      titleKo: `${emoji} ${venue.business_name_display}에서 함께 만들기`,
      titleEn: `${emoji} Make something at ${venue.business_name_display}`,
      ko: `${venue.business_name_display}에서 함께 원데이 클래스를 즐겨보세요. 각자 만든 작품을 마지막에 자랑해요!`,
      en: `Join a workshop at ${venue.business_name_display} together. Show off your creations at the end!`,
    },
    active_sports: {
      titleKo: `${emoji} ${venue.business_name_display}에서 함께 운동`,
      titleEn: `${emoji} Active time at ${venue.business_name_display}`,
      ko: `${venue.business_name_display}에서 함께 활동해요. 땀 흘리면서 서로 응원해봐요!`,
      en: `Get active together at ${venue.business_name_display}. Sweat and cheer each other on!`,
    },
    cultural_venue: {
      titleKo: `${emoji} ${venue.business_name_display} 함께 둘러보기`,
      titleEn: `${emoji} Explore ${venue.business_name_display} together`,
      ko: `${venue.business_name_display}을(를) 함께 둘러보세요. 서로에게 가장 인상 깊었던 것을 공유해봐요.`,
      en: `Explore ${venue.business_name_display} together. Share what stood out most to each of you.`,
    },
    nature_outdoor: {
      titleKo: `${emoji} ${venue.business_name_display}에서 자연 속으로`,
      titleEn: `${emoji} Into nature at ${venue.business_name_display}`,
      ko: `${venue.business_name_display}에서 함께 시간을 보내세요. 자연 속에서 편안한 대화를 나눠봐요.`,
      en: `Enjoy ${venue.business_name_display} together. Relax and let the conversation flow.`,
    },
    music_movie: {
      titleKo: `${emoji} ${venue.business_name_display}에서 함께 즐기기`,
      titleEn: `${emoji} Together at ${venue.business_name_display}`,
      ko: `${venue.business_name_display}에서 함께 시간을 보내고, 후기를 나눠봐요.`,
      en: `Meet at ${venue.business_name_display}. Enjoy together and share your thoughts after.`,
    },
    other: {
      titleKo: `${emoji} ${venue.business_name_display}에서 만나기`,
      titleEn: `${emoji} Meet up at ${venue.business_name_display}`,
      ko: `${venue.business_name_display}에서 함께 시간을 보내세요.`,
      en: `Spend time together at ${venue.business_name_display}.`,
    },
  };

  const preset = genericByCategory[venue.category] ?? genericByCategory.other;
  return {
    title: preset.titleKo,
    title_en: preset.titleEn,
    description: preset.ko,
    description_en: preset.en,
  };
}

export default function AdminMatchesPage() {
  const router = useRouter();
  const { user, loading } = useUser();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedCity, setSelectedCity] = useState('asan');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [selectedVenueId, setSelectedVenueId] = useState<string>('');
  const [selectedMenuIds, setSelectedMenuIds] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/sign-in?return=/admin/matches');
      return;
    }
    if (user.id !== ADMIN_USER_ID) {
      router.push('/');
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router]);

  async function loadData() {
    setLoadingData(true);
    setError(null);

    const [profilesRes, venuesRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, display_name, home_district, mbti_type, zodiac_sign, activity_preferences, interests, big_five_openness, big_five_conscientiousness, big_five_extraversion, big_five_agreeableness, big_five_neuroticism, onboarding_completed, photo_url')
        .eq('onboarding_completed', true)
        .order('display_name'),
      supabase
        .from('venues')
        .select('id, business_name_display, category, city, district, photo_urls')
        .eq('is_active', true)
        .is('deactivated_at', null)
        .order('business_name_display'),
    ]);

    if (profilesRes.error) setError(profilesRes.error.message);
    else setProfiles(profilesRes.data ?? []);

    if (venuesRes.error) setError(venuesRes.error.message);
    else setVenues(venuesRes.data ?? []);

    setLoadingData(false);
  }

  async function loadMenuItemsForVenue(venueId: string) {
    setMenuItems([]);
    setSelectedMenuIds(new Set());
    if (!venueId) return;

    const venue = venues.find((v) => v.id === venueId);
    if (!venue) return;
    const cat = CATEGORY_LABELS[venue.category];
    if (!cat?.needsMenu) return;

    const { data } = await supabase
      .from('venue_menu_items')
      .select('id, name, name_en, price_won, is_signature')
      .eq('venue_id', venueId)
      .order('is_signature', { ascending: false })
      .order('display_order');

    if (data) {
      setMenuItems(data);
      // Auto-select signature items
      const sigIds = new Set(data.filter((m) => m.is_signature).map((m) => m.id));
      setSelectedMenuIds(sigIds);
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
    if (selectedUserIds.size !== 3) {
      setError('Please select exactly 3 users.');
      return;
    }
    if (!selectedVenueId) {
      setError('Please select a venue.');
      return;
    }

    const selectedVenue = venues.find((v) => v.id === selectedVenueId);
    if (!selectedVenue) return;

    const selectedMenuItems = menuItems.filter((m) => selectedMenuIds.has(m.id));
    const catInfo = CATEGORY_LABELS[selectedVenue.category];
    if (catInfo?.needsMenu && selectedMenuItems.length === 0) {
      setError('Please select at least one menu item for this venue.');
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. Create group
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          city: selectedCity,
          created_by: user!.id,
        })
        .select('id')
        .single();

      if (groupError || !group) throw new Error(`Group creation failed: ${groupError?.message}`);

      // 2. Add members
      const memberRows = [...selectedUserIds].map((uid) => ({
        group_id: group.id,
        user_id: uid,
      }));
      const { error: membersError } = await supabase.from('group_members').insert(memberRows);
      if (membersError) throw new Error(`Members insert failed: ${membersError.message}`);

      // 3. Create quest with generated content
      const questContent = generateQuestTitleAndDescription(selectedVenue, selectedMenuItems);
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14);

      const { data: quest, error: questError } = await supabase
        .from('quests')
        .insert({
          group_id: group.id,
          venue_id: selectedVenueId,
          title: questContent.title,
          title_en: questContent.title_en,
          quest_description: questContent.description,
          description_en: questContent.description_en,
          status: 'proposed',
          expires_at: expiresAt.toISOString(),
        })
        .select('id')
        .single();

      if (questError || !quest) throw new Error(`Quest creation failed: ${questError?.message}`);

      // 4. Insert quest menu items (if any)
      if (selectedMenuItems.length > 0) {
        const questMenuRows = selectedMenuItems.map((m) => ({
          quest_id: quest.id,
          menu_item_id: m.id,
        }));
        await supabase.from('quest_menu_items').insert(questMenuRows);
      }

      setSuccess(`✓ Match created! Group of ${selectedUserIds.size} at ${selectedVenue.business_name_display}`);
      setSelectedUserIds(new Set());
      setSelectedVenueId('');
      setSelectedMenuIds(new Set());
      setMenuItems([]);
      setCreating(false);

      setTimeout(() => setSuccess(null), 6000);
    } catch (e) {
      setError((e as Error).message);
      setCreating(false);
    }
  }

  if (loading || (user && user.id !== ADMIN_USER_ID)) {
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

  const filteredProfiles = profiles.filter((p) => {
    // For matching, we filter by home_district containing the city name
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

  return (
    <>
      <header className="a-nav">
        <div className="wrap a-nav-in">
          <a className="brand" href="/">
            Doreham <span className="ko-mark">도레함</span> · Match
          </a>
          <a href="/admin/venues" className="back-link">Venues admin</a>
        </div>
      </header>

      <main className="a-wrap">
        <div className="a-header">
          <h1>Create a match</h1>
          <p>Select 3 compatible users + a venue, we build the quest.</p>
        </div>

        {error && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner">{success}</div>}

        {loadingData ? (
          <div className="loading-inline">Loading data…</div>
        ) : (
          <>
            {/* City filter */}
            <div className="section">
              <h2>1. City</h2>
              <select
                value={selectedCity}
                onChange={(e) => {
                  setSelectedCity(e.target.value);
                  setSelectedUserIds(new Set());
                  setSelectedVenueId('');
                  setMenuItems([]);
                }}
                className="input"
              >
                {CITIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* User selection */}
            <div className="section">
              <div className="section-header">
                <h2>2. Users (select 3)</h2>
                <span className="selected-count">{selectedUserIds.size} / 3 selected</span>
              </div>

              {filteredProfiles.length === 0 ? (
                <p className="empty">No users in this city yet.</p>
              ) : (
                <>
                  {selectedProfiles.length >= 2 && (
                    <div className="score-preview">
                      Group compatibility: <strong>{groupScore}</strong> / 100
                    </div>
                  )}
                  <div className="users-grid">
                    {filteredProfiles.map((p) => {
                      const isSelected = selectedUserIds.has(p.id);
                      const canSelect = selectedUserIds.size < 3 || isSelected;

                      // Score against other selected users
                      let scoreVsSelected = 0;
                      if (selectedProfiles.length > 0 && !isSelected) {
                        const scores = selectedProfiles.map((s) => compatibilityScore(p, s));
                        scoreVsSelected = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                      }

                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`user-card ${isSelected ? 'selected' : ''} ${!canSelect ? 'disabled' : ''}`}
                          onClick={() => canSelect && toggleUser(p.id)}
                          disabled={!canSelect}
                        >
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
                          {p.activity_preferences && p.activity_preferences.length > 0 && (
                            <div className="user-interests">
                              {p.activity_preferences.slice(0, 3).map((a) => (
                                <span key={a} className="interest">{a.replace(/_/g, ' ')}</span>
                              ))}
                            </div>
                          )}
                          {scoreVsSelected > 0 && (
                            <div className="user-score">Compat: {scoreVsSelected}/100</div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Venue selection */}
            <div className="section">
              <h2>3. Venue</h2>
              {filteredVenues.length === 0 ? (
                <p className="empty">No approved venues in this city yet.</p>
              ) : (
                <select
                  value={selectedVenueId}
                  onChange={(e) => {
                    setSelectedVenueId(e.target.value);
                    loadMenuItemsForVenue(e.target.value);
                  }}
                  className="input"
                >
                  <option value="">— Select a venue —</option>
                  {filteredVenues.map((v) => {
                    const cat = CATEGORY_LABELS[v.category];
                    return (
                      <option key={v.id} value={v.id}>
                        {cat?.emoji} {v.business_name_display} · {cat?.en ?? v.category}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            {/* Menu items (only if venue needs them) */}
            {menuItems.length > 0 && (
              <div className="section">
                <h2>4. Menu items for quest</h2>
                <p className="section-hint">Select which items the group will try. Signature items are pre-selected.</p>
                <div className="menu-grid">
                  {menuItems.map((m) => {
                    const isSelected = selectedMenuIds.has(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={`menu-card ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleMenuItem(m.id)}
                      >
                        <div className="menu-name">
                          {m.name} {m.is_signature && '⭐'}
                        </div>
                        {m.name_en && <div className="menu-name-en">{m.name_en}</div>}
                        {m.price_won && <div className="menu-price">₩{m.price_won.toLocaleString()}</div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Create button */}
            <div className="create-actions">
              <button
                type="button"
                className="btn-create"
                onClick={createMatch}
                disabled={
                  creating ||
                  selectedUserIds.size !== 3 ||
                  !selectedVenueId ||
                  (menuItems.length > 0 && selectedMenuIds.size === 0)
                }
              >
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
        .a-header { margin-bottom: 24px; }
        .a-header h1 { font-family: var(--display); font-weight: 800; font-size: 32px; margin: 0 0 4px; letter-spacing: -0.02em; }
        .a-header p { color: var(--ink-60); margin: 0; }
        .error-banner { background: rgba(255, 106, 61, 0.1); color: var(--persimmon); border: 1px solid rgba(255, 106, 61, 0.25); padding: 12px 16px; border-radius: 12px; margin-bottom: 16px; }
        .success-banner { background: rgba(15, 157, 119, 0.1); color: var(--jade); border: 1px solid rgba(15, 157, 119, 0.25); padding: 12px 16px; border-radius: 12px; font-weight: 600; margin-bottom: 16px; }
        .loading-inline { text-align: center; padding: 60px; color: var(--ink-60); }
        .section { background: #fff; border: 1px solid var(--ink-12); border-radius: 16px; padding: 20px 24px; margin-bottom: 16px; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .section h2 { font-family: var(--display); font-weight: 700; font-size: 18px; margin: 0 0 12px; color: var(--ink); }
        .selected-count { font-size: 14px; color: var(--persimmon); font-weight: 600; }
        .section-hint { font-size: 13px; color: var(--ink-60); margin: 0 0 12px; }
        .empty { color: var(--ink-60); font-size: 14px; text-align: center; padding: 20px; }
        .input { width: 100%; padding: 12px 16px; border: 1px solid var(--ink-12); border-radius: 12px; background: #fff; font-size: 15px; outline: none; }
        .input:focus { border-color: var(--persimmon); }
        .score-preview { background: rgba(15, 157, 119, 0.08); color: var(--jade); font-size: 14px; padding: 10px 14px; border-radius: 10px; margin-bottom: 12px; font-weight: 500; }
        .users-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; }
        .user-card { display: flex; flex-direction: column; gap: 8px; padding: 14px; background: var(--paper-2); border: 2px solid transparent; border-radius: 12px; cursor: pointer; text-align: left; transition: border-color 0.15s, transform 0.12s; }
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
        .user-interests { display: flex; gap: 4px; flex-wrap: wrap; }
        .interest { font-size: 11px; color: var(--ink-60); background: rgba(15, 157, 119, 0.1); padding: 2px 6px; border-radius: 6px; }
        .user-score { font-size: 12px; font-weight: 700; color: var(--jade); margin-top: 4px; }
        .menu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; }
        .menu-card { padding: 12px; background: var(--paper-2); border: 2px solid transparent; border-radius: 10px; cursor: pointer; text-align: left; transition: border-color 0.15s; }
        .menu-card:hover { border-color: var(--ink-60); }
        .menu-card.selected { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.05); }
        .menu-name { font-weight: 700; font-size: 14px; color: var(--ink); }
        .menu-name-en { font-size: 12px; color: var(--ink-60); margin-top: 2px; }
        .menu-price { font-size: 12px; color: var(--jade); font-weight: 700; margin-top: 4px; }
        .create-actions { display: flex; justify-content: flex-end; padding-top: 12px; }
        .btn-create { background: var(--persimmon); color: #fff; border: 0; padding: 16px 40px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 16px; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s; }
        .btn-create:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .btn-create:disabled { opacity: 0.55; cursor: not-allowed; }
      `}</style>
    </>
  );
}