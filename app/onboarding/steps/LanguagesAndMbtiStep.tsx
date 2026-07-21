'use client';

import { useState } from 'react';
import type {
  MbtiType,
  OnboardingFormData,
  SpokenLanguage,
  UiLanguage,
} from '../lib/types';
import { SPOKEN_LANGUAGES, MBTI_OPTIONS } from '../lib/types';

type Props = {
  lang: UiLanguage;
  initialData: Partial<OnboardingFormData>;
  onNext: (data: {
    primary_language: SpokenLanguage;
    spoken_languages: SpokenLanguage[];
    mbti_type: MbtiType | null;
  }) => void;
  saving: boolean;
};

export function LanguagesAndMbtiStep({ lang, initialData, onNext, saving }: Props) {
  const [primaryLang, setPrimaryLang] = useState<SpokenLanguage>(
    initialData.primary_language ?? lang
  );
  const [spokenLangs, setSpokenLangs] = useState<SpokenLanguage[]>(
    initialData.spoken_languages ?? [initialData.primary_language ?? lang]
  );
  const [otherLangText, setOtherLangText] = useState('');
  const [mbti, setMbti] = useState<MbtiType | ''>(initialData.mbti_type ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function toggleSpokenLang(code: SpokenLanguage) {
    setSpokenLangs((prev) => {
      if (prev.includes(code)) return prev.filter((l) => l !== code);
      return [...prev, code];
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (spokenLangs.length === 0) {
      errs.spoken_languages = lang === 'ko' ? '최소 1개의 언어를 선택해주세요.' : 'Select at least one language.';
    }

    // Ensure primary is in spoken
    let finalSpoken = spokenLangs;
    if (!spokenLangs.includes(primaryLang)) {
      finalSpoken = [primaryLang, ...spokenLangs];
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // If user selected "other" and typed something, replace 'other' with their text
    let finalSpokenWithCustom = [...finalSpoken];
    if (finalSpokenWithCustom.includes('other') && otherLangText.trim()) {
      finalSpokenWithCustom = finalSpokenWithCustom.filter((l) => l !== 'other');
      finalSpokenWithCustom.push(otherLangText.trim() as SpokenLanguage);
    }

    onNext({
      primary_language: primaryLang,
      spoken_languages: finalSpokenWithCustom,
      mbti_type: mbti === '' ? null : (mbti as MbtiType),
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="step-title">
        {lang === 'ko' ? '언어와 MBTI' : 'Languages & MBTI'}
      </h2>
      <p className="step-sub">
        {lang === 'ko'
          ? '어떤 언어로 소통이 편한지 알려주세요.'
          : "Let us know which languages you're comfortable in."}
      </p>

      <div className="field">
        <label htmlFor="primary_lang">
          {lang === 'ko' ? '주 사용 언어' : 'Primary language'}
        </label>
        <select
          id="primary_lang"
          value={primaryLang}
          onChange={(e) => setPrimaryLang(e.target.value as SpokenLanguage)}
          className="input"
          disabled={saving}
        >
          {SPOKEN_LANGUAGES.map((l) => {
            const displayLabel =
              l.code === 'en' || l.code === 'ko'
                ? lang === 'ko' ? l.ko : l.en
                : lang === 'ko' ? `${l.ko} (${l.native})` : `${l.en} (${l.native})`;
            return (
              <option key={l.code} value={l.code}>
                {displayLabel}
              </option>
            );
          })}
        </select>
        <span className="hint">
          {lang === 'ko'
            ? '가장 편안하게 사용하는 언어입니다.'
            : 'The language you most comfortably use.'}
        </span>
      </div>

      <div className="field">
        <label>
          {lang === 'ko' ? '구사 가능한 언어 (복수 선택)' : 'Other languages you speak (multi-select)'}
        </label>
        <div className="langs-grid">
          {SPOKEN_LANGUAGES.map((l) => {
            const isSelected = spokenLangs.includes(l.code);
            const displayLabel =
              l.code === 'en' || l.code === 'ko'
                ? lang === 'ko' ? l.ko : l.en
                : lang === 'ko' ? `${l.ko}` : `${l.en}`;
            return (
              <button
                key={l.code}
                type="button"
                className={`lang-chip ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleSpokenLang(l.code)}
                disabled={saving}
              >
                {displayLabel}
              </button>
            );
          })}
        </div>
        {errors.spoken_languages && <span className="err">{errors.spoken_languages}</span>}
        {spokenLangs.includes('other' as SpokenLanguage) && (
          <input
            type="text"
            value={otherLangText}
            onChange={(e) => setOtherLangText(e.target.value)}
            placeholder={lang === 'ko' ? '어떤 언어인가요? (예: 스와힐리어)' : 'Which language? (e.g. Swahili)'}
            className="input"
            style={{ marginTop: 10 }}
            maxLength={30}
            disabled={saving}
          />
        )}
        <span className="hint">
          {lang === 'ko'
            ? '기본 언어는 자동으로 포함됩니다.'
            : 'Primary language is auto-included.'}
        </span>
      </div>

      <div className="field">
        <label htmlFor="mbti">
          {lang === 'ko' ? 'MBTI ' : 'MBTI '}
          <span className="optional-tag">
            {lang === 'ko' ? '(선택)' : '(optional)'}
          </span>
        </label>
        <select
          id="mbti"
          value={mbti}
          onChange={(e) => setMbti(e.target.value as MbtiType | '')}
          className="input"
          disabled={saving}
        >
          <option value="">
            {lang === 'ko' ? '선택하지 않음' : "I'd rather not say"}
          </option>
          {MBTI_OPTIONS.map((opt) => (
            <option key={opt.code} value={opt.code}>
              {lang === 'ko' ? opt.ko : opt.en}
            </option>
          ))}
        </select>
        <span className="hint">
          {lang === 'ko'
            ? 'MBTI를 아신다면 알려주세요. 프로필에 표시됩니다.'
            : 'If you know your MBTI, share it. It shows on your profile.'}
        </span>
      </div>

      <div className="actions">
        <button type="submit" className="btn-next" disabled={saving}>
          {saving
            ? (lang === 'ko' ? '저장 중…' : 'Saving…')
            : (lang === 'ko' ? '다음 →' : 'Next →')}
        </button>
      </div>

      <style jsx>{`
        .step-title { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--ink); }
        .step-sub { font-size: 16px; color: var(--ink-60); margin: 0 0 32px; }
        .field { margin-bottom: 24px; }
        .field label { display: block; font-weight: 600; font-size: 14px; color: var(--ink); margin-bottom: 8px; }
        .optional-tag { font-weight: 500; color: var(--ink-60); font-size: 13px; }
        .input { width: 100%; padding: 12px 16px; border: 1px solid var(--ink-12); border-radius: 12px; background: #fff; font-family: var(--body); font-size: 15px; color: var(--ink); outline: none; }
        .input:focus { border-color: var(--persimmon); }
        .hint { display: block; margin-top: 6px; font-size: 13px; color: var(--ink-60); }
        .err { display: block; margin-top: 6px; font-size: 13px; color: var(--persimmon); font-weight: 500; }
        .langs-grid { display: flex; gap: 6px; flex-wrap: wrap; }
        .lang-chip { background: #fff; border: 1px solid var(--ink-12); padding: 8px 14px; border-radius: 999px; font-family: var(--body); font-size: 13px; font-weight: 600; color: var(--ink); cursor: pointer; transition: border-color 0.15s, background 0.15s; }
        .lang-chip:hover { border-color: var(--ink-60); }
        .lang-chip.selected { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.08); color: var(--persimmon); }
        .actions { margin-top: 40px; display: flex; justify-content: flex-end; }
        .btn-next { background: var(--persimmon); color: #fff; border: 0; padding: 14px 28px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 15px; cursor: pointer; }
        .btn-next:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .btn-next:disabled { opacity: 0.55; cursor: not-allowed; }
      `}</style>
    </form>
  );
}
