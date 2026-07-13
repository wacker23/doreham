'use client';

import { useState } from 'react';
import type { UiLanguage, VenueFormData } from '../lib/types';
import { KOREAN_CITIES } from '../lib/types';

type Props = {
  lang: UiLanguage;
  initialData: Partial<VenueFormData>;
  onNext: (data: { address: string; city: string; district: string }) => void;
  onBack: () => void;
};

export function LocationStep({ lang, initialData, onNext, onBack }: Props) {
  const [address, setAddress] = useState(initialData.address ?? '');
  const [city, setCity] = useState(initialData.city ?? 'asan');
  const [district, setDistrict] = useState(initialData.district ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!address.trim()) {
      errs.address = lang === 'ko' ? '주소를 입력해주세요.' : 'Please enter the address.';
    }
    if (!city) {
      errs.city = lang === 'ko' ? '도시를 선택해주세요.' : 'Please select a city.';
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    onNext({
      address: address.trim(),
      city,
      district: district.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="step-title">
        {lang === 'ko' ? '가게 위치' : 'Location'}
      </h2>
      <p className="step-sub">
        {lang === 'ko'
          ? '손님들이 찾아올 수 있도록 정확한 주소를 알려주세요.'
          : 'So visitors can find you.'}
      </p>

      <div className="field">
        <label htmlFor="city">{lang === 'ko' ? '도시' : 'City'}</label>
        <select
          id="city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className={errors.city ? 'input error' : 'input'}
        >
          {KOREAN_CITIES.map((c) => (
            <option key={c.code} value={c.code}>
              {lang === 'ko' ? c.ko : c.en}
            </option>
          ))}
        </select>
        {errors.city && <span className="err">{errors.city}</span>}
      </div>

      <div className="field">
        <label htmlFor="district">
          {lang === 'ko' ? '구/동 (선택)' : 'District (optional)'}
        </label>
        <input
          id="district"
          type="text"
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          placeholder={lang === 'ko' ? '예: 온양동, 배방읍' : 'e.g. Onyang-dong, Baebang-eup'}
          className="input"
          maxLength={80}
        />
      </div>

      <div className="field">
        <label htmlFor="address">
          {lang === 'ko' ? '전체 주소' : 'Full address'}
        </label>
        <textarea
          id="address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={lang === 'ko'
            ? '예: 충남 아산시 온양동 123-45 1층'
            : 'e.g. 123-45 Onyang-dong 1F, Asan-si, Chungnam'}
          className={errors.address ? 'input error textarea' : 'input textarea'}
          rows={3}
          maxLength={300}
        />
        {errors.address && <span className="err">{errors.address}</span>}
        <span className="hint">
          {lang === 'ko'
            ? '지번 또는 도로명 주소 모두 가능합니다.'
            : 'Old (지번) or new (도로명) address both work.'}
        </span>
      </div>

      <div className="actions">
        <button type="button" className="btn-back" onClick={onBack}>
          {lang === 'ko' ? '← 이전' : '← Back'}
        </button>
        <button type="submit" className="btn-next">
          {lang === 'ko' ? '다음 →' : 'Next →'}
        </button>
      </div>

      <style jsx>{`
        .step-title { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--ink); }
        .step-sub { font-size: 16px; color: var(--ink-60); margin: 0 0 32px; }
        .field { margin-bottom: 24px; }
        .field label { display: block; font-weight: 600; font-size: 14px; color: var(--ink); margin-bottom: 8px; }
        .input { width: 100%; padding: 12px 16px; border: 1px solid var(--ink-12); border-radius: 12px; background: #fff; font-family: var(--body); font-size: 15px; color: var(--ink); outline: none; transition: border-color 0.15s; }
        .textarea { resize: vertical; min-height: 80px; }
        .input:focus { border-color: var(--persimmon); }
        .input.error { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.03); }
        .hint { display: block; margin-top: 6px; font-size: 13px; color: var(--ink-60); }
        .err { display: block; margin-top: 6px; font-size: 13px; color: var(--persimmon); font-weight: 500; }
        .actions { margin-top: 40px; display: flex; justify-content: space-between; gap: 12px; }
        .btn-back { background: transparent; border: 1px solid var(--ink-12); padding: 12px 24px; border-radius: 999px; font-family: var(--body); font-weight: 600; font-size: 14px; color: var(--ink); cursor: pointer; }
        .btn-back:hover { background: var(--ink); color: var(--paper); }
        .btn-next { background: var(--persimmon); color: #fff; border: 0; padding: 14px 28px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 15px; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s; }
        .btn-next:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
      `}</style>
    </form>
  );
}