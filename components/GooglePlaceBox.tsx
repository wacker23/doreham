'use client';

import { useState } from 'react';
import { Icon } from '@/components/icons/Icon';

type Photo = { url: string; width: number; height: number; authors: { name: string; uri: string | null }[]; maps_uri: string | null };
type Live = { hours: string[]; open_now: boolean | null; maps_uri: string | null; photos: Photo[] };

/**
 * Hours and photos from Google Maps, loaded only when a member taps the button (each load is a
 * paid Google call, and Google doesn't let us keep this content). Shown with the "Google Maps"
 * attribution and each photo's author, as Google's Places policies require.
 */
export function GooglePlaceBox({ venueId, lang }: { venueId: string; lang: 'en' | 'ko' }) {
  const ko = lang === 'ko';
  const t = (en: string, k: string) => (ko ? k : en);
  const [data, setData] = useState<Live | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'signin' | 'limit'>('idle');

  async function load() {
    setState('loading');
    try {
      const r = await fetch(`/api/venues/${venueId}/google?lang=${lang}`);
      const j = await r.json().catch(() => ({}));
      if (r.status === 401) return setState('signin');
      if (!r.ok) return setState(j.error === 'google_limit' ? 'limit' : 'error');
      setData(j as Live);
      setState('idle');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="gp">
      {!data ? (
        <>
          <button type="button" className="gp-open" onClick={load} disabled={state === 'loading'}>
            <Icon name="image" size={18} />{' '}
            {state === 'loading' ? t('Loading…', '불러오는 중…') : t('See hours and photos on Google Maps', '구글 지도의 영업시간·사진 보기')}
          </button>
          {state === 'signin' && <p className="gp-msg">{t('Sign in to see Google Maps info.', '로그인하면 구글 지도 정보를 볼 수 있어요.')}</p>}
          {state === 'limit' && <p className="gp-msg">{t('Google Maps info is resting for this month. Try again next month.', '이번 달 구글 지도 정보 보기 한도를 다 썼어요. 다음 달에 다시 볼 수 있어요.')}</p>}
          {state === 'error' && <p className="gp-msg">{t('Couldn’t load Google Maps info. Please try again.', '구글 지도 정보를 불러오지 못했어요. 다시 시도해 주세요.')}</p>}
        </>
      ) : (
        <div className="gp-body">
          {data.hours.length > 0 ? (
            <div className="gp-hours">
              <strong>
                {t('Hours on Google Maps', '구글 지도 영업시간')}
                {data.open_now !== null && (
                  <span className={data.open_now ? 'open' : 'closed'}>
                    {data.open_now ? t('Open now', '영업 중') : t('Closed now', '영업 종료')}
                  </span>
                )}
              </strong>
              <ul>
                {data.hours.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="gp-msg">{t('Google Maps has no hours for this place.', '구글 지도에 영업시간 정보가 없어요.')}</p>
          )}
          {data.photos.length > 0 && (
            <div className="gp-photos">
              {data.photos.map((p) => (
                <figure key={p.url}>
                  <a href={p.maps_uri ?? data.maps_uri ?? '#'} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={t('Photo from Google Maps', '구글 지도 사진')} referrerPolicy="no-referrer" />
                  </a>
                  {p.authors.length > 0 && (
                    <figcaption>
                      {t('Photo: ', '사진: ')}
                      {p.authors.map((a, i) => (
                        <span key={a.name}>
                          {i > 0 && ', '}
                          {a.uri ? (
                            <a href={a.uri} target="_blank" rel="noopener noreferrer">{a.name}</a>
                          ) : (
                            a.name
                          )}
                        </span>
                      ))}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          )}
          <p className="gp-attr">
            {data.maps_uri ? (
              <a href={data.maps_uri} target="_blank" rel="noopener noreferrer" translate="no">Google Maps</a>
            ) : (
              <span translate="no">Google Maps</span>
            )}
          </p>
        </div>
      )}
      <style jsx>{`
        .gp { margin-top: 12px; }
        .gp-open { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--ink-12); background: var(--paper-2); color: var(--ink); border-radius: 999px; padding: 10px 16px; font-family: var(--body); font-weight: 600; font-size: 14px; cursor: pointer; }
        .gp-open:disabled { opacity: 0.6; cursor: default; }
        .gp-msg { margin: 8px 0 0; font-size: 13px; color: var(--ink-60); }
        .gp-body { border: 1px solid var(--ink-12); border-radius: 16px; padding: 14px 16px; background: #fff; display: flex; flex-direction: column; gap: 12px; }
        .gp-hours strong { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--ink); }
        .gp-hours strong span { font-size: 12px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
        .gp-hours strong span.open { background: rgba(15, 157, 119, 0.12); color: #0B7F60; }
        .gp-hours strong span.closed { background: var(--paper-2); color: var(--ink-60); }
        .gp-hours ul { list-style: none; margin: 6px 0 0; padding: 0; font-size: 13px; color: var(--ink); line-height: 1.7; }
        .gp-photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .gp-photos figure { margin: 0; display: flex; flex-direction: column; gap: 4px; }
        .gp-photos img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 10px; display: block; }
        .gp-photos figcaption { font-size: 11px; color: #5E5E5E; line-height: 1.3; word-break: break-word; }
        .gp-photos figcaption a { color: inherit; }
        .gp-attr { margin: 0; font-family: Roboto, Arial, sans-serif; font-weight: 400; font-size: 12px; letter-spacing: normal; color: #5E5E5E; }
        .gp-attr a { color: #5E5E5E; text-decoration: none; }
        @media (max-width: 480px) { .gp-photos { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  );
}
