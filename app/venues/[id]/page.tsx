'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

type Venue = {
  id: string;
  business_name_display: string;
  business_name_legal: string;
  category: string;
  address: string;
  city: string;
  district: string | null;
  zipcode: string | null;
  road_address: string | null;
  jibun_address: string | null;
  building_name: string | null;
  address_detail: string | null;
  photo_urls: string[];
  description: string | null;
  description_en: string | null;
  per_person_cost_won: number | null;
  discount_offer: string | null;
  discount_offer_en: string | null;
  hours_json: Record<string, { closed: boolean; open?: string; close?: string }> | null;
  business_opened_at: string | null;
  is_active: boolean;
  hidden_gem_eligible: boolean;
};

type MenuItem = {
  id: string;
  name: string;
  name_en: string | null;
  description: string | null;
  price_won: number | null;
  photo_url: string | null;
  is_signature: boolean;
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

const WEEKDAYS: { code: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'; en: string; ko: string }[] = [
  { code: 'mon', en: 'Monday', ko: '월요일' },
  { code: 'tue', en: 'Tuesday', ko: '화요일' },
  { code: 'wed', en: 'Wednesday', ko: '수요일' },
  { code: 'thu', en: 'Thursday', ko: '목요일' },
  { code: 'fri', en: 'Friday', ko: '금요일' },
  { code: 'sat', en: 'Saturday', ko: '토요일' },
  { code: 'sun', en: 'Sunday', ko: '일요일' },
];

export default function VenueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [lang, setLang] = useState<'en' | 'ko'>('en');
  const [venue, setVenue] = useState<Venue | null>(null);
  const [venueStats, setVenueStats] = useState<any | null>(null);
  const [complimentTagsMap, setComplimentTagsMap] = useState<Record<string, any>>({});
  const [showAllTextReviews, setShowAllTextReviews] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<number>(0);

  const venueId = params?.id as string;

  useEffect(() => {
    document.body.setAttribute('data-lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    loadVenue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venueId]);

  useEffect(() => {
    if (!venue?.id) return;
    (async () => {
      const [statsRes, tagsRes] = await Promise.all([
        fetch(`/api/venue-stats/${venue.id}`).then((r) => r.json()),
        supabase.from('venue_compliment_tags').select('*').order('display_order'),
      ]);
      setVenueStats(statsRes);
      const map: Record<string, any> = {};
      (tagsRes.data ?? []).forEach((t: any) => { map[t.id] = t; });
      setComplimentTagsMap(map);
    })();
  }, [venue?.id]);

  async function loadVenue() {
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from('venues')
      .select('*')
      .eq('id', venueId)
      .eq('is_active', true)
      .is('deactivated_at', null)
      .maybeSingle();

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setError(lang === 'ko' ? '가게를 찾을 수 없습니다.' : 'Venue not found.');
      setLoading(false);
      return;
    }

    setVenue(data as Venue);

    if (data.category === 'cafe' || data.category === 'restaurant') {
      const { data: menuData } = await supabase
        .from('venue_menu_items')
        .select('*')
        .eq('venue_id', venueId)
        .eq('is_available', true)
        .order('is_signature', { ascending: false })
        .order('display_order');
      if (menuData) setMenuItems(menuData);
    }

    setLoading(false);
  }

  if (loading) {
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

  if (error || !venue) {
    return (
      <>
        <header className="v-nav">
          <div className="wrap v-nav-in">
            <a className="brand" href="/">Doreham <span className="ko-mark">도레함</span></a>
          </div>
        </header>
        <main className="wrap main-wrap">
          <div className="error-state">
            <div className="error-icon">🔍</div>
            <h2>{error ?? (lang === 'ko' ? '가게를 찾을 수 없습니다' : 'Venue not found')}</h2>
            <button onClick={() => router.back()} className="btn-primary">
              {lang === 'ko' ? '← 돌아가기' : '← Go back'}
            </button>
          </div>
        </main>
        <style jsx>{`
          .v-nav { background: rgba(245, 242, 235, 0.9); border-bottom: 1px solid var(--ink-12); }
          .v-nav-in { display: flex; align-items: center; height: 68px; }
          .brand { display: flex; align-items: baseline; gap: 9px; font-family: var(--display); font-weight: 800; font-size: 20px; text-decoration: none; color: var(--ink); }
          .ko-mark { color: var(--ink-60); font-weight: 700; font-size: 17px; }
          .main-wrap { padding: 60px 24px; max-width: 500px; }
          .error-state { text-align: center; padding: 60px 20px; background: var(--paper-2); border-radius: 24px; }
          .error-icon { font-size: 56px; margin-bottom: 20px; }
          .error-state h2 { font-family: var(--display); font-weight: 700; font-size: 24px; margin: 0 0 24px; }
          .btn-primary { background: var(--persimmon); color: #fff; border: 0; padding: 12px 24px; border-radius: 999px; font-weight: 700; font-size: 14px; cursor: pointer; }
        `}</style>
      </>
    );
  }

  const cat = CATEGORY_LABELS[venue.category];
  const description = lang === 'ko' ? venue.description : (venue.description_en ?? venue.description);
  const discount = lang === 'ko' ? venue.discount_offer : (venue.discount_offer_en ?? venue.discount_offer);
  const displayAddress = venue.road_address ?? venue.address;
  const fullAddressLine = [displayAddress, venue.address_detail, venue.building_name].filter(Boolean).join(' ');
  const yearsOpen = venue.business_opened_at
    ? Math.floor((Date.now() - new Date(venue.business_opened_at).getTime()) / (1000 * 60 * 60 * 24 * 365))
    : null;

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

      <main className="wrap main-wrap">
        <button onClick={() => router.back()} className="back-btn">
          {lang === 'ko' ? '← 돌아가기' : '← Back'}
        </button>

        {venue.photo_urls && venue.photo_urls.length > 0 && (
          <div className="gallery">
            <div className="main-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={venue.photo_urls[selectedPhoto]} alt={venue.business_name_display} />
            </div>
            {venue.photo_urls.length > 1 && (
              <div className="thumbs">
                {venue.photo_urls.map((url, i) => (
                  <button
                    key={i}
                    className={`thumb ${selectedPhoto === i ? 'active' : ''}`}
                    onClick={() => setSelectedPhoto(i)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="venue-header">
          <div className="header-main">
            <h1>{venue.business_name_display}</h1>
            <p className="category">
              {cat?.emoji} {cat ? (lang === 'ko' ? cat.ko : cat.en) : venue.category}
            </p>
          </div>
          <div className="badges">
            {venue.hidden_gem_eligible && (
              <span className="badge hidden-gem">
                {lang === 'ko' ? '✨ 숨은 명소' : '✨ Hidden Gem'}
              </span>
            )}
            {yearsOpen !== null && yearsOpen >= 5 && (
              <span className="badge established">
                {lang === 'ko' ? `⭐ ${yearsOpen}년째 운영` : `⭐ ${yearsOpen}+ years`}
              </span>
            )}
          </div>
        </div>

        <div className="section">
          <h3>{lang === 'ko' ? '위치' : 'Location'}</h3>
          <p className="location-text">📍 {fullAddressLine}</p>
          {venue.zipcode && <p className="location-sub">{venue.zipcode}</p>}
        </div>

        {description && (
          <div className="section">
            <h3>{lang === 'ko' ? '소개' : 'About'}</h3>
            <p className="description">{description}</p>
          </div>
        )}

        {discount && (
          <div className="section discount-section">
            <div className="discount-badge">
              {lang === 'ko' ? '🎁 도레함 혜택' : '🎁 Doreham perk'}
            </div>
            <p className="discount-text">{discount}</p>
          </div>
        )}

        {venue.hours_json && (
          <div className="section">
            <h3>{lang === 'ko' ? '영업 시간' : 'Hours'}</h3>
            <div className="hours-list">
              {WEEKDAYS.map((d) => {
                const dayHours = venue.hours_json![d.code];
                if (!dayHours) return null;
                return (
                  <div key={d.code} className={`hours-row ${dayHours.closed ? 'closed' : ''}`}>
                    <span className="day-name">{lang === 'ko' ? d.ko : d.en}</span>
                    <span className="day-time">
                      {dayHours.closed
                        ? (lang === 'ko' ? '휴무' : 'Closed')
                        : `${dayHours.open} — ${dayHours.close}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {venue.per_person_cost_won && (
          <div className="section">
            <h3>{lang === 'ko' ? '평균 비용' : 'Typical cost'}</h3>
            <p className="cost">
              ₩{venue.per_person_cost_won.toLocaleString()}
              <span className="cost-sub">{lang === 'ko' ? ' / 1인당' : ' per person'}</span>
            </p>
          </div>
        )}

        {menuItems.length > 0 && (
          <div className="section">
            <h3>{lang === 'ko' ? '메뉴' : 'Menu'}</h3>
            <div className="menu-grid">
              {menuItems.map((item) => (
                <div key={item.id} className="menu-item">
                  {item.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.photo_url} alt="" className="menu-photo" />
                  )}
                  <div className="menu-info">
                    <div className="menu-name">
                      {item.name}
                      {item.is_signature && <span className="signature">⭐</span>}
                    </div>
                    {item.name_en && lang === 'ko' && (
                      <div className="menu-name-en">{item.name_en}</div>
                    )}
                    {item.description && <p className="menu-desc">{item.description}</p>}
                    {item.price_won && (
                      <div className="menu-price">₩{item.price_won.toLocaleString()}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews section */}
        {venueStats && venueStats.review_count > 0 && (
          <div className="section">
            <div className="section-header-row">
              <h3>{lang === 'ko' ? '리뷰' : 'Reviews'}</h3>
              <span className="review-count-badge">
                {venueStats.review_count} {lang === 'ko' ? '개' : (venueStats.review_count === 1 ? 'review' : 'reviews')}
              </span>
            </div>

            {/* Compliment tags aggregate */}
            {Object.keys(venueStats.compliment_counts ?? {}).length > 0 && (
              <div className="review-block">
                <div className="review-block-title">
                  {lang === 'ko' ? '👍 좋았던 점' : '👍 What people loved'}
                </div>
                <div className="review-tags">
                  {Object.entries(venueStats.compliment_counts)
                    .sort(([, a]: any, [, b]: any) => b - a)
                    .map(([tagId, count]: any) => {
                      const tag = complimentTagsMap[tagId];
                      if (!tag) return null;
                      return (
                        <span key={tagId} className="review-tag compliment">
                          {tag.emoji} {lang === 'ko' ? tag.label_ko : tag.label_en}
                          <span className="tag-count">×{count}</span>
                        </span>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Text reviews */}
            {venueStats.recent_text_reviews.length > 0 && (
              <div className="review-block">
                <div className="review-block-title">
                  {lang === 'ko' ? '💬 후기' : '💬 What visitors said'}
                </div>
                <div className="text-reviews">
                  {venueStats.recent_text_reviews
                    .slice(0, showAllTextReviews ? undefined : 3)
                    .map((r: any, idx: number) => (
                      <div key={idx} className="text-review">
                        <p className="tr-text">&quot;{r.text}&quot;</p>
                        <div className="tr-date">
                          {new Date(r.submitted_at).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
                            year: 'numeric', month: 'short', day: 'numeric',
                          })}
                        </div>
                      </div>
                    ))}
                </div>
                {venueStats.recent_text_reviews.length > 3 && !showAllTextReviews && (
                  <button
                    className="show-more-btn"
                    onClick={() => setShowAllTextReviews(true)}
                  >
                    {lang === 'ko'
                      ? `+${venueStats.recent_text_reviews.length - 3}개 더 보기`
                      : `Show ${venueStats.recent_text_reviews.length - 3} more`}
                  </button>
                )}
              </div>
            )}
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
        .main-wrap { padding: 24px 24px 80px; max-width: 800px; }
        .back-btn { background: transparent; border: 0; color: var(--ink-60); font-family: var(--body); font-weight: 600; font-size: 14px; cursor: pointer; padding: 0 0 16px; }
        .back-btn:hover { color: var(--ink); }
        .gallery { margin-bottom: 24px; }
        .main-photo { width: 100%; aspect-ratio: 16 / 10; border-radius: 20px; overflow: hidden; background: var(--paper-2); }
        .main-photo img { width: 100%; height: 100%; object-fit: cover; }
        .thumbs { display: flex; gap: 8px; margin-top: 8px; overflow-x: auto; }
        .thumb { flex-shrink: 0; width: 80px; height: 80px; border: 2px solid transparent; border-radius: 12px; padding: 0; background: none; cursor: pointer; overflow: hidden; }
        .thumb.active { border-color: var(--persimmon); }
        .thumb img { width: 100%; height: 100%; object-fit: cover; }
        .venue-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 24px; flex-wrap: wrap; }
        .header-main h1 { font-family: var(--display); font-weight: 800; font-size: 36px; margin: 0 0 6px; letter-spacing: -0.02em; }
        .category { color: var(--ink-60); font-size: 16px; font-weight: 500; margin: 0; }
        .badges { display: flex; gap: 8px; flex-wrap: wrap; }
        .badge { padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; }
        .badge.hidden-gem { background: rgba(255, 106, 61, 0.12); color: var(--persimmon); }
        .badge.established { background: rgba(15, 157, 119, 0.12); color: var(--jade); }
        .section { background: #fff; border: 1px solid var(--ink-12); border-radius: 16px; padding: 20px 24px; margin-bottom: 12px; }
        .section h3 { font-family: var(--display); font-weight: 700; font-size: 14px; margin: 0 0 12px; color: var(--ink); text-transform: uppercase; letter-spacing: 0.08em; }
        .location-text { color: var(--ink); font-size: 15px; margin: 0; }
        .location-sub { color: var(--ink-60); font-size: 13px; margin: 4px 0 0; }
        .description { color: var(--ink); font-size: 15px; line-height: 1.6; margin: 0; white-space: pre-wrap; }
        .discount-section { background: linear-gradient(135deg, rgba(255, 106, 61, 0.05), rgba(15, 157, 119, 0.03)); border-color: rgba(255, 106, 61, 0.15); }
        .discount-badge { display: inline-block; background: var(--persimmon); color: #fff; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; margin-bottom: 10px; }
        .discount-text { color: var(--ink); font-weight: 500; font-size: 15px; margin: 0; }
        .hours-list { display: flex; flex-direction: column; gap: 6px; }
        .hours-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
        .hours-row .day-name { color: var(--ink); font-weight: 500; }
        .hours-row .day-time { color: var(--ink-60); font-family: var(--body); }
        .hours-row.closed .day-time { color: var(--ink-60); font-style: italic; }
        .cost { font-family: var(--display); font-weight: 800; font-size: 28px; color: var(--jade); margin: 0; }
        .cost-sub { font-family: var(--body); font-weight: 500; font-size: 14px; color: var(--ink-60); }
        .menu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
        .menu-item { display: flex; gap: 12px; padding: 12px; background: var(--paper-2); border-radius: 12px; }
        .menu-photo { width: 70px; height: 70px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
        .menu-info { flex: 1; min-width: 0; }
        .menu-name { font-weight: 700; font-size: 15px; color: var(--ink); display: flex; align-items: center; gap: 6px; }
        .signature { color: var(--persimmon); }
        .menu-name-en { color: var(--ink-60); font-size: 12px; margin-top: 2px; }
        .menu-desc { color: var(--ink-60); font-size: 12px; margin: 4px 0; line-height: 1.4; }
        .menu-price { color: var(--jade); font-weight: 700; font-size: 13px; margin-top: 4px; }
        .section-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .section-header-row h3 { margin: 0; }
        .review-count-badge { background: var(--persimmon); color: #fff; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 999px; }
        .review-block { margin-bottom: 20px; }
        .review-block:last-child { margin-bottom: 0; }
        .review-block-title { font-size: 12px; font-weight: 700; color: var(--ink-60); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px; }
        .review-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .review-tag { display: inline-flex; align-items: center; gap: 6px; background: var(--paper-2); border: 1px solid var(--ink-12); padding: 6px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--ink); }
        .review-tag.compliment { background: rgba(255, 106, 61, 0.08); border-color: rgba(255, 106, 61, 0.2); color: var(--persimmon); }
        .tag-count { background: rgba(0,0,0,0.05); padding: 1px 7px; border-radius: 999px; font-size: 11px; font-weight: 800; }
        .text-reviews { display: flex; flex-direction: column; gap: 10px; }
        .text-review { background: var(--paper-2); border-left: 3px solid var(--persimmon); border-radius: 8px; padding: 12px 14px; }
        .tr-text { margin: 0 0 6px; font-size: 14px; color: var(--ink); line-height: 1.5; font-style: italic; }
        .tr-date { font-size: 11px; color: var(--ink-60); font-weight: 500; }
        .show-more-btn { margin-top: 12px; background: transparent; border: 1px solid var(--ink-12); padding: 8px 16px; border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--ink-60); cursor: pointer; font-family: var(--body); }
        .show-more-btn:hover { border-color: var(--persimmon); color: var(--persimmon); }
        @media (max-width: 640px) {
          .header-main h1 { font-size: 28px; }
        }
      `}</style>
    </>
  );
}