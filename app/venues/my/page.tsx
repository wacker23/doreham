'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { supabase } from '@/lib/supabase/client';

type Venue = {
  id: string;
  business_name_display: string;
  business_name_legal: string;
  category: string;
  address: string;
  city: string;
  district: string | null;
  photo_urls: string[];
  is_active: boolean;
  claim_verified_at: string | null;
  created_at: string;
  updated_at: string;
  per_person_cost_won: number | null;
  discount_offer: string | null;
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

export default function MyVenuesPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [lang, setLang] = useState<'en' | 'ko'>('en');
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.setAttribute('data-lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/sign-in?return=/venues/my');
      return;
    }
    loadMyVenues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, router]);

  async function loadMyVenues() {
    setLoadingVenues(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('venues')
      .select('*')
      .eq('owner_id', user!.id)
      .order('created_at', { ascending: false });

    if (err) {
      setError(err.message);
      setLoadingVenues(false);
      return;
    }
    setVenues(data ?? []);
    setLoadingVenues(false);
  }

  if (loading || loadingVenues) {
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

  const pendingCount = venues.filter((v) => !v.is_active).length;
  const approvedCount = venues.filter((v) => v.is_active).length;

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
          <div>
            <h1>{lang === 'ko' ? '내 가게' : 'My venues'}</h1>
            <p className="sub">
              {lang === 'ko' ? '등록한 가게를 관리하고 상태를 확인하세요.' : 'Manage your registered venues.'}
            </p>
          </div>
          {venues.length > 0 && (
            <a href="/venues" className="btn-primary">
              {lang === 'ko' ? '+ 가게 추가' : '+ Register another'}
            </a>
          )}
        </div>

        {error && <div className="error-banner">{error}</div>}

        {venues.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏪</div>
            <h2>{lang === 'ko' ? '아직 등록된 가게가 없어요' : 'No venues registered yet'}</h2>
            <p>
              {lang === 'ko' ? '가게를 등록하고 도레함 커뮤니티와 연결되세요.' : 'Register your venue and connect with the Doreham community.'}
            </p>
            <a href="/venues" className="btn-primary btn-lg">
              {lang === 'ko' ? '내 가게 등록하기' : 'Register your venue'}
            </a>
          </div>
        ) : (
          <>
            <div className="stat-bar">
              {pendingCount > 0 && (
                <div className="stat">
                  <span className="stat-dot pending" />
                  <span>{lang === 'ko' ? `검토 중 ${pendingCount}개` : `${pendingCount} pending`}</span>
                </div>
              )}
              {approvedCount > 0 && (
                <div className="stat">
                  <span className="stat-dot approved" />
                  <span>{lang === 'ko' ? `승인됨 ${approvedCount}개` : `${approvedCount} approved`}</span>
                </div>
              )}
            </div>

            <div className="venues-list">
              {venues.map((venue) => {
                const cat = CATEGORY_LABELS[venue.category];
                return (
                  <div key={venue.id} className={`venue-card ${venue.is_active ? 'approved' : 'pending'}`}>
                    <div className="v-card-top">
                      {venue.photo_urls?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={venue.photo_urls[0]} alt={venue.business_name_display} className="v-photo" />
                      ) : (
                        <div className="v-photo-placeholder">{cat?.emoji ?? '🏪'}</div>
                      )}
                      <div className="v-info">
                        <div className="v-name-row">
                          <h2>{venue.business_name_display}</h2>
                          <span className={`status-badge ${venue.is_active ? 'approved' : 'pending'}`}>
                            {venue.is_active
                              ? (lang === 'ko' ? '✓ 승인됨' : '✓ Approved')
                              : (lang === 'ko' ? '⏳ 검토 중' : '⏳ Pending review')}
                          </span>
                        </div>
                        <p className="v-meta">
                          {cat?.emoji} {cat ? (lang === 'ko' ? cat.ko : cat.en) : venue.category}
                          {' · '}{venue.city}
                          {venue.district && ` · ${venue.district}`}
                        </p>
                        {venue.address && <p className="v-address">{venue.address}</p>}
                      </div>
                    </div>

                    {venue.is_active ? (
                      <div className="v-active-section">
                        <div className="v-active-header">{lang === 'ko' ? '📊 활동' : '📊 Activity'}</div>
                        <div className="v-stats-grid">
                          <div className="v-stat">
                            <div className="stat-label">{lang === 'ko' ? '이번 주 방문' : 'Visits this week'}</div>
                            <div className="stat-value dim">{lang === 'ko' ? '준비 중' : 'Coming soon'}</div>
                          </div>
                          <div className="v-stat">
                            <div className="stat-label">{lang === 'ko' ? '예정된 그룹' : 'Upcoming groups'}</div>
                            <div className="stat-value dim">{lang === 'ko' ? '준비 중' : 'Coming soon'}</div>
                          </div>
                          <div className="v-stat">
                            <div className="stat-label">{lang === 'ko' ? '총 방문자' : 'Total visitors'}</div>
                            <div className="stat-value dim">{lang === 'ko' ? '준비 중' : 'Coming soon'}</div>
                          </div>
                          <div className="v-stat">
                            <div className="stat-label">{lang === 'ko' ? '평균 평점' : 'Average rating'}</div>
                            <div className="stat-value dim">{lang === 'ko' ? '준비 중' : 'Coming soon'}</div>
                          </div>
                        </div>
                        <div className="v-approved-note">
                          {lang === 'ko'
                            ? `승인일: ${venue.claim_verified_at ? new Date(venue.claim_verified_at).toLocaleDateString('ko-KR') : '—'}`
                            : `Approved on ${venue.claim_verified_at ? new Date(venue.claim_verified_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}`}
                        </div>
                        <div className="v-preview-note">
                          {lang === 'ko'
                            ? '💡 매칭 시스템이 곧 오픈됩니다. 곧 그룹 방문이 시작될 예정입니다.'
                            : '💡 The matching system is launching soon.'}
                        </div>
                      </div>
                    ) : (
                      <div className="v-pending-section">
                        <p>
                          {lang === 'ko'
                            ? '도레함 팀이 검토 중입니다. 48시간 이내로 결과를 이메일로 알려드립니다.'
                            : "Our team is reviewing your submission. We'll email you within 48 hours."}
                        </p>
                        <p className="submitted-time">
                          {lang === 'ko'
                            ? `제출: ${new Date(venue.created_at).toLocaleString('ko-KR')}`
                            : `Submitted: ${new Date(venue.created_at).toLocaleString('en-US')}`}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
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
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 24px; flex-wrap: wrap; }
        h1 { font-family: var(--display); font-weight: 800; font-size: 32px; margin: 0 0 4px; letter-spacing: -0.02em; }
        .sub { color: var(--ink-60); margin: 0; }
        .btn-primary { background: var(--persimmon); color: #fff; border: 0; padding: 12px 22px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 14px; cursor: pointer; text-decoration: none; display: inline-block; transition: transform 0.12s, box-shadow 0.12s; }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .btn-lg { padding: 14px 32px; font-size: 15px; }
        .error-banner { background: rgba(255, 106, 61, 0.1); color: var(--persimmon); border: 1px solid rgba(255, 106, 61, 0.25); padding: 12px 16px; border-radius: 12px; margin-bottom: 16px; }
        .empty-state { text-align: center; padding: 80px 20px; background: var(--paper-2); border-radius: 24px; }
        .empty-icon { font-size: 64px; margin-bottom: 20px; }
        .empty-state h2 { font-family: var(--display); font-weight: 700; font-size: 24px; margin: 0 0 8px; color: var(--ink); }
        .empty-state p { color: var(--ink-60); font-size: 16px; margin: 0 0 32px; max-width: 400px; margin-left: auto; margin-right: auto; }
        .stat-bar { display: flex; gap: 24px; padding: 12px 20px; background: var(--paper-2); border-radius: 12px; margin-bottom: 20px; font-size: 14px; color: var(--ink-60); }
        .stat { display: flex; align-items: center; gap: 8px; font-weight: 600; }
        .stat-dot { width: 8px; height: 8px; border-radius: 50%; }
        .stat-dot.pending { background: #FFA500; }
        .stat-dot.approved { background: var(--jade); }
        .venues-list { display: flex; flex-direction: column; gap: 16px; }
        .venue-card { background: #fff; border: 1px solid var(--ink-12); border-radius: 16px; overflow: hidden; transition: box-shadow 0.15s; }
        .venue-card.approved { border-color: rgba(15, 157, 119, 0.25); }
        .venue-card:hover { box-shadow: 0 4px 20px rgba(30, 34, 48, 0.06); }
        .v-card-top { display: flex; gap: 16px; padding: 20px; }
        .v-photo { width: 100px; height: 100px; border-radius: 12px; object-fit: cover; flex-shrink: 0; }
        .v-photo-placeholder { width: 100px; height: 100px; border-radius: 12px; background: var(--paper-2); display: grid; place-items: center; font-size: 40px; flex-shrink: 0; }
        .v-info { flex: 1; min-width: 0; }
        .v-name-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 6px; }
        .v-info h2 { font-family: var(--display); font-weight: 700; font-size: 20px; margin: 0; color: var(--ink); }
        .status-badge { padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: 0.02em; }
        .status-badge.pending { background: rgba(255, 165, 0, 0.15); color: #B8620A; }
        .status-badge.approved { background: rgba(15, 157, 119, 0.15); color: var(--jade); }
        .v-meta { color: var(--ink-60); font-size: 14px; margin: 0 0 4px; }
        .v-address { color: var(--ink-60); font-size: 13px; margin: 0; line-height: 1.4; }
        .v-active-section { padding: 16px 20px 20px; border-top: 1px solid var(--ink-12); background: rgba(15, 157, 119, 0.02); }
        .v-active-header { font-family: var(--display); font-weight: 700; font-size: 14px; margin-bottom: 12px; color: var(--ink); }
        .v-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 14px; }
        .v-stat { background: #fff; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--ink-12); }
        .stat-label { font-size: 11px; color: var(--ink-60); font-weight: 500; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
        .stat-value { font-family: var(--display); font-weight: 700; font-size: 20px; color: var(--ink); }
        .stat-value.dim { color: var(--ink-60); font-size: 13px; font-weight: 500; font-family: var(--body); }
        .v-approved-note { font-size: 12px; color: var(--ink-60); font-weight: 500; margin-bottom: 8px; }
        .v-preview-note { font-size: 13px; color: var(--jade); background: rgba(15, 157, 119, 0.08); padding: 8px 12px; border-radius: 8px; }
        .v-pending-section { padding: 16px 20px 20px; border-top: 1px solid var(--ink-12); background: rgba(255, 165, 0, 0.03); }
        .v-pending-section p { color: var(--ink-60); font-size: 14px; line-height: 1.5; margin: 0 0 8px; }
        .submitted-time { font-size: 12px; color: var(--ink-60); }
        @media (max-width: 640px) {
          .v-stats-grid { grid-template-columns: repeat(2, 1fr); }
          .v-card-top { flex-direction: column; }
          .v-photo, .v-photo-placeholder { width: 100%; height: 160px; }
        }
      `}</style>
    </>
  );
}