'use client';

import { useState } from 'react';
import type { UiLanguage, VenueFormData } from '../lib/types';
import { KOREAN_CITIES } from '../lib/types';

type Props = {
  lang: UiLanguage;
  initialData: Partial<VenueFormData>;
  onNext: (data: {
    address: string;
    city: string;
    district: string;
    zipcode: string;
    road_address: string;
    jibun_address: string;
    building_name: string;
    address_detail: string;
  }) => void;
  onBack: () => void;
};

// Daum Postcode types (loaded via script tag in layout.tsx)
type DaumPostcodeData = {
  zonecode: string;           // zipcode
  address: string;            // full address (either road or jibun)
  roadAddress: string;        // 도로명 주소
  jibunAddress: string;       // 지번 주소
  buildingName?: string;      // building name
  sido: string;               // province/metro city
  sigungu: string;            // city/district
  bname?: string;             // 동/읍/면
};

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: DaumPostcodeData) => void;
        onclose?: () => void;
      }) => { open: () => void };
    };
  }
}

// Map Daum's sigungu to our city codes
function mapSigunguToCityCode(sigungu: string, sido: string): string {
  const s = sigungu.toLowerCase();
  const sd = sido.toLowerCase();
  if (sd.includes('서울')) return 'seoul';
  if (sd.includes('부산')) return 'busan';
  if (sd.includes('인천')) return 'incheon';
  if (sd.includes('대구')) return 'daegu';
  if (sd.includes('대전')) return 'daejeon';
  if (sd.includes('광주')) return 'gwangju';
  if (sd.includes('울산')) return 'ulsan';
  if (s.includes('아산')) return 'asan';
  if (s.includes('천안')) return 'cheonan';
  if (s.includes('수원')) return 'suwon';
  return 'other';
}

export function LocationStep({ lang, initialData, onNext, onBack }: Props) {
  const [zipcode, setZipcode] = useState(initialData.zipcode ?? '');
  const [roadAddress, setRoadAddress] = useState(initialData.road_address ?? '');
  const [jibunAddress, setJibunAddress] = useState(initialData.jibun_address ?? '');
  const [buildingName, setBuildingName] = useState(initialData.building_name ?? '');
  const [addressDetail, setAddressDetail] = useState(initialData.address_detail ?? '');
  const [city, setCity] = useState(initialData.city ?? '');
  const [district, setDistrict] = useState(initialData.district ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function openPostcodeSearch() {
    if (!window.daum?.Postcode) {
      setErrors({ ...errors, address: lang === 'ko' ? '주소 검색 스크립트가 아직 로드되지 않았습니다. 잠시 후 다시 시도해주세요.' : 'Address script not loaded yet. Please try again in a moment.' });
      return;
    }

    new window.daum.Postcode({
      oncomplete: (data: DaumPostcodeData) => {
        setZipcode(data.zonecode);
        setRoadAddress(data.roadAddress || '');
        setJibunAddress(data.jibunAddress || '');
        setBuildingName(data.buildingName || '');
        setCity(mapSigunguToCityCode(data.sigungu, data.sido));
        setDistrict(data.bname || '');
        setErrors({ ...errors, address: '' });
      },
    }).open();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!roadAddress && !jibunAddress) {
      errs.address = lang === 'ko' ? '주소를 검색해주세요.' : 'Please search for an address.';
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    // Combine road/jibun + detail into a single `address` field for backwards compat
    const finalAddress = [roadAddress || jibunAddress, addressDetail].filter(Boolean).join(' ');

    onNext({
      address: finalAddress,
      city,
      district,
      zipcode,
      road_address: roadAddress,
      jibun_address: jibunAddress,
      building_name: buildingName,
      address_detail: addressDetail.trim(),
    });
  }

  const hasAddress = roadAddress || jibunAddress;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="step-title">
        {lang === 'ko' ? '가게 위치' : 'Location'}
      </h2>
      <p className="step-sub">
        {lang === 'ko'
          ? '주소 검색으로 정확한 위치를 입력해주세요.'
          : 'Search for your address for accurate location info.'}
      </p>

      <div className="field">
        <label>
          {lang === 'ko' ? '주소' : 'Address'}
        </label>
        <button
          type="button"
          onClick={openPostcodeSearch}
          className={`address-search-btn ${hasAddress ? 'has-address' : ''}`}
        >
          🔍 {lang === 'ko' ? '주소 검색' : 'Search address'}
        </button>
        {errors.address && <span className="err">{errors.address}</span>}
      </div>

      {hasAddress && (
        <div className="address-preview">
          {zipcode && (
            <div className="addr-row">
              <span className="addr-label">{lang === 'ko' ? '우편번호' : 'Zip'}</span>
              <span className="addr-value">{zipcode}</span>
            </div>
          )}
          {roadAddress && (
            <div className="addr-row">
              <span className="addr-label">{lang === 'ko' ? '도로명' : 'Road'}</span>
              <span className="addr-value">{roadAddress}</span>
            </div>
          )}
          {jibunAddress && (
            <div className="addr-row">
              <span className="addr-label">{lang === 'ko' ? '지번' : 'Jibun'}</span>
              <span className="addr-value">{jibunAddress}</span>
            </div>
          )}
          {buildingName && (
            <div className="addr-row">
              <span className="addr-label">{lang === 'ko' ? '건물명' : 'Building'}</span>
              <span className="addr-value">{buildingName}</span>
            </div>
          )}
        </div>
      )}

      {hasAddress && (
        <div className="field">
          <label htmlFor="address_detail">
            {lang === 'ko' ? '상세 주소 (선택)' : 'Address detail (optional)'}
          </label>
          <input
            id="address_detail"
            type="text"
            value={addressDetail}
            onChange={(e) => setAddressDetail(e.target.value)}
            placeholder={lang === 'ko' ? '예: 3층 302호' : 'e.g. 3F, Unit 302'}
            className="input"
            maxLength={100}
          />
          <span className="hint">
            {lang === 'ko'
              ? '층수, 호수, 상세 위치 등을 입력해주세요.'
              : 'Floor number, unit, or other detail.'}
          </span>
        </div>
      )}

      {hasAddress && (
        <div className="field">
          <label htmlFor="city">
            {lang === 'ko' ? '도시 (자동 감지)' : 'City (auto-detected)'}
          </label>
          <select
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="input"
          >
            {KOREAN_CITIES.map((c) => (
              <option key={c.code} value={c.code}>
                {lang === 'ko' ? c.ko : c.en}
              </option>
            ))}
          </select>
          <span className="hint">
            {lang === 'ko'
              ? '자동 감지된 도시가 정확한지 확인하세요.'
              : 'Verify the auto-detected city is correct.'}
          </span>
        </div>
      )}

      <div className="actions">
        <button type="button" className="btn-back" onClick={onBack}>
          {lang === 'ko' ? '← 이전' : '← Back'}
        </button>
        <button type="submit" className="btn-next" disabled={!hasAddress}>
          {lang === 'ko' ? '다음 →' : 'Next →'}
        </button>
      </div>

      <style jsx>{`
        .step-title { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--ink); }
        .step-sub { font-size: 16px; color: var(--ink-60); margin: 0 0 32px; }
        .field { margin-bottom: 24px; }
        .field label { display: block; font-weight: 600; font-size: 14px; color: var(--ink); margin-bottom: 8px; }
        .input { width: 100%; padding: 12px 16px; border: 1px solid var(--ink-12); border-radius: 12px; background: #fff; font-family: var(--body); font-size: 15px; color: var(--ink); outline: none; transition: border-color 0.15s; }
        .input:focus { border-color: var(--persimmon); }
        .hint { display: block; margin-top: 6px; font-size: 13px; color: var(--ink-60); }
        .err { display: block; margin-top: 6px; font-size: 13px; color: var(--persimmon); font-weight: 500; }
        .address-search-btn {
          width: 100%;
          padding: 16px 20px;
          background: var(--paper-2);
          border: 2px dashed var(--ink-12);
          border-radius: 12px;
          font-family: var(--body);
          font-weight: 600;
          font-size: 15px;
          color: var(--ink);
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s, color 0.15s;
        }
        .address-search-btn:hover {
          border-color: var(--persimmon);
          color: var(--persimmon);
          background: rgba(255, 106, 61, 0.03);
        }
        .address-search-btn.has-address {
          border-style: solid;
          border-color: var(--jade);
          color: var(--jade);
          background: rgba(15, 157, 119, 0.06);
        }
        .address-preview {
          background: var(--paper-2);
          border-radius: 12px;
          padding: 14px 18px;
          margin-bottom: 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .addr-row {
          display: flex;
          gap: 12px;
          font-size: 14px;
          align-items: baseline;
        }
        .addr-label {
          font-weight: 700;
          color: var(--ink-60);
          font-size: 12px;
          width: 70px;
          flex-shrink: 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .addr-value {
          color: var(--ink);
          word-break: break-word;
        }
        .actions { margin-top: 40px; display: flex; justify-content: space-between; gap: 12px; }
        .btn-back { background: transparent; border: 1px solid var(--ink-12); padding: 12px 24px; border-radius: 999px; font-family: var(--body); font-weight: 600; font-size: 14px; color: var(--ink); cursor: pointer; }
        .btn-back:hover { background: var(--ink); color: var(--paper); }
        .btn-next { background: var(--persimmon); color: #fff; border: 0; padding: 14px 28px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 15px; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s; }
        .btn-next:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .btn-next:disabled { opacity: 0.55; cursor: not-allowed; }
      `}</style>
    </form>
  );
}