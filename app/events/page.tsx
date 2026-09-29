'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { useLang } from '@/lib/hooks/useLang';
import { AppHeader } from '@/components/AppHeader';
import { AppTabBar } from '@/components/AppTabBar';
import { KOREAN_CITIES, cityName } from '@/lib/cities';
import { EVENT_CATEGORIES, eventCategory } from '@/lib/eventCategories';
import { dayLabel, eventText, kstParts, toKstInputs } from '@/lib/eventDisplay';
import { initials, type FeedEvent, type HostContext } from '@/lib/eventTypes';
import { levelByNumber } from '@/lib/points';

type Scope = 'upcoming' | 'mine';
const CITY_KEY = 'doreham_events_city';

export default function EventsPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [lang, setLang] = useLang();
  const [scope, setScope] = useState<Scope>('upcoming');
  const [city, setCity] = useState<string | null>(null); // null = not decided yet, '' = all cities
  const [category, setCategory] = useState('');
  const [events, setEvents] = useState<FeedEvent[] | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push('/sign-in?return=/events');
  }, [loading, user, router]);

  // Starting city: the one picked last time, else the viewer's home city, else all cities.
  useEffect(() => {
    if (!user || city !== null) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(CITY_KEY);
    } catch {
      /* private mode */
    }
    if (saved !== null && (saved === '' || KOREAN_CITIES.some((c) => c.slug === saved))) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the browser after sign-in
      setCity(saved);
      return;
    }
    fetch('/api/events/host-context')
      .then((r) => (r.ok ? r.json() : null))
      .then((ctx: HostContext | null) => {
        const home = (ctx?.homeDistrict ?? '').toLowerCase();
        setCity(KOREAN_CITIES.some((c) => c.slug === home) ? home : '');
      })
      .catch(() => setCity(''));
  }, [user, city]);

  useEffect(() => {
    if (!user || city === null) return;
    let cancelled = false;
    const qs = new URLSearchParams({ scope });
    if (city && scope === 'upcoming') qs.set('city', city);
    if (category && scope === 'upcoming') qs.set('category', category);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the skeleton while the new filter loads
    setEvents(null);
    setError('');
    fetch(`/api/events?${qs}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) throw new Error(j.error || 'load_failed');
        setLoadedAt(Date.now());
        setEvents(j.events ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setEvents([]);
          setError(lang === 'ko' ? '이벤트를 불러오지 못했어요.' : "Couldn't load events.");
        }
      });
    return () => {
      cancelled = true;
    };
    // lang only changes the error text; no refetch needed for it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, city, category, scope]);

  function pickCity(slug: string) {
    setCity(slug);
    try {
      localStorage.setItem(CITY_KEY, slug);
    } catch {
      /* private mode */
    }
  }

  // Featured on top, then grouped by day (Korea time). "Mine" splits into coming up and past.
  const sections = useMemo(() => {
    if (!events) return [];
    const out: { key: string; title: string; items: FeedEvent[] }[] = [];
    const push = (key: string, title: string, e: FeedEvent) => {
      let s = out.find((x) => x.key === key);
      if (!s) out.push((s = { key, title, items: [] }));
      s.items.push(e);
    };
    if (scope === 'upcoming') {
      for (const e of events) {
        if (e.is_featured) push('featured', lang === 'ko' ? '⭐ 도레함 추천' : '⭐ Featured', e);
        else push(toKstInputs(e.starts_at).date, dayLabel(e.starts_at, lang), e);
      }
    } else {
      const cutoff = loadedAt - 2 * 3_600_000;
      const upcoming = events.filter((e) => new Date(e.starts_at).getTime() >= cutoff).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      const past = events.filter((e) => new Date(e.starts_at).getTime() < cutoff);
      for (const e of upcoming) push('mine-up', lang === 'ko' ? '다가오는 이벤트' : 'Coming up', e);
      for (const e of past) push('mine-past', lang === 'ko' ? '지난 이벤트' : 'Past', e);
    }
    return out;
  }, [events, scope, lang, loadedAt]);

  if (loading || !user) {
    return (
      <main className="ev-loading">
        <div className="ev-loader" />
        <style jsx>{`
          .ev-loading { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
          .ev-loader { width: 40px; height: 40px; border: 3px solid var(--ink-12); border-top-color: var(--persimmon); border-radius: 50%; animation: spin 0.8s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </main>
    );
  }

  const ko = lang === 'ko';

  return (
    <>
      <AppHeader lang={lang} setLang={setLang} />

      <main className="app-page ev-page">
        <div className="ev-head">
          <div className="ev-title">
            <h1>{ko ? '이벤트' : 'Events'}</h1>
            <p className="ev-sub">
              {ko
                ? '근처 사람들과 가게가 여는 모임, 언어 교환, 나들이를 찾아보세요.'
                : 'Meetups, language exchanges and nights out, posted by people and places near you.'}
            </p>
          </div>
          <a className="ev-host-btn" href="/events/new">
            + {ko ? '이벤트 열기' : 'Host an event'}
          </a>
        </div>

        <div className="ev-toolbar">
          <div className="ev-scope" role="tablist">
            <button role="tab" aria-selected={scope === 'upcoming'} className={scope === 'upcoming' ? 'on' : ''} onClick={() => setScope('upcoming')}>
              {ko ? '둘러보기' : 'Explore'}
            </button>
            <button role="tab" aria-selected={scope === 'mine'} className={scope === 'mine' ? 'on' : ''} onClick={() => setScope('mine')}>
              {ko ? '내 이벤트' : 'My events'}
            </button>
          </div>
          {scope === 'upcoming' && (
            <label className="ev-city">
              <span className="sr-only">{ko ? '도시' : 'City'}</span>
              <select value={city ?? ''} onChange={(e) => pickCity(e.target.value)}>
                <option value="">{ko ? '🇰🇷 전체 도시' : '🇰🇷 All cities'}</option>
                {KOREAN_CITIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.emoji} {ko ? c.name_ko : c.name_en}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {scope === 'upcoming' && (
          <div className="ev-chips" role="group" aria-label={ko ? '카테고리' : 'Category'}>
            <button className={category === '' ? 'on' : ''} aria-pressed={category === ''} onClick={() => setCategory('')}>
              {ko ? '전체' : 'All'}
            </button>
            {EVENT_CATEGORIES.map((c) => (
              <button key={c.slug} className={category === c.slug ? 'on' : ''} aria-pressed={category === c.slug} onClick={() => setCategory(c.slug)}>
                <span aria-hidden="true">{c.emoji}</span> {ko ? c.label_ko : c.label_en}
              </button>
            ))}
          </div>
        )}

        {error && <p className="ev-error">{error}</p>}

        {events === null ? (
          <div className="ev-grid" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="ev-skel" />
            ))}
          </div>
        ) : events.length === 0 && !error ? (
          <div className="ev-empty">
            <div className="ev-empty-icon" aria-hidden="true">{scope === 'mine' ? '🗓️' : '🎈'}</div>
            <h2>
              {scope === 'mine'
                ? ko ? '아직 참여한 이벤트가 없어요' : 'No events yet'
                : ko ? `${city ? cityName(city, 'ko') + '에 ' : ''}예정된 이벤트가 없어요` : `Nothing planned${city ? ' in ' + cityName(city, 'en') : ''} yet`}
            </h2>
            <p>
              {scope === 'mine'
                ? ko ? '마음에 드는 이벤트에 참여하거나 직접 열어 보세요.' : 'Join an event you like, or host your own.'
                : ko ? '첫 번째 이벤트를 열어 보세요. 커피 한 잔, 산책, 언어 교환 무엇이든 좋아요.' : 'Be the first to host one. Coffee, a walk, a language exchange: anything works.'}
            </p>
            <a className="ev-cta" href="/events/new">{ko ? '+ 이벤트 열기' : '+ Host an event'}</a>
          </div>
        ) : (
          sections.map((s) => (
            <div key={s.key} className="ev-section">
              <h2 className="ev-day">{s.title}</h2>
              <div className="ev-grid">
                {s.items.map((e) => (
                  <EventCard key={e.id} e={e} lang={lang} now={loadedAt} showCity={!city || scope === 'mine'} />
                ))}
              </div>
            </div>
          ))
        )}

        <a className="ev-fab" href="/events/new" aria-label={ko ? '이벤트 열기' : 'Host an event'}>
          <span aria-hidden="true">+</span> {ko ? '이벤트 열기' : 'Host'}
        </a>
      </main>

      <AppTabBar lang={lang} />

      <style jsx>{`
        .ev-page { min-height: 70vh; }
        .ev-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 16px; }
        h1 { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 4px; line-height: 1.15; }
        .ev-sub { color: var(--ink-60); font-size: 14.5px; line-height: 1.5; margin: 0; max-width: 520px; }
        .ev-host-btn { display: none; flex-shrink: 0; background: var(--persimmon); color: #fff; font-weight: 800; font-size: 15px; padding: 11px 20px; border-radius: 999px; text-decoration: none; box-shadow: 0 8px 20px rgba(255, 106, 61, 0.25); }
        .ev-host-btn:hover { transform: translateY(-1px); }
        .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

        .ev-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
        .ev-scope { display: inline-flex; background: var(--paper-2); border: 1px solid var(--ink-12); border-radius: 999px; padding: 3px; }
        .ev-scope button { border: 0; background: transparent; font-family: var(--body); font-weight: 700; font-size: 13.5px; padding: 7px 16px; border-radius: 999px; color: var(--ink-60); cursor: pointer; }
        .ev-scope button.on { background: var(--ink); color: var(--paper); }
        .ev-city select { appearance: none; -webkit-appearance: none; font-family: var(--body); font-weight: 700; font-size: 14px; color: var(--ink); background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24'%3E%3Cpath d='M6 9l6 6 6-6' stroke='%231E2230' stroke-width='2.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 12px center; border: 1px solid var(--ink-12); border-radius: 999px; padding: 8px 34px 8px 14px; cursor: pointer; }

        .ev-chips { display: flex; gap: 8px; overflow-x: auto; margin: 0 -16px 4px; padding: 2px 16px 12px; scrollbar-width: none; -webkit-mask-image: linear-gradient(90deg, #000 88%, transparent); mask-image: linear-gradient(90deg, #000 88%, transparent); }
        .ev-chips::-webkit-scrollbar { display: none; }
        .ev-chips button { flex-shrink: 0; border: 1px solid var(--ink-12); background: #fff; border-radius: 999px; padding: 7px 13px; font-family: var(--body); font-weight: 600; font-size: 13px; color: var(--ink); cursor: pointer; white-space: nowrap; }
        .ev-chips button.on { background: var(--persimmon); border-color: var(--persimmon); color: #fff; }

        .ev-error { color: #b42318; background: #fef3f2; border-radius: 12px; padding: 10px 14px; font-size: 14px; }
        .ev-section { margin-top: 18px; }
        .ev-day { font-family: var(--display); font-weight: 800; font-size: 17px; margin: 0 0 10px; color: var(--ink); line-height: 1.3; }
        .ev-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
        .ev-skel { height: 124px; border-radius: 18px; background: linear-gradient(90deg, var(--paper-2), #fff, var(--paper-2)); background-size: 200% 100%; animation: shimmer 1.2s infinite; border: 1px solid var(--ink-12); }
        @keyframes shimmer { to { background-position: -200% 0; } }

        .ev-empty { text-align: center; padding: 48px 20px; background: var(--paper-2); border: 1px solid var(--ink-12); border-radius: 24px; margin: 18px auto 0; max-width: 560px; }
        .ev-empty-icon { font-size: 48px; margin-bottom: 10px; }
        .ev-empty h2 { font-family: var(--display); font-weight: 800; font-size: 21px; margin: 0 0 6px; line-height: 1.3; }
        .ev-empty p { color: var(--ink-60); font-size: 14.5px; margin: 0 auto 20px; max-width: 420px; line-height: 1.5; }
        .ev-cta { display: inline-block; background: var(--persimmon); color: #fff; font-weight: 700; font-size: 15px; padding: 11px 22px; border-radius: 999px; text-decoration: none; }

        .ev-fab { position: fixed; right: 16px; bottom: calc(78px + env(safe-area-inset-bottom)); z-index: 25; display: inline-flex; align-items: center; gap: 6px; background: var(--persimmon); color: #fff; font-weight: 800; font-size: 15px; padding: 13px 20px; border-radius: 999px; text-decoration: none; box-shadow: 0 10px 24px rgba(255, 106, 61, 0.35); }
        .ev-fab span { font-size: 20px; line-height: 1; }

        @media (min-width: 600px) {
          h1 { font-size: 32px; }
          .ev-chips { margin: 0 0 4px; padding: 2px 0 12px; }
          .ev-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
          .ev-skel { height: 300px; }
          .ev-fab { right: 24px; }
        }
        @media (min-width: 900px) {
          .ev-head { margin-bottom: 20px; }
          .ev-host-btn { display: inline-block; }
          .ev-fab { display: none; }
          .ev-chips { flex-wrap: wrap; overflow: visible; -webkit-mask-image: none; mask-image: none; }
          .ev-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
          .ev-section { margin-top: 26px; }
        }
      `}</style>
    </>
  );
}

/** Soft backgrounds for events without a poster. */
const PLACEHOLDER_BG: Record<string, string> = {
  social: 'linear-gradient(135deg, #F5C2C7, #FBF9F4)',
  language: 'linear-gradient(135deg, #C7B8E0, #FBF9F4)',
  food: 'linear-gradient(135deg, #FFC9B5, #FBF9F4)',
  outdoor: 'linear-gradient(135deg, #BFE6D8, #FBF9F4)',
  culture: 'linear-gradient(135deg, #D9C9F0, #F5C2C7)',
  games: 'linear-gradient(135deg, #FFE3A3, #FBF9F4)',
  study: 'linear-gradient(135deg, #CFD6E6, #FBF9F4)',
  volunteer: 'linear-gradient(135deg, #A8DCC8, #FBF9F4)',
  nightlife: 'linear-gradient(135deg, #3B3F5C, #7A5C9E)',
  other: 'linear-gradient(135deg, #EDE7DA, #FBF9F4)',
};

function EventCard({ e, lang, now, showCity }: { e: FeedEvent; lang: 'en' | 'ko'; now: number; showCity: boolean }) {
  const ko = lang === 'ko';
  const t = eventText(e, lang);
  const p = kstParts(e.starts_at, lang);
  const cat = eventCategory(e.category);
  const past = new Date(e.starts_at).getTime() < now - 2 * 3_600_000;
  return (
    <a href={`/events/${e.id}`} className={`ev-card ${e.status === 'cancelled' || past ? 'dim' : ''} ${e.is_featured ? 'feat' : ''}`}>
      <div className="ev-media" style={e.poster_url ? undefined : { background: PLACEHOLDER_BG[cat.slug] ?? PLACEHOLDER_BG.other }}>
        {e.poster_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.poster_url} alt="" loading="lazy" />
        ) : (
          <span className="ev-ph" aria-hidden="true">{cat.emoji}</span>
        )}
        <span className="ev-date" aria-hidden="true">
          <span className="m">{p.month}</span>
          <span className="d">{p.day}</span>
        </span>
        {e.is_featured && <span className="ev-feat">⭐ {ko ? '추천' : 'Featured'}</span>}
      </div>
      <div className="ev-body">
        <div className="ev-tags">
          <span className="tag cat">
            {cat.emoji} {ko ? cat.label_ko : cat.label_en}
          </span>
          {e.status === 'cancelled' && <span className="tag bad">{ko ? '취소됨' : 'Cancelled'}</span>}
          {e.viewer_is_host ? (
            <span className="tag host">{ko ? '내가 주최' : 'Hosting'}</span>
          ) : e.viewer_going ? (
            <span className="tag going">✓ {ko ? '참여' : 'Going'}</span>
          ) : null}
        </div>
        <h3>{t.title}</h3>
        <div className="ev-meta">
          {p.weekday} {p.time} · {t.place}
          {showCity ? ` · ${cityName(e.city, lang)}` : ''}
        </div>
        <div className="ev-foot">
          <span className="ev-host">
            {e.host.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.host.photo_url} alt="" />
            ) : (
              <span className={`av ${e.host.kind}`}>{e.host.kind === 'admin' ? 'D' : initials(e.host.name)}</span>
            )}
            <span className="hn">{e.host.name}</span>
            {!!e.host.level && e.host.level >= 2 && (
              <span className="ev-lv" title={ko ? levelByNumber(e.host.level).ko : levelByNumber(e.host.level).en}>
                {levelByNumber(e.host.level).emoji}
              </span>
            )}
            {e.host.kind === 'venue' && <span className="ev-badge">{ko ? '가게' : 'Venue'}</span>}
            {e.host.kind === 'admin' && <span className="ev-badge jade">{ko ? '공식' : 'Official'}</span>}
          </span>
          <span className="ev-count">
            👥 {e.going_count}
            {e.capacity ? `/${e.capacity}` : ''}
          </span>
        </div>
        {e.fee_text && <div className="ev-fee">{e.fee_text}</div>}
      </div>
      <style jsx>{`
        .ev-card { display: grid; grid-template-columns: 104px minmax(0, 1fr); gap: 12px; padding: 10px; background: #fff; border: 1px solid var(--ink-12); border-radius: 18px; text-decoration: none; color: var(--ink); transition: transform 0.12s, box-shadow 0.12s; min-width: 0; }
        .ev-card:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(30, 34, 48, 0.08); }
        .ev-card.feat { border-color: rgba(255, 106, 61, 0.5); box-shadow: 0 0 0 1px rgba(255, 106, 61, 0.25); }
        .ev-card.dim { opacity: 0.6; }
        .ev-media { position: relative; aspect-ratio: 1 / 1; border-radius: 12px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: var(--paper-2); }
        .ev-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .ev-ph { font-size: 38px; filter: drop-shadow(0 4px 10px rgba(30, 34, 48, 0.15)); }
        .ev-date { position: absolute; top: 6px; left: 6px; display: flex; flex-direction: column; align-items: center; min-width: 34px; padding: 3px 5px; border-radius: 9px; background: rgba(255, 255, 255, 0.94); line-height: 1.05; box-shadow: 0 2px 8px rgba(30, 34, 48, 0.12); }
        .ev-date .m { font-size: 9.5px; font-weight: 800; color: var(--persimmon); text-transform: uppercase; }
        .ev-date .d { font-family: var(--display); font-size: 16px; font-weight: 800; }
        .ev-feat { display: none; position: absolute; font-weight: 800; color: #fff; background: var(--persimmon); border-radius: 999px; }
        .ev-body { min-width: 0; display: flex; flex-direction: column; gap: 3px; padding: 2px 2px 2px 0; }
        .ev-tags { display: flex; flex-wrap: wrap; gap: 5px; }
        .tag { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: var(--paper-2); color: var(--ink-60); white-space: nowrap; }
        .tag.bad { background: #fef3f2; color: #b42318; }
        .tag.going { background: rgba(15, 157, 119, 0.12); color: var(--jade); }
        .tag.host { background: rgba(255, 106, 61, 0.12); color: var(--persimmon); }
        h3 { font-family: var(--display); font-weight: 800; font-size: 16px; margin: 0; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; word-break: keep-all; overflow-wrap: anywhere; }
        .ev-meta { font-size: 13px; color: var(--ink-60); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ev-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto; padding-top: 4px; font-size: 12.5px; color: var(--ink-60); min-width: 0; }
        .ev-host { display: inline-flex; align-items: center; gap: 5px; min-width: 0; }
        .ev-host img, .av { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
        .av { display: inline-flex; align-items: center; justify-content: center; background: var(--lav); color: var(--ink); font-size: 9px; font-weight: 800; }
        .av.admin { background: var(--persimmon); color: #fff; }
        .av.venue { background: var(--pink); }
        .hn { font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ev-lv { font-size: 13px; }
        .ev-badge { flex-shrink: 0; font-size: 10px; font-weight: 800; padding: 1px 6px; border-radius: 6px; background: var(--pink); color: var(--ink); }
        .ev-badge.jade { background: rgba(15, 157, 119, 0.14); color: var(--jade); }
        .ev-count { flex-shrink: 0; font-weight: 700; color: var(--ink); }
        .ev-fee { align-self: flex-start; font-size: 12px; color: var(--ink-60); background: var(--paper-2); padding: 1px 8px; border-radius: 6px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        @media (min-width: 600px) {
          .ev-card { display: flex; flex-direction: column; gap: 0; padding: 0; overflow: hidden; }
          .ev-media { aspect-ratio: 16 / 10; border-radius: 0; }
          .ev-ph { font-size: 56px; }
          .ev-date { top: 10px; left: 10px; min-width: 42px; padding: 5px 7px; border-radius: 11px; }
          .ev-date .m { font-size: 10.5px; }
          .ev-date .d { font-size: 20px; }
          .ev-feat { display: inline-block; right: 10px; top: 10px; font-size: 11.5px; padding: 3px 9px; }
          .ev-body { padding: 12px 14px 14px; gap: 5px; flex: 1; }
          h3 { font-size: 17px; }
        }
      `}</style>
    </a>
  );
}
