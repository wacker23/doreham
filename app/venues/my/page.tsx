'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { useLang } from '@/lib/hooks/useLang';
import { supabase } from '@/lib/supabase/client';
import { AppHeader } from '@/components/AppHeader';
import { AppTabBar } from '@/components/AppTabBar';
import { VenuePerksManager } from '@/components/VenuePerksManager';
import { Icon } from '@/components/icons/Icon';
import { CategoryIcon } from '@/components/icons/CategoryIcon';
import { reviewTagIcon, venueCategoryArt } from '@/lib/icons';

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

const CATEGORY_LABELS: Record<string, { en: string; ko: string }> = {
  cafe:              { en: 'Café', ko: '카페' },
  restaurant:        { en: 'Restaurant', ko: '식당' },
  board_game_cafe:   { en: 'Board game café', ko: '보드게임 카페' },
  escape_room:       { en: 'Escape room', ko: '방탈출' },
  bookshop:          { en: 'Bookshop', ko: '서점' },
  workshop_creative: { en: 'Workshop', ko: '원데이 클래스' },
  active_sports:     { en: 'Sports', ko: '스포츠' },
  cultural_venue:    { en: 'Cultural venue', ko: '문화 공간' },
  nature_outdoor:    { en: 'Nature', ko: '자연' },
  music_movie:       { en: 'Music/Movie', ko: '음악·영화' },
  bar_club:          { en: 'Bar / Club', ko: '바·클럽' },
  other:             { en: 'Other', ko: '기타' },
};

export default function MyVenuesPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [lang, setLang] = useLang();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueStats, setVenueStats] = useState<Record<string, any>>({});
  const [complimentTagsMap, setComplimentTagsMap] = useState<Record<string, any>>({});
  const [loadingVenues, setLoadingVenues] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/sign-in?as=venue');
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
      .is('deactivated_at', null)
      .order('created_at', { ascending: false });

    if (err) {
      setError(err.message);
      setLoadingVenues(false);
      return;
    }
    setVenues(data ?? []);
    setLoadingVenues(false);
  }

  useEffect(() => {
    if (venues.length === 0) return;
    (async () => {
      const { data: tags } = await supabase.from('venue_compliment_tags').select('*').order('display_order');
      const tagMap: Record<string, any> = {};
      (tags ?? []).forEach((t: any) => { tagMap[t.id] = t; });
      setComplimentTagsMap(tagMap);

      const statsResults: Record<string, any> = {};
      await Promise.all(
        venues.filter((v) => v.is_active).map(async (v) => {
          try {
            const resp = await fetch(`/api/venue-stats/${v.id}`);
            statsResults[v.id] = await resp.json();
          } catch (e) {
            console.error('Failed to load stats for', v.id, e);
          }
        })
      );
      setVenueStats(statsResults);
    })();
  }, [venues]);

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

  async function removeVenue(venue: Venue) {
    const ok = confirm(
      lang === 'ko'
        ? `"${venue.business_name_display}"을(를) 도레함에서 삭제할까요?\n\n가게 페이지, 사진, 메뉴, 혜택이 사라지고 예정된 가게 이벤트는 취소돼요. 되돌릴 수 없어요.`
        : `Delete "${venue.business_name_display}" from Doreham?\n\nIts page, photos, menu and perks are removed and upcoming venue events are cancelled. This can't be undone.`,
    );
    if (!ok) return;
    setDeleting(venue.id);
    setError(null);
    const r = await fetch(`/api/venues/${venue.id}`, { method: 'DELETE' });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(lang === 'ko' ? `삭제하지 못했어요 (${j.error ?? r.status})` : `Couldn't delete (${j.error ?? r.status})`);
    }
    setDeleting(null);
    await loadMyVenues();
  }

  const pendingCount = venues.filter((v) => !v.is_active).length;
  const approvedCount = venues.filter((v) => v.is_active).length;

  return (
    <>
      <AppHeader lang={lang} setLang={setLang} />

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
            <div className="empty-icon"><CategoryIcon art="venue" size={96} /></div>
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
                        <div className="v-photo-placeholder"><CategoryIcon art={venueCategoryArt(venue.category)} size={72} /></div>
                      )}
                      <div className="v-info">
                        <div className="v-name-row">
                          <h2>{venue.business_name_display}</h2>
                          <span className={`status-badge ${venue.is_active ? 'approved' : 'pending'}`}>
                            {venue.is_active
                              ? <><Icon name="done" size={14} /> {lang === 'ko' ? '승인됨' : 'Approved'}</>
                              : <><Icon name="pending" size={14} /> {lang === 'ko' ? '검토 중' : 'Pending review'}</>}
                          </span>
                        </div>
                        <p className="v-meta">
                          <CategoryIcon art={venueCategoryArt(venue.category)} size={18} /> {cat ? (lang === 'ko' ? cat.ko : cat.en) : venue.category}
                          {' · '}{venue.city}
                          {venue.district && ` · ${venue.district}`}
                        </p>
                        {venue.address && <p className="v-address">{venue.address}</p>}
                      </div>
                    </div>

                    <div className="v-manage">
                      <a href={`/venues/my/${venue.id}/edit`} className="v-manage-btn">
                        <Icon name="edit" size={16} /> {lang === 'ko' ? '정보 수정' : 'Edit info'}
                      </a>
                      <button
                        type="button"
                        className="v-manage-btn danger"
                        onClick={() => removeVenue(venue)}
                        disabled={deleting === venue.id}
                      >
                        <Icon name="trash" size={16} /> {deleting === venue.id ? (lang === 'ko' ? '삭제 중…' : 'Deleting…') : lang === 'ko' ? '삭제' : 'Delete'}
                      </button>
                    </div>

                    {venue.is_active ? (
                      <div className="v-active-section">
                        <div className="v-active-header"><Icon name="stats" size={18} /> {lang === 'ko' ? '활동' : 'Activity'}</div>
                        <div className="v-stats-grid">
                          <div className="v-stat">
                            <div className="stat-label">{lang === 'ko' ? '이번 주 방문' : 'Visits this week'}</div>
                            <div className="stat-value">
                              {venueStats[venue.id]?.visits_this_week ?? '—'}
                            </div>
                          </div>
                          <div className="v-stat">
                            <div className="stat-label">{lang === 'ko' ? '예정된 그룹' : 'Upcoming groups'}</div>
                            <div className="stat-value">
                              {venueStats[venue.id]?.upcoming_groups ?? '—'}
                            </div>
                          </div>
                          <div className="v-stat">
                            <div className="stat-label">{lang === 'ko' ? '총 방문자' : 'Total visitors'}</div>
                            <div className="stat-value">
                              {venueStats[venue.id]?.total_visitors ?? '—'}
                            </div>
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
                        <div className="v-actions">
                          <a href={`/venues/my/${venue.id}/qr`} className="v-action-qr">
                            <Icon name="qr" size={18} tone="light" /> {lang === 'ko' ? '오늘의 QR 코드' : "Today's QR code"}
                          </a>
                          <a href={`/events/new?venue=${venue.id}`} className="v-action-event">
                            <Icon name="events" size={18} /> {lang === 'ko' ? '이 가게에서 이벤트 열기' : 'Host an event here'}
                          </a>
                        </div>
                        <VenuePerksManager venueId={venue.id} lang={lang} />
                        {venueStats[venue.id] && venueStats[venue.id].review_count > 0 && (
                          <div className="v-reviews-section">
                            <div className="v-reviews-header">
                              <Icon name="chat" size={18} /> {lang === 'ko' ? '리뷰' : 'Reviews'}
                              <span className="v-review-count">
                                {venueStats[venue.id].review_count}
                              </span>
                            </div>

                            {/* Compliment tags */}
                            {Object.keys(venueStats[venue.id].compliment_counts ?? {}).length > 0 && (
                              <div className="v-review-tags">
                                {Object.entries(venueStats[venue.id].compliment_counts)
                                  .sort(([, a]: any, [, b]: any) => b - a)
                                  .slice(0, 6)
                                  .map(([tagId, count]: any) => {
                                    const tag = complimentTagsMap[tagId];
                                    if (!tag) return null;
                                    return (
                                      <span key={tagId} className="v-review-tag">
                                        <Icon name={reviewTagIcon(tagId)} size={15} /> {lang === 'ko' ? tag.label_ko : tag.label_en}
                                        <span className="v-tag-count">×{count}</span>
                                      </span>
                                    );
                                  })}
                              </div>
                            )}

                            {/* Private concerns count (owner only) */}
                            {Object.keys(venueStats[venue.id].concern_counts ?? {}).length > 0 && (
                              <div className="v-concerns-note">
                                <Icon name="lock" size={15} /> {lang === 'ko'
                                  ? `${Object.values(venueStats[venue.id].concern_counts).reduce((a: any, b: any) => a + b, 0)}건의 개선 제안 (비공개)`
                                  : `${Object.values(venueStats[venue.id].concern_counts).reduce((a: any, b: any) => a + b, 0)} improvement suggestions (private)`}
                              </div>
                            )}

                            {/* Recent text reviews */}
                            {venueStats[venue.id].recent_text_reviews.length > 0 && (
                              <div className="v-text-reviews">
                                {venueStats[venue.id].recent_text_reviews.slice(0, 3).map((r: any, i: number) => (
                                  <div key={i} className="v-text-review">
                                    <p>&quot;{r.text}&quot;</p>
                                    <div className="v-text-date">
                                      {new Date(r.submitted_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
                                        month: 'short', day: 'numeric',
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
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

      <AppTabBar lang={lang} />

      <style jsx>{`
        .main-wrap { padding: 32px 24px 96px; max-width: 900px; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 24px; flex-wrap: wrap; }
        h1 { font-family: var(--display); font-weight: 800; font-size: 32px; margin: 0 0 4px; letter-spacing: -0.02em; }
        .sub { color: var(--ink-60); margin: 0; }
        .btn-primary { background: var(--persimmon); color: #fff; border: 0; padding: 12px 22px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 14px; cursor: pointer; text-decoration: none; display: inline-block; transition: transform 0.12s, box-shadow 0.12s; }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .btn-lg { padding: 14px 32px; font-size: 15px; }
        .error-banner { background: rgba(255, 106, 61, 0.1); color: var(--persimmon); border: 1px solid rgba(255, 106, 61, 0.25); padding: 12px 16px; border-radius: 12px; margin-bottom: 16px; }
        .empty-state { text-align: center; padding: 80px 20px; background: var(--paper-2); border-radius: 24px; }
        .empty-icon { display: flex; justify-content: center; margin-bottom: 20px; }
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
        .v-photo-placeholder { width: 100px; height: 100px; border-radius: 12px; background: var(--paper-2); display: grid; place-items: center; flex-shrink: 0; }
        .v-info { flex: 1; min-width: 0; }
        .v-name-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 6px; }
        .v-info h2 { font-family: var(--display); font-weight: 700; font-size: 20px; margin: 0; color: var(--ink); }
        .status-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; letter-spacing: 0.02em; }
        .status-badge.pending { background: rgba(255, 165, 0, 0.15); color: #B8620A; }
        .status-badge.approved { background: rgba(15, 157, 119, 0.15); color: var(--jade); }
        .v-meta { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; color: var(--ink-60); font-size: 14px; margin: 0 0 4px; }
        .v-address { color: var(--ink-60); font-size: 13px; margin: 0; line-height: 1.4; }
        .v-active-section { padding: 16px 20px 20px; border-top: 1px solid var(--ink-12); background: rgba(15, 157, 119, 0.02); }
        .v-active-header { display: flex; align-items: center; gap: 6px; font-family: var(--display); font-weight: 700; font-size: 14px; margin-bottom: 12px; color: var(--ink); }
        .v-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 14px; }
        .v-stat { background: #fff; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--ink-12); }
        .stat-label { font-size: 11px; color: var(--ink-60); font-weight: 500; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
        .stat-value { font-family: var(--display); font-weight: 700; font-size: 20px; color: var(--ink); }
        .stat-value.dim { color: var(--ink-60); font-size: 13px; font-weight: 500; font-family: var(--body); }
        .v-approved-note { font-size: 12px; color: var(--ink-60); font-weight: 500; margin-bottom: 8px; }
        .v-preview-note { font-size: 13px; color: var(--jade); background: rgba(15, 157, 119, 0.08); padding: 8px 12px; border-radius: 8px; }
        .v-actions { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
        .v-manage { display: flex; gap: 8px; flex-wrap: wrap; padding: 0 20px 16px; margin-top: -4px; }
        .v-manage-btn { display: inline-flex; align-items: center; gap: 6px; background: #fff; color: var(--ink); border: 1px solid var(--ink-12); padding: 8px 14px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 13px; text-decoration: none; cursor: pointer; }
        .v-manage-btn:hover { border-color: var(--ink-60); }
        .v-manage-btn.danger { color: var(--persimmon); border-color: rgba(255, 106, 61, 0.35); }
        .v-manage-btn:disabled { opacity: 0.6; cursor: default; }
        .v-action-qr { display: inline-flex; align-items: center; gap: 8px; background: var(--persimmon); color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 999px; font-weight: 700; font-size: 14px; transition: transform 0.15s; }
        .v-action-qr:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .v-action-event { display: inline-flex; align-items: center; gap: 8px; background: #fff; color: var(--ink); border: 1px solid var(--ink-12); text-decoration: none; padding: 10px 18px; border-radius: 999px; font-weight: 700; font-size: 14px; }
        .v-action-event:hover { border-color: var(--ink-60); }
        .v-reviews-section { background: #fff; border: 1px solid var(--ink-12); border-radius: 12px; padding: 16px; margin-top: 12px; }
        .v-reviews-header { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: var(--ink); margin-bottom: 12px; }
        .v-review-count { background: var(--persimmon); color: #fff; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 999px; }
        .v-review-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
        .v-review-tag { display: inline-flex; align-items: center; gap: 5px; background: rgba(255, 106, 61, 0.08); border: 1px solid rgba(255, 106, 61, 0.2); color: var(--persimmon); padding: 5px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
        .v-tag-count { background: rgba(255, 106, 61, 0.15); padding: 1px 6px; border-radius: 999px; font-size: 10px; font-weight: 800; }
        .v-concerns-note { font-size: 12px; color: #a86720; background: rgba(232, 169, 63, 0.1); padding: 6px 10px; border-radius: 8px; margin-bottom: 10px; }
        .v-text-reviews { display: flex; flex-direction: column; gap: 8px; }
        .v-text-review { background: var(--paper-2); border-left: 2px solid var(--persimmon); padding: 8px 12px; border-radius: 6px; }
        .v-text-review p { margin: 0 0 4px; font-size: 13px; color: var(--ink); font-style: italic; line-height: 1.4; }
        .v-text-date { font-size: 10px; color: var(--ink-60); font-weight: 500; }
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