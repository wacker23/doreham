'use client';

import { useState } from 'react';
import type {
  Gender,
  MbtiType,
  OnboardingFormData,
  SpokenLanguage,
  UiLanguage,
  ZodiacSign,
} from '../lib/types';
import { SPOKEN_LANGUAGES, MBTI_OPTIONS } from '../lib/types';
import { computeZodiacSign } from '../lib/zodiac';


type Props = {
  lang: UiLanguage;
  initialData: Partial<OnboardingFormData>;
  onNext: (data: {
    display_name: string;
    date_of_birth: string;
    gender: Gender;
    primary_language: SpokenLanguage;
    spoken_languages: SpokenLanguage[];
    mbti_type: MbtiType | null;
    zodiac_sign: ZodiacSign | null;
  }) => void;
  saving: boolean;
};

export function BasicInfoStep({ lang, initialData, onNext, saving }: Props) {
  const [displayName, setDisplayName] = useState(initialData.display_name ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(
    initialData.date_of_birth && initialData.date_of_birth !== '2000-01-01'
      ? initialData.date_of_birth
      : ''
  );
  const [gender, setGender] = useState<Gender | ''>(initialData.gender ?? '');
  const [primaryLang, setPrimaryLang] = useState<SpokenLanguage>(
    initialData.primary_language ?? lang
  );
  const [mbti, setMbti] = useState<MbtiType | ''>(initialData.mbti_type ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!displayName.trim()) {
      errs.display_name = lang === 'ko' ? '이름을 입력해주세요.' : 'Please enter your name.';
    } else if (displayName.trim().length > 40) {
      errs.display_name = lang === 'ko' ? '40자 이내로 입력해주세요.' : 'Please keep it under 40 characters.';
    }

    if (!dateOfBirth) {
      errs.date_of_birth = lang === 'ko' ? '생년월일을 선택해주세요.' : 'Please select your date of birth.';
    } else {
      const dob = new Date(dateOfBirth);
      const now = new Date();
      const ageMs = now.getTime() - dob.getTime();
      const ageYears = ageMs / (1000 * 60 * 60 * 24 * 365.25);
      if (ageYears < 19) {
        errs.date_of_birth = lang === 'ko' ? '만 19세 이상만 이용 가능합니다.' : 'You must be 19 or older to use Doreham.';
      } else if (ageYears > 120) {
        errs.date_of_birth = lang === 'ko' ? '유효한 생년월일을 입력해주세요.' : 'Please enter a valid date of birth.';
      }
    }

    if (!gender) {
      errs.gender = lang === 'ko' ? '성별을 선택해주세요.' : 'Please select your gender.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    onNext({
      display_name: displayName.trim(),
      date_of_birth: dateOfBirth,
      gender: gender as Gender,
      primary_language: primaryLang,
      spoken_languages: [primaryLang],
      mbti_type: mbti === '' ? null : mbti,
      zodiac_sign: computeZodiacSign(dateOfBirth),
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="step-title">
        {lang === 'ko' ? '기본 정보' : 'The basics'}
      </h2>
      <p className="step-sub">
        {lang === 'ko'
          ? '먼저 몇 가지 기본적인 정보만 알려주세요.'
          : "Let's start with a few basics."}
      </p>

      <div className="field">
        <label htmlFor="display_name">
          {lang === 'ko' ? '이름 또는 닉네임' : 'Name or nickname'}
        </label>
        <input
          id="display_name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={40}
          placeholder={lang === 'ko' ? '어떻게 불러드릴까요?' : 'What should we call you?'}
          className={errors.display_name ? 'input error' : 'input'}
          disabled={saving}
        />
        {errors.display_name && <span className="err">{errors.display_name}</span>}
        <span className="hint">
          {lang === 'ko'
            ? '실명이 아니어도 괜찮습니다. 사람들이 부를 이름을 적어주세요.'
            : "Doesn't have to be your legal name. Just what people will call you."}
        </span>
      </div>

      <div className="field">
        <label htmlFor="dob">
          {lang === 'ko' ? '생년월일' : 'Date of birth'}
        </label>
        <input
          id="dob"
          type="date"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          max={new Date().toISOString().split('T')[0]}
          className={errors.date_of_birth ? 'input error' : 'input'}
          disabled={saving}
        />
        {errors.date_of_birth && <span className="err">{errors.date_of_birth}</span>}
      </div>

      <div className="field">
        <label>{lang === 'ko' ? '성별' : 'Gender'}</label>
        <div className="radio-group">
          {(
            [
              ['female', lang === 'ko' ? '여성' : 'Female'],
              ['male', lang === 'ko' ? '남성' : 'Male'],
              ['non_binary', lang === 'ko' ? '논바이너리' : 'Non-binary'],
              ['prefer_not_to_say', lang === 'ko' ? '답변하지 않음' : 'Prefer not to say'],
            ] as [Gender, string][]
          ).map(([value, label]) => (
            <label key={value} className={`radio-option ${gender === value ? 'selected' : ''}`}>
              <input
                type="radio"
                name="gender"
                value={value}
                checked={gender === value}
                onChange={() => setGender(value)}
                disabled={saving}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {errors.gender && <span className="err">{errors.gender}</span>}
      </div>

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
            ? '가장 편안하게 사용하는 언어입니다. 나중에 다른 언어도 추가할 수 있습니다.'
            : 'The language you most comfortably use. You can add more later.'}
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
        .input { width: 100%; padding: 12px 16px; border: 1px solid var(--ink-12); border-radius: 12px; background: #fff; font-family: var(--body); font-size: 15px; color: var(--ink); outline: none; transition: border-color 0.15s; }
        .input:focus { border-color: var(--persimmon); }
        .input.error { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.03); }
        .input:disabled { opacity: 0.6; cursor: not-allowed; }
        .hint { display: block; margin-top: 6px; font-size: 13px; color: var(--ink-60); }
        .err { display: block; margin-top: 6px; font-size: 13px; color: var(--persimmon); font-weight: 500; }
        .radio-group { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .radio-option { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border: 1px solid var(--ink-12); border-radius: 12px; cursor: pointer; font-size: 14px; transition: border-color 0.15s, background 0.15s; user-select: none; }
        .radio-option:hover { border-color: var(--ink-60); }
        .radio-option.selected { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.05); }
        .radio-option input { margin: 0; accent-color: var(--persimmon); }
        .actions { margin-top: 40px; display: flex; justify-content: flex-end; }
        .btn-next { background: var(--persimmon); color: #fff; border: 0; padding: 14px 28px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 15px; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s, opacity 0.12s; }
        .btn-next:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .btn-next:disabled { opacity: 0.55; cursor: not-allowed; }
        @media (max-width: 480px) { .radio-group { grid-template-columns: 1fr; } }
      `}</style>
    </form>
  );
}