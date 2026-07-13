'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { UiLanguage, VenueCategory, VenueFormData } from '../lib/types';
import { CATEGORY_LABELS } from '../lib/types';
import {
  validateBusinessNumber,
  formatBusinessNumber,
  verifyBusinessNumberWithGov,
} from '../lib/save';

type Props = {
  lang: UiLanguage;
  initialData: Partial<VenueFormData>;
  onNext: (data: {
    business_name_display: string;
    business_name_legal: string;
    business_registration_number: string;
    category: VenueCategory;
    business_opened_at: string;
    contact_email: string;
    contact_phone: string;
    contact_name: string;
  }) => void;
};

export function BasicInfoStep({ lang, initialData, onNext }: Props) {
  const [displayName, setDisplayName] = useState(initialData.business_name_display ?? '');
  const [legalName, setLegalName] = useState(initialData.business_name_legal ?? '');
  const [brn, setBrn] = useState(initialData.business_registration_number ?? '');
  const [category, setCategory] = useState<VenueCategory | ''>(initialData.category ?? '');
  const [openedAt, setOpenedAt] = useState(initialData.business_opened_at ?? '');
  const [contactEmail, setContactEmail] = useState(initialData.contact_email ?? '');
  const [contactPhone, setContactPhone] = useState(initialData.contact_phone ?? '');
  const [contactName, setContactName] = useState(initialData.contact_name ?? '');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pre-fill contact email from auth on first mount if not already set
  useEffect(() => {
    if (!contactEmail) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email) setContactEmail(user.email);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleVerifyBrn() {
    const cleaned = brn.replace(/[-\s]/g, '');
    if (!validateBusinessNumber(cleaned)) {
      setErrors({ ...errors, brn: lang === 'ko' ? '사업자등록번호 형식이 올바르지 않습니다.' : 'Invalid business registration number format.' });
      return;
    }

    setErrors({ ...errors, brn: '' });
    setVerifying(true);
    setVerified(false);

    const result = await verifyBusinessNumberWithGov(cleaned);
    setVerifying(false);

    if (result.valid) {
      setVerified(true);
      setErrors({ ...errors, brn: '' });
    } else {
      setVerified(false);
      let msg = lang === 'ko' ? '확인 실패: ' : 'Verification failed: ';
      if (result.reason === 'not_registered') msg += lang === 'ko' ? '국세청에 등록되지 않은 번호입니다.' : 'Not registered with the tax service.';
      else if (result.reason === 'api_not_configured') msg += lang === 'ko' ? 'API 설정이 필요합니다. 관리자에게 문의하세요.' : 'API not configured. Contact admin.';
      else if (result.reason === 'gov_api_error') msg += lang === 'ko' ? '국세청 서버 오류. 나중에 다시 시도하세요.' : 'Government API error. Try again later.';
      else if (result.status) msg += result.status;
      else msg += lang === 'ko' ? '알 수 없는 오류' : 'Unknown error';
      setErrors({ ...errors, brn: msg });
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!displayName.trim()) errs.displayName = lang === 'ko' ? '가게 이름을 입력해주세요.' : 'Please enter business name.';
    if (!legalName.trim()) errs.legalName = lang === 'ko' ? '사업자등록증상 이름을 입력해주세요.' : 'Please enter legal business name.';
    if (!validateBusinessNumber(brn.replace(/[-\s]/g, ''))) errs.brn = lang === 'ko' ? '유효한 사업자등록번호를 입력해주세요.' : 'Enter a valid business registration number.';
    if (!category) errs.category = lang === 'ko' ? '업종을 선택해주세요.' : 'Please select category.';
    if (!contactEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      errs.contactEmail = lang === 'ko' ? '올바른 이메일을 입력해주세요.' : 'Please enter a valid email.';
    }
    if (!contactPhone.trim()) {
      errs.contactPhone = lang === 'ko' ? '연락처 전화번호를 입력해주세요.' : 'Please enter a phone number.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    onNext({
      business_name_display: displayName.trim(),
      business_name_legal: legalName.trim(),
      business_registration_number: brn.replace(/[-\s]/g, ''),
      category: category as VenueCategory,
      business_opened_at: openedAt || '',
      contact_email: contactEmail.trim(),
      contact_phone: contactPhone.trim(),
      contact_name: contactName.trim(),
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="step-title">
        {lang === 'ko' ? '가게 정보' : 'Business info'}
      </h2>
      <p className="step-sub">
        {lang === 'ko' ? '가게의 기본 정보를 알려주세요.' : "Let's start with your business basics."}
      </p>

      <div className="field">
        <label htmlFor="display_name">
          {lang === 'ko' ? '가게 이름 (표시용)' : 'Business name (as displayed)'}
        </label>
        <input
          id="display_name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={lang === 'ko' ? '예: 모가 커피' : 'e.g. Moga Coffee'}
          className={errors.displayName ? 'input error' : 'input'}
          maxLength={80}
        />
        {errors.displayName && <span className="err">{errors.displayName}</span>}
      </div>

      <div className="field">
        <label htmlFor="legal_name">
          {lang === 'ko' ? '사업자등록증상 이름' : 'Legal business name'}
        </label>
        <input
          id="legal_name"
          type="text"
          value={legalName}
          onChange={(e) => setLegalName(e.target.value)}
          placeholder={lang === 'ko' ? '사업자등록증에 있는 이름' : 'As on your business registration'}
          className={errors.legalName ? 'input error' : 'input'}
          maxLength={120}
        />
        {errors.legalName && <span className="err">{errors.legalName}</span>}
      </div>

      <div className="field">
        <label htmlFor="brn">
          {lang === 'ko' ? '사업자등록번호' : 'Business registration number (사업자등록번호)'}
        </label>
        <div className="brn-row">
          <input
            id="brn"
            type="text"
            value={brn}
            onChange={(e) => {
              setBrn(e.target.value);
              setVerified(false);
            }}
            onBlur={(e) => {
              const cleaned = e.target.value.replace(/[-\s]/g, '');
              if (cleaned.length === 10) setBrn(formatBusinessNumber(cleaned));
            }}
            placeholder="123-45-67890"
            className={errors.brn ? 'input error' : 'input'}
            maxLength={12}
          />
          <button
            type="button"
            className={`btn-verify ${verified ? 'verified' : ''}`}
            onClick={handleVerifyBrn}
            disabled={verifying || !brn.trim()}
          >
            {verifying
              ? (lang === 'ko' ? '확인 중…' : 'Verifying…')
              : verified
                ? (lang === 'ko' ? '✓ 확인됨' : '✓ Verified')
                : (lang === 'ko' ? '확인' : 'Verify')}
          </button>
        </div>
        {errors.brn && <span className="err">{errors.brn}</span>}
        <span className="hint">
          {lang === 'ko'
            ? '국세청 데이터베이스와 대조하여 확인합니다.'
            : "We'll verify against the National Tax Service database."}
        </span>
      </div>

      <div className="field">
        <label>{lang === 'ko' ? '업종' : 'Category'}</label>
        <div className="category-grid">
          {(Object.entries(CATEGORY_LABELS) as [VenueCategory, typeof CATEGORY_LABELS[VenueCategory]][]).map(([code, cat]) => (
            <label
              key={code}
              className={`cat-card ${category === code ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="category"
                value={code}
                checked={category === code}
                onChange={() => setCategory(code)}
              />
              <span className="cat-emoji">{cat.emoji}</span>
              <span className="cat-name">{lang === 'ko' ? cat.ko : cat.en}</span>
            </label>
          ))}
        </div>
        {errors.category && <span className="err">{errors.category}</span>}
      </div>

      <div className="field">
        <label htmlFor="opened_at">
          {lang === 'ko' ? '개업일 (선택)' : 'Business opened (optional)'}
        </label>
        <input
          id="opened_at"
          type="date"
          value={openedAt}
          onChange={(e) => setOpenedAt(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
          className="input"
        />
        <span className="hint">
          {lang === 'ko'
            ? '2년 이내에 오픈한 가게는 "숨은 명소" 부스트를 받을 수 있습니다.'
            : 'Venues opened within 2 years may qualify for our "Hidden Gem" boost.'}
        </span>
      </div>

      <div className="section-divider">
        <h3>{lang === 'ko' ? '연락처 정보' : 'Contact info'}</h3>
        <p>{lang === 'ko' ? '가게 승인 및 문의 관련 연락에 사용됩니다.' : "We'll use this for approval notifications and any questions."}</p>
      </div>

      <div className="field">
        <label htmlFor="contact_email">
          {lang === 'ko' ? '연락처 이메일' : 'Contact email'}
        </label>
        <input
          id="contact_email"
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="you@example.com"
          className={errors.contactEmail ? 'input error' : 'input'}
          maxLength={200}
        />
        {errors.contactEmail && <span className="err">{errors.contactEmail}</span>}
        <span className="hint">
          {lang === 'ko' ? '로그인 이메일로 미리 채워집니다. 필요시 변경하세요.' : 'Pre-filled with your sign-in email. Change if needed.'}
        </span>
      </div>

      <div className="field">
        <label htmlFor="contact_phone">
          {lang === 'ko' ? '연락처 전화번호' : 'Contact phone'}
        </label>
        <input
          id="contact_phone"
          type="tel"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
          placeholder="010-1234-5678"
          className={errors.contactPhone ? 'input error' : 'input'}
          maxLength={20}
        />
        {errors.contactPhone && <span className="err">{errors.contactPhone}</span>}
      </div>

      <div className="field">
        <label htmlFor="contact_name">
          {lang === 'ko' ? '담당자 이름 (선택)' : 'Contact person name (optional)'}
        </label>
        <input
          id="contact_name"
          type="text"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          placeholder={lang === 'ko' ? '예: 김민수' : 'e.g. Sarah Kim'}
          className="input"
          maxLength={80}
        />
        <span className="hint">
          {lang === 'ko' ? '계정 이름과 다를 경우 입력하세요.' : 'If different from your account name.'}
        </span>
      </div>

      <div className="actions">
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
        .input:focus { border-color: var(--persimmon); }
        .input.error { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.03); }
        .hint { display: block; margin-top: 6px; font-size: 13px; color: var(--ink-60); }
        .err { display: block; margin-top: 6px; font-size: 13px; color: var(--persimmon); font-weight: 500; }
        .brn-row { display: flex; gap: 8px; }
        .brn-row .input { flex: 1; }
        .btn-verify { padding: 12px 20px; border-radius: 12px; border: 1px solid var(--ink-12); background: var(--paper-2); font-weight: 600; font-size: 14px; cursor: pointer; white-space: nowrap; transition: background 0.15s, color 0.15s; }
        .btn-verify:hover:not(:disabled) { background: var(--ink); color: var(--paper); }
        .btn-verify.verified { background: var(--jade); color: #fff; border-color: var(--jade); }
        .btn-verify:disabled { opacity: 0.55; cursor: not-allowed; }
        .category-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .cat-card { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 8px; border: 1.5px solid var(--ink-12); border-radius: 12px; cursor: pointer; text-align: center; transition: border-color 0.15s, background 0.15s; }
        .cat-card:hover { border-color: var(--ink-60); }
        .cat-card.selected { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.05); }
        .cat-card input { position: absolute; opacity: 0; pointer-events: none; }
        .cat-emoji { font-size: 24px; line-height: 1; }
        .cat-name { font-size: 12px; font-weight: 500; color: var(--ink); line-height: 1.2; }
        .section-divider { margin: 32px 0 20px; padding-top: 24px; border-top: 1px solid var(--ink-12); }
        .section-divider h3 { font-family: var(--display); font-weight: 700; font-size: 18px; margin: 0 0 4px; color: var(--ink); }
        .section-divider p { font-size: 13px; color: var(--ink-60); margin: 0; }
        .actions { margin-top: 40px; display: flex; justify-content: flex-end; }
        .btn-next { background: var(--persimmon); color: #fff; border: 0; padding: 14px 28px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 15px; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s; }
        .btn-next:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        @media (max-width: 480px) {
          .category-grid { grid-template-columns: repeat(2, 1fr); }
          .brn-row { flex-direction: column; }
        }
      `}</style>
    </form>
  );
}