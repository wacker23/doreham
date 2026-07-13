'use client';

import { useState } from 'react';
import type { UiLanguage, VenueFormData } from '../lib/types';

type Props = {
  lang: UiLanguage;
  initialData: Partial<VenueFormData>;
  onNext: (data: {
    description: string;
    description_en: string;
    per_person_cost_won: number | undefined;
    discount_offer: string;
    discount_offer_en: string;
  }) => void;
  onBack: () => void;
};

export function DescriptionStep({ lang, initialData, onNext, onBack }: Props) {
  const [description, setDescription] = useState(initialData.description ?? '');
  const [descriptionEn, setDescriptionEn] = useState(initialData.description_en ?? '');
  const [pricePerPerson, setPricePerPerson] = useState(
    initialData.per_person_cost_won?.toString() ?? ''
  );
  const [discount, setDiscount] = useState(initialData.discount_offer ?? '');
  const [discountEn, setDiscountEn] = useState(initialData.discount_offer_en ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onNext({
      description: description.trim(),
      description_en: descriptionEn.trim(),
      per_person_cost_won: pricePerPerson ? parseInt(pricePerPerson, 10) : undefined,
      discount_offer: discount.trim(),
      discount_offer_en: discountEn.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="step-title">
        {lang === 'ko' ? '가게 소개' : 'About your business'}
      </h2>
      <p className="step-sub">
        {lang === 'ko'
          ? '방문자들에게 가게를 소개해주세요.'
          : 'Tell visitors what makes your place special.'}
      </p>

      <div className="field">
        <label htmlFor="description">
          {lang === 'ko' ? '한국어 소개' : 'Korean description'}
          <span className="optional">
            {lang === 'ko' ? ' (선택)' : ' (optional)'}
          </span>
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={lang === 'ko'
            ? '가게 분위기, 인기 메뉴, 특징 등을 자유롭게 소개해주세요.'
            : '가게 분위기, 인기 메뉴, 특징 등...'}
          className="input textarea"
          rows={4}
          maxLength={800}
        />
        <span className="counter">{description.length}/800</span>
      </div>

      <div className="field">
        <label htmlFor="description_en">
          {lang === 'ko' ? '영어 소개' : 'English description'}
          <span className="optional">
            {lang === 'ko' ? ' (선택)' : ' (optional)'}
          </span>
        </label>
        <textarea
          id="description_en"
          value={descriptionEn}
          onChange={(e) => setDescriptionEn(e.target.value)}
          placeholder={lang === 'ko'
            ? '영어로 소개하면 외국인 손님이 더 편하게 방문할 수 있습니다.'
            : 'Describe the vibe, popular items, what makes you special...'}
          className="input textarea"
          rows={4}
          maxLength={800}
        />
        <span className="counter">{descriptionEn.length}/800</span>
        <span className="hint">
          {lang === 'ko'
            ? '영어 소개가 있으면 국제 사용자들이 더 편하게 방문합니다.'
            : 'English descriptions help international users feel welcome.'}
        </span>
      </div>

      <div className="field">
        <label htmlFor="price">
          {lang === 'ko' ? '1인당 평균 비용' : 'Average cost per person'}
          <span className="optional">
            {lang === 'ko' ? ' (선택)' : ' (optional)'}
          </span>
        </label>
        <div className="price-row">
          <input
            id="price"
            type="number"
            value={pricePerPerson}
            onChange={(e) => setPricePerPerson(e.target.value)}
            placeholder="10000"
            className="input"
            min="0"
            step="500"
          />
          <span className="currency">
            {lang === 'ko' ? '원' : '₩'}
          </span>
        </div>
        <span className="hint">
          {lang === 'ko'
            ? '1인당 1만원 미만이면 매칭 우선순위가 높아집니다.'
            : 'Venues under ₩10,000 per person get matching priority.'}
        </span>
      </div>

      <div className="field">
        <label htmlFor="discount">
          {lang === 'ko' ? '도레함 할인 제안 (한국어)' : 'Doreham discount offer (Korean)'}
          <span className="optional">
            {lang === 'ko' ? ' (선택)' : ' (optional)'}
          </span>
        </label>
        <input
          id="discount"
          type="text"
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
          placeholder={lang === 'ko'
            ? '예: 도레함 그룹은 커피 10% 할인'
            : '예: 도레함 그룹은 커피 10% 할인'}
          className="input"
          maxLength={200}
        />
      </div>

      <div className="field">
        <label htmlFor="discount_en">
          {lang === 'ko' ? '도레함 할인 제안 (영어)' : 'Doreham discount offer (English)'}
          <span className="optional">
            {lang === 'ko' ? ' (선택)' : ' (optional)'}
          </span>
        </label>
        <input
          id="discount_en"
          type="text"
          value={discountEn}
          onChange={(e) => setDiscountEn(e.target.value)}
          placeholder="e.g. 10% off coffee for Doreham groups"
          className="input"
          maxLength={200}
        />
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
        .optional { font-weight: 400; color: var(--ink-60); font-size: 13px; }
        .input { width: 100%; padding: 12px 16px; border: 1px solid var(--ink-12); border-radius: 12px; background: #fff; font-family: var(--body); font-size: 15px; color: var(--ink); outline: none; transition: border-color 0.15s; }
        .textarea { resize: vertical; min-height: 100px; }
        .input:focus { border-color: var(--persimmon); }
        .counter { display: block; text-align: right; font-size: 12px; color: var(--ink-60); margin-top: 4px; }
        .hint { display: block; margin-top: 6px; font-size: 13px; color: var(--ink-60); }
        .price-row { display: flex; align-items: center; gap: 8px; }
        .price-row .input { flex: 1; }
        .currency { font-weight: 600; color: var(--ink-60); }
        .actions { margin-top: 40px; display: flex; justify-content: space-between; gap: 12px; }
        .btn-back { background: transparent; border: 1px solid var(--ink-12); padding: 12px 24px; border-radius: 999px; font-family: var(--body); font-weight: 600; font-size: 14px; color: var(--ink); cursor: pointer; }
        .btn-back:hover { background: var(--ink); color: var(--paper); }
        .btn-next { background: var(--persimmon); color: #fff; border: 0; padding: 14px 28px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 15px; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s; }
        .btn-next:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
      `}</style>
    </form>
  );
}