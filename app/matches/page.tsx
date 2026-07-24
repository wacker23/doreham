'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { supabase } from '@/lib/supabase/client';

type GroupMember = {
  user_id: string;
  display_name: string;
  photo_url: string | null;
  mbti_type: string | null;
  zodiac_sign: string | null;
  activity_preferences: string[] | null;
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
  unread_count: number;
  quest: {
    id: string;
    title: string;
    title_en: string | null;
    quest_description: string;
    description_en: string | null;
    status: string;
    expires_at: string;
    proposed_at: string | null;
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

const CATEGORY_LABELS: Record<string, { en: string; ko: string; emoji: string }> = {
  cafe:              { en: 'Café', ko: '카페', emoji: '☕' },
  restaurant:        { en: 'Restaurant', ko: '식당', emoji: '🍜' },
  board_game_cafe:   { en: 'Board game café', ko: '보드게임 카페', emoji: '🎲' },
  escape_room:       { en: 'Escape room', ko: '방탈출', emoji: '🧩' },
  bookshop:          { en: 'Bookshop', ko: '서점', emoji: '📚' },
  workshop_creative: { en: 'Workshop', ko: '원데이 클래스', emoji: '🏺' },
  active_sports:     { en: 'Sports', ko: '스포츠', emoji: '🥾' },
  cultural_venue:    { en: 'Cultural venue', ko: '문화 공간', emoji: '🎨' },
  nature_outdoor:    { en: 'Nature', ko: '자연', emoji: '🌿' },
  music_movie:       { en: 'Music/Movie', ko: '음악·영화', emoji: '🎬' },
  other:             { en: 'Other', ko: '기타', emoji: '🏪' },
};

const STATUS_LABELS: Record<string, { en: string; ko: string; color: string }> = {
  proposed: { en: 'New match!', ko: '새 매칭!', color: 'persimmon' },
  scheduled: { en: 'Scheduled', ko: '예정됨', color: 'jade' },
  completed: { en: 'Completed', ko: '완료', color: 'jade' },
  cancelled: { en: 'Cancelled', ko: '취소됨', color: 'gray' },
  no_show: { en: 'Missed', ko: '불참', color: 'gray' },
};

export default function MyMatchesPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [lang, setLang] = useState<'en' | 'ko'>('en');
  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    loadMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router]);

  async function loadMatches() {
    setLoadingMatches(true);
    setError(null);

    // Find all groups the user is a member of
    const { data: memberships, error: memErr } = await supabase
      .from('group_members')
      .select('group_id, last_read_at')
      .eq('user_id', user!.id);

    if (memErr) {
      setError(memErr.message);
      setLoadingMatches(false);
      return;
    }

    if (!memberships || memberships.length === 0) {
      setMatches([]);
      setLoadingMatches(false);
      return;
    }

    const groupIds = memberships.map((m) => m.group_id);

    // Get groups
    const { data: groups } = await supabase
      .from('groups')
      .select('id, city')
      .in('id', groupIds);

    // Get all group members (across all my groups) with profile info
    const { data: allMembers } = await supabase
      .from('group_members')
      .select('group_id, user_id, profiles:profiles!inner(id, display_name, photo_url, mbti_type, zodiac_sign, activity_preferences)')
      .in('group_id', groupIds);

    // Get all quests for these groups
    const { data: quests } = await supabase
      .from('quests')
      .select(`
        id, group_id, title, title_en, quest_description, description_en, status, expires_at, proposed_at,
        venue:venues!inner(id, business_name_display, category, address, road_address, city, photo_urls)
      `)
      .in('group_id', groupIds);

    // Get quest menu items
    const questIds = (quests ?? []).map((q) => q.id);
    const { data: questMenus } = questIds.length > 0
      ? await supabase
          .from('quest_menu_items')
          .select('quest_id, menu_item:venue_menu_items!inner(id, name, name_en, price_won, is_signature, photo_url)')
          .in('quest_id', questIds)
      : { data: [] };

    // Fetch unread counts for each group
    const unreadCounts: Record<string, number> = {};
    for (const membership of memberships) {
      const lastRead = membership.last_read_at ?? '1970-01-01';
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', membership.group_id)
        .eq('is_hidden', false)
        .neq('sender_id', user!.id)  // Don't count own messages
        .gt('created_at', lastRead);
      unreadCounts[membership.group_id] = count ?? 0;
    }

    // Assemble matches
    const built: Match[] = (groups ?? []).map((g) => {
      const members: GroupMember[] = ((allMembers ?? []).filter((m) => m.group_id === g.id) as any[])
        .map((m) => ({
          user_id: m.user_id,
          display_name: m.profiles.display_name,
          photo_url: m.profiles.photo_url,
          mbti_type: m.profiles.mbti_type,
          zodiac_sign: m.profiles.zodiac_sign,
          activity_preferences: m.profiles.activity_preferences,
        }));

      const quest = (quests as any[])?.find((q) => q.group_id === g.id);
      if (!quest) return null;

      const menuItems: QuestMenuItem[] = ((questMenus ?? []).filter((qm: any) => qm.quest_id === quest.id) as any[])
        .map((qm) => qm.menu_item);

      return {
        group_id: g.id,
        city: g.city,
        members,
        unread_count: unreadCounts[g.id] ?? 0,
        quest: {
          id: quest.id,
          title: quest.title,
          title_en: quest.title_en,
          quest_description: quest.quest_description,
          description_en: quest.description_en,
          status: quest.status,
          expires_at: quest.expires_at,
          proposed_at: quest.proposed_at,
          venue: quest.venue,
          menu_items: menuItems,
        },
      } as Match;
    }).filter(Boolean) as Match[];

    // Sort by expires_at (most urgent first)
    built.sort((a, b) => new Date(a.quest.expires_at).getTime() - new Date(b.quest.expires_at).getTime());

    setMatches(built);
    setLoadingMatches(false);
  }

  function daysRemaining(expiresAt: string): number {
    const ms = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  if (loading || loadingMatches) {
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
          <a className="brand" href="/">
            Doreham <span className="ko-mark">도레함</span>
          </a>
          <div className="toggle">
            <button aria-pressed={lang === 'ko'} onClick={() => setLang('ko')}>한국어</button>
            <button aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
          </div>
        </div>
      </header>

      <main className="wrap main-wrap">
        <div className="page-header">
          <h1>
            {lang === 'ko' ? '내 그룹' : 'My groups'}
          </h1>
          <p className="sub">
            {lang === 'ko'
              ? '도레함이 매칭해준 새로운 친구들과의 모험을 확인하세요.'
              : "Adventures with the friends Doreham matched you with."}
          </p>
        </div>

        {error && <div className="error-banner">{error}</div>}

        {matches.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🌸</div>
            <h2>
              {lang === 'ko' ? '아직 매칭이 없어요' : 'No matches yet'}
            </h2>
            <p>
              {lang === 'ko'
                ? '도레함 팀이 곧 당신을 잘 어울리는 친구들과 매칭해드릴 예정입니다. 프로필이 완성되어 있는지 확인하세요.'
                : "Doreham will match you with compatible friends soon. Make sure your profile is complete."}
            </p>
          </div>
        ) : (
          <div className="matches-list">
            {matches.map((match) => {
              const cat = CATEGORY_LABELS[match.quest.venue.category];
              const status = STATUS_LABELS[match.quest.status] ?? STATUS_LABELS.proposed;
              const days = daysRemaining(match.quest.expires_at);
              const otherMembers = match.members.filter((m) => m.user_id !== user.id);

              return (
                <div key={match.group_id} className="match-card">
                  <div className="match-header">
                    <span className={`status-badge status-${status.color}`}>
                      {lang === 'ko' ? status.ko : status.en}
                    </span>
                    <span className="days-remaining">
                      {days > 0
                        ? (lang === 'ko' ? `${days}일 남음` : `${days} days left`)
                        : (lang === 'ko' ? '기한 만료' : 'Expired')}
                    </span>
                  </div>

                  <h2 className="quest-title">
                    {lang === 'ko' ? match.quest.title : (match.quest.title_en ?? match.quest.title)}
                  </h2>

                  <p className="quest-description">
                    {lang === 'ko'
                      ? match.quest.quest_description
                      : (match.quest.description_en ?? match.quest.quest_description)}
                  </p>

                  {/* Members section */}
                  <div className="members-section">
                    <h3>
                      {lang === 'ko' ? '함께할 친구들' : 'Your group'}
                    </h3>
                    <div className="members-grid">
                      {match.members.map((m) => {
                        const isMe = m.user_id === user.id;
                        return (
                          <a
                            key={m.user_id}
                            href={`/profile/${m.user_id}`}
                            className={`member-card ${isMe ? 'is-me' : ''}`}
                            style={{ textDecoration: 'none' }}
                          >
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
                                {isMe && (
                                  <span className="you-tag">
                                    {lang === 'ko' ? '나' : 'you'}
                                  </span>
                                )}
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

                  {/* Venue section */}
                  <div className="venue-section">
                    <h3>
                      {lang === 'ko' ? '만날 장소' : 'Where to meet'}
                    </h3>
                    <div className="venue-card">
                      {match.quest.venue.photo_urls?.[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={match.quest.venue.photo_urls[0]}
                          alt=""
                          className="venue-photo"
                        />
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
                  </div>

                  {/* Menu items (if any) */}
                  {match.quest.menu_items.length > 0 && (
                    <div className="menu-section">
                      <h3>
                        {lang === 'ko' ? '함께 시도할 메뉴' : 'What to try together'}
                      </h3>
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

                  <a
                    href={`/matches/${match.group_id}/chat`}
                    className="chat-open-btn"
                  >
                    💬 {lang === 'ko' ? '그룹 채팅 열기' : 'Open group chat'}
                    {match.unread_count > 0 && (
                      <span className="unread-badge">{match.unread_count}</span>
                    )}
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <style jsx>{`
        .v-nav { background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); position: sticky; top: 0; z-index: 10; backdrop-filter: blur(8px); }
        .v-nav-in { display: flex; align-items: center; justify-content: space-between; height: 68px; }
        .brand { display: flex; align-items: baseline; gap: 9px; font-family: var(--display); font-weight: 800; font-size: 20px; text-decoration: none; color: var(--ink); }
        .brand .ko-mark { font-family: 'Pretendard', 'Noto Sans KR', sans-serif; color: var(--ink-60); font-weight: 700; font-size: 17px; }
        .toggle { display: inline-flex; border: 1px solid var(--ink-12); border-radius: 999px; overflow: hidden; background: var(--paper-2); }
        .toggle button { border: 0; background: transparent; font-family: var(--body); font-weight: 600; font-size: 13px; padding: 7px 13px; cursor: pointer; color: var(--ink-60); }
        .toggle button[aria-pressed='true'] { background: var(--ink); color: var(--paper); }
        .main-wrap { padding: 32px 24px 80px; max-width: 900px; }
        .page-header { margin-bottom: 32px; }
        h1 { font-family: var(--display); font-weight: 800; font-size: 32px; margin: 0 0 4px; letter-spacing: -0.02em; }
        .sub { color: var(--ink-60); margin: 0; }
        .error-banner { background: rgba(255, 106, 61, 0.1); color: var(--persimmon); border: 1px solid rgba(255, 106, 61, 0.25); padding: 12px 16px; border-radius: 12px; margin-bottom: 16px; }
        .empty-state { text-align: center; padding: 80px 20px; background: var(--paper-2); border-radius: 24px; }
        .empty-icon { font-size: 64px; margin-bottom: 20px; }
        .empty-state h2 { font-family: var(--display); font-weight: 700; font-size: 24px; margin: 0 0 8px; }
        .empty-state p { color: var(--ink-60); font-size: 16px; margin: 0; max-width: 500px; margin-left: auto; margin-right: auto; }
        .matches-list { display: flex; flex-direction: column; gap: 20px; }
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
        .member-card { display: flex; gap: 10px; align-items: center; padding: 12px; background: var(--paper-2); border-radius: 12px; color: var(--ink); cursor: pointer; transition: transform 0.12s, box-shadow 0.12s; }
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
        .menu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
        .menu-tile { background: var(--paper-2); border-radius: 10px; padding: 8px; text-align: center; }
        .menu-photo { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; margin-bottom: 6px; }
        .menu-name { font-weight: 600; font-size: 12px; color: var(--ink); }
        .menu-price { font-size: 11px; color: var(--jade); font-weight: 700; margin-top: 2px; }
        .chat-open-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: var(--persimmon);
          color: #fff;
          padding: 14px 16px;
          border-radius: 12px;
          text-align: center;
          font-size: 15px;
          font-weight: 700;
          margin-top: 8px;
          text-decoration: none;
          transition: transform 0.12s, box-shadow 0.12s;
          position: relative;
        }
        .chat-open-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32);
        }
        .unread-badge {
          background: #fff;
          color: var(--persimmon);
          font-weight: 800;
          font-size: 13px;
          padding: 2px 10px;
          border-radius: 999px;
          min-width: 24px;
          text-align: center;
        }
        @media (max-width: 640px) {
          .match-card { padding: 20px; }
          .quest-title { font-size: 20px; }
          .venue-card { flex-direction: column; }
          .venue-photo { width: 100%; height: 180px; }
          .members-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}
