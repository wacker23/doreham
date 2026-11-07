'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons/Icon';
import { listingError, type MapPlace } from '@/lib/placesTypes';

type Props = {
  lang: 'en' | 'ko';
  value: MapPlace | null;
  onChange: (place: MapPlace | null) => void;
  /** The venue being edited (its own listing isn't shown as taken). */
  venueId?: string;
  initialQuery?: string;
  /** Smaller layout for the admin page. */
  compact?: boolean;
};

/**
 * Search Kakao Map and pick the business. Used by venue registration / edit and by admins.
 * Places already on Doreham can't be picked.
 */
export function ListingPicker({ lang, value, onChange, venueId, initialQuery = '', compact = false }: Props) {
  const ko = lang === 'ko';
  const t = (en: string, k: string) => (ko ? k : en);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<MapPlace[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function search(e?: React.FormEvent | React.MouseEvent) {
    e?.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setError(listingError('query_too_short', lang));
      return;
    }
    setBusy(true);
    setError('');
    try {
      const qs = new URLSearchParams({ q });
      if (venueId) qs.set('venue_id', venueId);
      const r = await fetch(`/api/places/search?${qs}`);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(listingError(j.error, lang));
        setResults(null);
      } else {
        setResults((j.places ?? []) as MapPlace[]);
      }
    } catch {
      setError(listingError('search_failed', lang));
    }
    setBusy(false);
  }

  return (
    <div className={`lp ${compact ? 'compact' : ''}`}>
      {value ? (
        <div className="lp-picked">
          <span className="lp-check"><Icon name="done" size={20} /></span>
          <div className="lp-info">
            <strong>{value.name}</strong>
            <span>{value.category}</span>
            <span>{value.road_address || value.address}</span>
            {value.phone && <span>{value.phone}</span>}
            <a href={value.url} target="_blank" rel="noopener noreferrer" className="lp-link">
              {t('Open in Kakao Map', '카카오맵에서 보기')} <Icon name="external" size={14} />
            </a>
          </div>
          <button type="button" className="lp-change" onClick={() => onChange(null)}>
            {t('Change', '다시 선택')}
          </button>
        </div>
      ) : (
        <>
          <div className="lp-row">
            <input
              className="lp-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') search(e as unknown as React.FormEvent);
              }}
              placeholder={t('Business name, e.g. Moga Coffee Asan', '가게 이름 (예: 모가커피 아산)')}
              maxLength={60}
              aria-label={t('Search Kakao Map', '카카오맵 검색')}
            />
            <button type="button" className="lp-search" onClick={search} disabled={busy}>
              <Icon name="search" size={16} tone="light" /> {busy ? t('Searching…', '검색 중…') : t('Search', '검색')}
            </button>
          </div>
          {error && <p className="lp-err">{error}</p>}

          {results && results.length === 0 && (
            <div className="lp-empty">
              <strong>{t('No places found', '검색 결과가 없어요')}</strong>
              <span>
                {t(
                  'Try the name as it appears on Kakao Map, or add the city (e.g. "Asan"). If your business isn’t on Kakao Map yet, add it in the Kakao Map app first (장소 제보 → new place), then come back.',
                  '카카오맵에 나오는 이름 그대로, 또는 도시 이름을 붙여 검색해 보세요 (예: “아산”). 아직 카카오맵에 없는 가게라면 카카오맵 앱에서 장소를 먼저 등록(장소 제보 → 신규 장소)한 뒤 다시 와 주세요.',
                )}
              </span>
            </div>
          )}

          {results && results.length > 0 && (
            <ul className="lp-list">
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" className="lp-item" disabled={p.claimed} onClick={() => onChange(p)}>
                    <strong>{p.name}</strong>
                    <span>{p.category}</span>
                    <span>{p.road_address || p.address}</span>
                    {p.claimed && <em>{t('Already on Doreham', '이미 도레함에 등록된 가게')}</em>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <style jsx>{`
  .lp { display: flex; flex-direction: column; gap: 10px; }
  .lp-row { display: flex; gap: 8px; }
  .lp-input { flex: 1; min-width: 0; padding: 12px 16px; border: 1px solid var(--ink-12); border-radius: 12px; background: #fff; font-family: var(--body); font-size: 15px; color: var(--ink); outline: none; }
  .lp-input:focus { border-color: var(--persimmon); }
  .lp-search { display: inline-flex; align-items: center; gap: 6px; padding: 12px 18px; border-radius: 12px; border: 0; background: var(--ink); color: var(--paper); font-family: var(--body); font-weight: 700; font-size: 14px; cursor: pointer; white-space: nowrap; }
  .lp-search:disabled { opacity: 0.6; cursor: default; }
  .lp-err { margin: 0; font-size: 13px; color: #C8441A; font-weight: 600; }
  .lp-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; max-height: 420px; overflow: auto; }
  .lp-item { width: 100%; text-align: left; display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border: 1.5px solid var(--ink-12); border-radius: 12px; background: var(--paper-2); cursor: pointer; font-family: var(--body); color: var(--ink); }
  .lp-item:hover:not(:disabled) { border-color: var(--persimmon); }
  .lp-item:disabled { opacity: 0.55; cursor: not-allowed; }
  .lp-item strong { font-size: 15px; }
  .lp-item span { font-size: 13px; color: var(--ink-60); }
  .lp-item em { font-style: normal; font-size: 12px; font-weight: 700; color: #C8441A; }
  .lp-empty { display: flex; flex-direction: column; gap: 4px; padding: 14px; border-radius: 12px; background: var(--paper-2); border: 1px dashed var(--ink-12); }
  .lp-empty strong { font-size: 14px; color: var(--ink); }
  .lp-empty span { font-size: 13px; color: var(--ink-60); line-height: 1.5; }
  .lp-picked { display: flex; gap: 12px; align-items: flex-start; padding: 14px 16px; border: 1.5px solid var(--jade); border-radius: 14px; background: rgba(15, 157, 119, 0.06); }
  .lp-check { display: flex; padding-top: 2px; }
  .lp-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .lp-info strong { font-size: 16px; color: var(--ink); }
  .lp-info span { font-size: 13px; color: var(--ink-60); }
  .lp-link { margin-top: 4px; display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700; color: var(--ink); }
  .lp-change { border: 1px solid var(--ink-12); background: #fff; border-radius: 999px; padding: 7px 14px; font-family: var(--body); font-weight: 600; font-size: 13px; cursor: pointer; white-space: nowrap; color: var(--ink); }
  .compact .lp-item, .compact .lp-picked { padding: 10px 12px; }
  @media (max-width: 480px) { .lp-row { flex-direction: column; } }
`}</style>
    </div>
  );
}
