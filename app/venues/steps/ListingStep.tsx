'use client';

import { useState } from 'react';
import type { UiLanguage, VenueFormData, VenueCategory } from '../lib/types';
import { CATEGORY_LABELS } from '../lib/types';
import { ListingPicker } from '@/components/ListingPicker';
import { cityFromAddress, districtFromAddress, isNaverMapUrl, suggestCategory, type MapPlace } from '@/lib/placesTypes';

type Props = {
  lang: UiLanguage;
  initialData: Partial<VenueFormData>;
  onNext: (data: Partial<VenueFormData>) => void;
  /** 'edit': the venue exists, so its saved name, category and address are never replaced. */
  mode?: 'new' | 'edit';
  venueId?: string;
};

/**
 * Step 1: find the business on Kakao Map. Only real places can join Doreham; the server
 * checks the place again when it links it. The listing fills in the name, category and
 * address (the owner can still change them in the next steps).
 */
export function ListingStep({ lang, initialData, onNext, mode = 'new', venueId }: Props) {
  const ko = lang === 'ko';
  const t = (en: string, k: string) => (ko ? k : en);
  const [place, setPlace] = useState<MapPlace | null>(initialData.listing ?? null);
  const [naver, setNaver] = useState(initialData.naver_map_url ?? '');
  const [error, setError] = useState('');

  function next(e: React.FormEvent) {
    e.preventDefault();
    if (!place) {
      setError(t('Pick your business on Kakao Map to continue.', '카카오맵에서 가게를 선택해야 다음으로 갈 수 있어요.'));
      return;
    }
    const naverUrl = naver.trim();
    if (naverUrl && !isNaverMapUrl(naverUrl)) {
      setError(t('That doesn’t look like a Naver Map link (map.naver.com or naver.me).', '네이버 지도 링크가 아니에요 (map.naver.com 또는 naver.me).'));
      return;
    }

    const updates: Partial<VenueFormData> = { listing: place, naver_map_url: naverUrl };
    if (mode === 'new') {
      if (!initialData.business_name_display) updates.business_name_display = place.name;
      const cat = suggestCategory(place);
      if (!initialData.category && cat && cat in CATEGORY_LABELS) updates.category = cat as VenueCategory;
      // A new (or different) listing brings its address; the owner adds the floor/unit later.
      if (place.id !== initialData.listing?.id || !initialData.road_address) {
        const jibun = place.address;
        updates.road_address = place.road_address;
        updates.jibun_address = jibun;
        updates.address = [place.road_address || jibun, initialData.address_detail].filter(Boolean).join(' ');
        updates.city = cityFromAddress(jibun || place.road_address);
        updates.district = districtFromAddress(jibun);
        updates.zipcode = '';
        updates.building_name = '';
      }
    }
    onNext(updates);
  }

  return (
    <form onSubmit={next} noValidate>
      <h2 className="step-title">{t('Find your place on Kakao Map', '카카오맵에서 가게 찾기')}</h2>
      <p className="step-sub">
        {mode === 'edit'
          ? t(
              'Only real places on the map can be on Doreham. Your saved name and address stay as they are; Doreham compares them with the place you pick.',
              '도레함에는 지도에 있는 실제 가게만 등록돼요. 저장된 가게 이름과 주소는 그대로 두고, 선택한 장소와 비교해요.',
            )
          : t(
              'Only real places on the map can join Doreham. Search for your business and pick it; we fill in the name and address for you.',
              '도레함에는 지도에 있는 실제 가게만 등록돼요. 가게를 검색해서 선택하면 이름과 주소가 자동으로 채워져요.',
            )}
      </p>

      <div className="field">
        <label>{t('Your business on Kakao Map', '카카오맵의 내 가게')}</label>
        <ListingPicker
          lang={lang}
          value={place}
          onChange={(p) => {
            setPlace(p);
            setError('');
          }}
          venueId={venueId}
          initialQuery={initialData.business_name_display ?? ''}
        />
      </div>

      <div className="field">
        <label htmlFor="naver">{t('Naver Map link (optional)', '네이버 지도 링크 (선택)')}</label>
        <input
          id="naver"
          className="input"
          value={naver}
          onChange={(e) => setNaver(e.target.value)}
          placeholder="https://naver.me/…"
          inputMode="url"
          maxLength={300}
        />
        <span className="hint">
          {t(
            'Open your place in Naver Map → Share → Copy link. Guests see it on your venue page.',
            '네이버 지도에서 가게를 열고 공유 → 링크 복사. 가게 페이지에 함께 보여요.',
          )}
        </span>
      </div>

      <p className="note">
        {t(
          'We check the listing against your business registration before approval. Opening hours and photos you add in the next steps are what members see; if Google Maps also has your place, members can open its hours and photos too.',
          '승인 전에 도레함이 사업자 정보와 카카오맵 정보를 비교해요. 회원에게는 다음 단계에서 입력하는 영업시간과 사진이 보이고, 구글 지도에도 가게가 있으면 구글의 영업시간과 사진도 함께 볼 수 있어요.',
        )}
      </p>

      {error && <p className="err">{error}</p>}

      <div className="actions">
        <button type="submit" className="btn-next">{t('Next →', '다음 →')}</button>
      </div>

      <style jsx>{`
        .step-title { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--ink); }
        .step-sub { font-size: 16px; color: var(--ink-60); margin: 0 0 32px; line-height: 1.5; }
        .field { margin-bottom: 24px; }
        .field label { display: block; font-weight: 600; font-size: 14px; color: var(--ink); margin-bottom: 8px; }
        .input { width: 100%; padding: 12px 16px; border: 1px solid var(--ink-12); border-radius: 12px; background: #fff; font-family: var(--body); font-size: 15px; color: var(--ink); outline: none; }
        .input:focus { border-color: var(--persimmon); }
        .hint { display: block; margin-top: 6px; font-size: 13px; color: var(--ink-60); }
        .note { font-size: 13px; color: var(--ink-60); line-height: 1.55; background: var(--paper-2); border-radius: 12px; padding: 12px 14px; margin: 0; }
        .err { margin: 16px 0 0; font-size: 13px; color: #C8441A; font-weight: 600; }
        .actions { margin-top: 32px; display: flex; justify-content: flex-end; }
        .btn-next { background: var(--persimmon); color: #fff; border: 0; padding: 14px 28px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 15px; cursor: pointer; }
      `}</style>
    </form>
  );
}
