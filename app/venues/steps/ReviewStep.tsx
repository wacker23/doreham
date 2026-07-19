'use client';

import type { UiLanguage, VenueFormData } from '../lib/types';
import { CATEGORY_LABELS, WEEKDAY_LABELS, KOREAN_CITIES } from '../lib/types';
import { formatBusinessNumber } from '../lib/save';

type Props = {
  lang: UiLanguage;
  formData: VenueFormData;
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
  onBack: () => void;
  onEditStep: (step: number) => void;
};

export function ReviewStep({ lang, formData, submitting, error, onSubmit, onBack, onEditStep }: Props) {
  const cityLabel =
    KOREAN_CITIES.find((c) => c.code === formData.city)?.[lang] ?? formData.city ?? '';
  const catInfo = formData.category ? CATEGORY_LABELS[formData.category] : null;

  return (
    <div>
      <h2 className="step-title">
        {lang === 'ko' ? '내용 확인' : 'Review your submission'}
      </h2>
      <p className="step-sub">
        {lang === 'ko'
          ? '아래 내용을 확인하고 제출해주세요. 승인 후 도레함에 등록됩니다.'
          : "Review everything below. We'll email you within 48 hours after approval."}
      </p>

      {/* Business Info */}
      <div className="section">
        <div className="section-header">
          <h3>{lang === 'ko' ? '가게 정보' : 'Business info'}</h3>
          <button type="button" onClick={() => onEditStep(1)} className="edit-btn">
            {lang === 'ko' ? '수정' : 'Edit'}
          </button>
        </div>
        <div className="rows">
          <Row label={lang === 'ko' ? '가게 이름' : 'Business name'} value={formData.business_name_display} />
          <Row label={lang === 'ko' ? '사업자등록증상 이름' : 'Legal name'} value={formData.business_name_legal} />
          <Row
            label={lang === 'ko' ? '사업자등록번호' : 'Registration number'}
            value={formData.business_registration_number ? formatBusinessNumber(formData.business_registration_number) : undefined}
          />
          <Row
            label={lang === 'ko' ? '업종' : 'Category'}
            value={catInfo ? `${catInfo.emoji} ${lang === 'ko' ? catInfo.ko : catInfo.en}` : undefined}
          />
          {formData.business_opened_at && (
            <Row
              label={lang === 'ko' ? '개업일' : 'Opened'}
              value={formData.business_opened_at}
            />
          )}
          <Row
            label={lang === 'ko' ? '연락처 이메일' : 'Contact email'}
            value={formData.contact_email}
          />
          <Row
            label={lang === 'ko' ? '연락처 전화' : 'Contact phone'}
            value={formData.contact_phone}
          />
          {formData.contact_name && (
            <Row
              label={lang === 'ko' ? '담당자' : 'Contact person'}
              value={formData.contact_name}
            />
          )}
        </div>
      </div>

      {/* Location */}
      <div className="section">
        <div className="section-header">
          <h3>{lang === 'ko' ? '위치' : 'Location'}</h3>
          <button type="button" onClick={() => onEditStep(2)} className="edit-btn">
            {lang === 'ko' ? '수정' : 'Edit'}
          </button>
        </div>
        <div className="rows">
          {formData.zipcode && (
            <Row label={lang === 'ko' ? '우편번호' : 'Zip'} value={formData.zipcode} />
          )}
          <Row label={lang === 'ko' ? '도시' : 'City'} value={cityLabel} />
          {formData.district && (
            <Row label={lang === 'ko' ? '구/동' : 'District'} value={formData.district} />
          )}
          <Row label={lang === 'ko' ? '주소' : 'Address'} value={formData.address} />
        </div>
      </div>

      {/* Hours */}
      <div className="section">
        <div className="section-header">
          <h3>{lang === 'ko' ? '영업 시간' : 'Hours'}</h3>
          <button type="button" onClick={() => onEditStep(3)} className="edit-btn">
            {lang === 'ko' ? '수정' : 'Edit'}
          </button>
        </div>
        <div className="rows">
          {formData.hours && (['mon','tue','wed','thu','fri','sat','sun'] as const).map((d) => (
            <div key={d} className="row">
              <span className="label">{lang === 'ko' ? WEEKDAY_LABELS[d].ko : WEEKDAY_LABELS[d].en}</span>
              <span className="value">
                {formData.hours![d].closed
                  ? (lang === 'ko' ? '휴무' : 'Closed')
                  : `${formData.hours![d].open} — ${formData.hours![d].close}`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Description */}
      {(formData.description || formData.description_en || formData.per_person_cost_won || formData.discount_offer) && (
        <div className="section">
          <div className="section-header">
            <h3>{lang === 'ko' ? '소개 및 가격' : 'Description & pricing'}</h3>
            <button type="button" onClick={() => onEditStep(4)} className="edit-btn">
              {lang === 'ko' ? '수정' : 'Edit'}
            </button>
          </div>
          <div className="rows">
            {formData.description && (
              <Row label={lang === 'ko' ? '한국어 소개' : 'Korean description'} value={formData.description} multiline />
            )}
            {formData.description_en && (
              <Row label={lang === 'ko' ? '영어 소개' : 'English description'} value={formData.description_en} multiline />
            )}
            {formData.per_person_cost_won && (
              <Row
                label={lang === 'ko' ? '1인당 평균 비용' : 'Avg. cost per person'}
                value={`₩${formData.per_person_cost_won.toLocaleString()}`}
              />
            )}
            {formData.discount_offer && (
              <Row label={lang === 'ko' ? '할인 (KO)' : 'Discount (KO)'} value={formData.discount_offer} />
            )}
            {formData.discount_offer_en && (
              <Row label={lang === 'ko' ? '할인 (EN)' : 'Discount (EN)'} value={formData.discount_offer_en} />
            )}
          </div>
        </div>
      )}

      {/* Photos */}
      {formData.photo_files && formData.photo_files.length > 0 && (
        <div className="section">
          <div className="section-header">
            <h3>{lang === 'ko' ? `사진 (${formData.photo_files.length}장)` : `Photos (${formData.photo_files.length})`}</h3>
            <button type="button" onClick={() => onEditStep(5)} className="edit-btn">
              {lang === 'ko' ? '수정' : 'Edit'}
            </button>
          </div>
          <div className="photos-preview">
            {formData.photo_files.map((f, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={URL.createObjectURL(f)} alt={`Photo ${i + 1}`} className="preview-img" />
            ))}
          </div>
        </div>
      )}

      {/* Menu Items */}
      {formData.menu_items && formData.menu_items.length > 0 && (
        <div className="section">
          <div className="section-header">
            <h3>{lang === 'ko' ? `메뉴 (${formData.menu_items.length}개)` : `Menu (${formData.menu_items.length})`}</h3>
            <button type="button" onClick={() => onEditStep(6)} className="edit-btn">
              {lang === 'ko' ? '수정' : 'Edit'}
            </button>
          </div>
          <div className="menu-items">
            {formData.menu_items.map((item, i) => (
              <div key={i} className="menu-item">
                <span className="mi-name">
                  {item.name}
                  {item.is_signature && ' ⭐'}
                </span>
                {item.price_won && (
                  <span className="mi-price">₩{item.price_won.toLocaleString()}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      <div className="disclaimer">
        {lang === 'ko'
          ? '제출 후 관리자 검토를 거쳐 승인됩니다. 승인 완료 시 이메일로 알려드립니다. (보통 48시간 이내)'
          : "After submission, we review and approve manually. You'll get an email once approved (usually within 48 hours)."}
      </div>

      <div className="actions">
        <button type="button" className="btn-back" onClick={onBack} disabled={submitting}>
          {lang === 'ko' ? '← 이전' : '← Back'}
        </button>
        <button type="button" className="btn-submit" onClick={onSubmit} disabled={submitting}>
          {submitting
            ? (lang === 'ko' ? '제출 중… 사진 업로드 포함 시간이 걸릴 수 있습니다.' : 'Submitting… uploads may take a moment.')
            : (lang === 'ko' ? '제출하기' : 'Submit for review')}
        </button>
      </div>

      <style jsx>{`
        .step-title { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--ink); }
        .step-sub { font-size: 16px; color: var(--ink-60); margin: 0 0 32px; }
        .section { background: var(--paper-2); border-radius: 12px; padding: 20px; margin-bottom: 12px; }
        .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .section-header h3 { font-family: var(--display); font-weight: 700; font-size: 16px; margin: 0; color: var(--ink); }
        .edit-btn { background: transparent; border: 1px solid var(--ink-12); padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; cursor: pointer; color: var(--ink-60); transition: background 0.15s, color 0.15s; }
        .edit-btn:hover { background: var(--ink); color: var(--paper); }
        .rows { display: flex; flex-direction: column; gap: 6px; }
        .row { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
        .label { color: var(--ink-60); flex-shrink: 0; }
        .value { color: var(--ink); font-weight: 500; text-align: right; word-break: break-word; }
        .value.multiline { white-space: pre-wrap; text-align: left; }
        .photos-preview { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .preview-img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 8px; }
        .menu-items { display: flex; flex-direction: column; gap: 6px; }
        .menu-item { display: flex; justify-content: space-between; padding: 8px 12px; background: #fff; border-radius: 8px; font-size: 14px; }
        .mi-name { font-weight: 600; color: var(--ink); }
        .mi-price { color: var(--jade); font-weight: 700; }
        .error-banner { background: rgba(255, 106, 61, 0.1); color: var(--persimmon); border: 1px solid rgba(255, 106, 61, 0.25); padding: 12px 16px; border-radius: 12px; font-size: 14px; margin-bottom: 12px; font-weight: 500; }
        .disclaimer { background: rgba(15, 157, 119, 0.06); border: 1px solid rgba(15, 157, 119, 0.15); color: var(--ink); padding: 14px 18px; border-radius: 12px; font-size: 13px; margin-bottom: 24px; line-height: 1.5; }
        .actions { display: flex; justify-content: space-between; gap: 12px; }
        .btn-back { background: transparent; border: 1px solid var(--ink-12); padding: 12px 24px; border-radius: 999px; font-family: var(--body); font-weight: 600; font-size: 14px; color: var(--ink); cursor: pointer; }
        .btn-back:hover:not(:disabled) { background: var(--ink); color: var(--paper); }
        .btn-back:disabled, .btn-submit:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn-submit { background: var(--persimmon); color: #fff; border: 0; padding: 14px 32px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 15px; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s; }
        .btn-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
      `}</style>
    </div>
  );
}

function Row({ label, value, multiline }: { label: string; value?: string; multiline?: boolean }) {
  if (!value) return null;
  return (
    <div className={multiline ? 'row multiline' : 'row'}>
      <span className="label">{label}</span>
      <span className={multiline ? 'value multiline' : 'value'}>{value}</span>
      <style jsx>{`
        .row { display: flex; justify-content: space-between; gap: 12px; font-size: 14px; }
        .row.multiline { flex-direction: column; gap: 4px; }
        .label { color: var(--ink-60); flex-shrink: 0; }
        .value { color: var(--ink); font-weight: 500; text-align: right; word-break: break-word; }
        .value.multiline { white-space: pre-wrap; text-align: left; }
      `}</style>
    </div>
  );
}