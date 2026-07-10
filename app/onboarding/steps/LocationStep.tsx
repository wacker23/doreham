'use client';

import { useState } from 'react';
import type { OnboardingFormData, UiLanguage } from '../lib/types';

const CITIES: { code: string; en: string; ko: string; note?: { en: string; ko: string } }[] = [
  { code: 'asan', en: 'Asan', ko: '아산', note: { en: 'Launching first', ko: '가장 먼저 시작' } },
  { code: 'cheonan', en: 'Cheonan', ko: '천안', note: { en: 'Launching next', ko: '곧 시작' } },
  { code: 'seoul', en: 'Seoul', ko: '서울' },
  { code: 'busan', en: 'Busan', ko: '부산' },
  { code: 'incheon', en: 'Incheon', ko: '인천' },
  { code: 'daegu', en: 'Daegu', ko: '대구' },
  { code: 'daejeon', en: 'Daejeon', ko: '대전' },
  { code: 'gwangju', en: 'Gwangju', ko: '광주' },
  { code: 'suwon', en: 'Suwon', ko: '수원' },
  { code: 'ulsan', en: 'Ulsan', ko: '울산' },
  { code: 'seongnam', en: 'Seongnam', ko: '성남' },
  { code: 'goyang', en: 'Goyang', ko: '고양' },
  { code: 'yongin', en: 'Yongin', ko: '용인' },
  { code: 'bucheon', en: 'Bucheon', ko: '부천' },
  { code: 'ansan', en: 'Ansan', ko: '안산' },
  { code: 'cheongju', en: 'Cheongju', ko: '청주' },
  { code: 'jeonju', en: 'Jeonju', ko: '전주' },
  { code: 'gimhae', en: 'Gimhae', ko: '김해' },
  { code: 'pohang', en: 'Pohang', ko: '포항' },
  { code: 'other', en: 'Other', ko: '기타' },
];

type Props = {
  lang: UiLanguage;
  initialData: Partial<OnboardingFormData>;
  onNext: (data: { home_district: string }) => void;
  onBack: () => void;
  saving: boolean;
};

export function LocationStep({ lang, initialData, onNext, onBack, saving }: Props) {
  const [city, setCity] = useState(initialData.home_district ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const filteredCities = CITIES.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.en.toLowerCase().includes(q) || c.ko.includes(searchQuery);
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!city) {
      setError(lang === 'ko' ? '도시를 선택해주세요.' : 'Please select a city.');
      return;
    }
    setError(null);
    onNext({ home_district: city });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="step-title">
        {lang === 'ko' ? '어디에 사시나요?' : 'Where do you live?'}
      </h2>
      <p className="step-sub">
        {lang === 'ko'
          ? '가까운 곳에 있는 사람들과 매칭됩니다.'
          : "We'll match you with people close by."}
      </p>

      <div className="field">
        <label htmlFor="city_search">
          {lang === 'ko' ? '도시 검색 또는 선택' : 'Search or pick a city'}
        </label>
        <input
          id="city_search"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={lang === 'ko' ? '아산, Seoul, 부산…' : 'Asan, Seoul, 부산…'}
          className="input"
          disabled={saving}
        />
      </div>

      <div className="cities">
        {filteredCities.map((c) => (
          <label key={c.code} className={`city-card ${city === c.code ? 'selected' : ''}`}>
            <input
              type="radio"
              name="city"
              value={c.code}
              checked={city === c.code}
              onChange={() => { setCity(c.code); setError(null); }}
              disabled={saving}
            />
            <div className="city-info">
              <span className="city-name">
                {lang === 'ko' ? c.ko : c.en}
                <span className="city-alt">
                  {lang === 'ko' ? ` · ${c.en}` : ` · ${c.ko}`}
                </span>
              </span>
              {c.note && (
                <span className="city-note">
                  {lang === 'ko' ? c.note.ko : c.note.en}
                </span>
              )}
            </div>
          </label>
        ))}
        {filteredCities.length === 0 && (
          <div className="empty">
            {lang === 'ko' ? '검색 결과가 없습니다.' : "No cities match your search."}
          </div>
        )}
      </div>

      {error && <span className="err">{error}</span>}

      <div className="actions">
        <button type="button" className="btn-back" onClick={onBack} disabled={saving}>
          {lang === 'ko' ? '← 이전' : '← Back'}
        </button>
        <button type="submit" className="btn-next" disabled={saving}>
          {saving
            ? (lang === 'ko' ? '저장 중…' : 'Saving…')
            : (lang === 'ko' ? '다음 →' : 'Next →')}
        </button>
      </div>

      <style jsx>{`
        .step-title { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--ink); }
        .step-sub { font-size: 16px; color: var(--ink-60); margin: 0 0 32px; }
        .field { margin-bottom: 20px; }
        .field label { display: block; font-weight: 600; font-size: 14px; color: var(--ink); margin-bottom: 8px; }
        .input { width: 100%; padding: 12px 16px; border: 1px solid var(--ink-12); border-radius: 12px; background: #fff; font-family: var(--body); font-size: 15px; color: var(--ink); outline: none; transition: border-color 0.15s; }
        .input:focus { border-color: var(--persimmon); }
        .cities { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 24px; max-height: 380px; overflow-y: auto; padding: 4px; }
        .city-card { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid var(--ink-12); border-radius: 12px; cursor: pointer; transition: border-color 0.15s, background 0.15s; }
        .city-card:hover { border-color: var(--ink-60); }
        .city-card.selected { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.05); }
        .city-card input { margin: 0; accent-color: var(--persimmon); flex-shrink: 0; }
        .city-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .city-name { font-size: 15px; font-weight: 500; color: var(--ink); }
        .city-alt { font-size: 13px; color: var(--ink-60); font-weight: 400; }
        .city-note { font-size: 11px; color: var(--persimmon); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; }
        .empty { grid-column: 1 / -1; text-align: center; padding: 24px; color: var(--ink-60); font-size: 14px; }
        .err { display: block; margin: -8px 0 12px; font-size: 13px; color: var(--persimmon); font-weight: 500; }
        .actions { margin-top: 24px; display: flex; justify-content: space-between; gap: 12px; }
        .btn-back { background: transparent; border: 1px solid var(--ink-12); padding: 12px 24px; border-radius: 999px; font-family: var(--body); font-weight: 600; font-size: 14px; color: var(--ink); cursor: pointer; }
        .btn-back:hover:not(:disabled) { background: var(--ink); color: var(--paper); }
        .btn-next { background: var(--persimmon); color: #fff; border: 0; padding: 14px 28px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 15px; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s; }
        .btn-next:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .btn-next:disabled, .btn-back:disabled { opacity: 0.55; cursor: not-allowed; }
        @media (max-width: 480px) { .cities { grid-template-columns: 1fr; } }
      `}</style>
    </form>
  );
}