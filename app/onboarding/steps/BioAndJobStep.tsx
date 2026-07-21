'use client';

import { useState } from 'react';
import type { OnboardingFormData, UiLanguage } from '../lib/types';

type Props = {
  lang: UiLanguage;
  initialData: Partial<OnboardingFormData>;
  onNext: (data: { bio: string | null; job_title: string | null }) => void;
  onBack: () => void;
  saving: boolean;
};

export function BioAndJobStep({ lang, initialData, onNext, onBack, saving }: Props) {
  const [bio, setBio] = useState(initialData.bio ?? '');
  const [jobTitle, setJobTitle] = useState(initialData.job_title ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onNext({
      bio: bio.trim() ? bio.trim() : null,
      job_title: jobTitle.trim() ? jobTitle.trim() : null,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="step-title">
        {lang === 'ko' ? '자기소개 ✨' : 'About you ✨'}
      </h2>
      <p className="step-sub">
        {lang === 'ko'
          ? '두 가지 모두 선택 사항입니다. 나중에 언제든지 수정할 수 있습니다.'
          : "Both are optional. You can always edit these later."}
      </p>

      <div className="field">
        <label htmlFor="job_title">
          {lang === 'ko' ? '직업' : 'Job title'}
          <span className="optional-tag">
            {lang === 'ko' ? '(선택)' : '(optional)'}
          </span>
        </label>
        <input
          id="job_title"
          type="text"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder={lang === 'ko' ? '예: 대학원생, 디자이너, 엔지니어' : 'e.g. Grad student, Designer, Engineer'}
          maxLength={80}
          className="input"
          disabled={saving}
        />
        <span className="hint">
          {lang === 'ko' ? '무엇을 하시나요?' : 'What do you do?'}
        </span>
      </div>

      <div className="field">
        <label htmlFor="bio">
          {lang === 'ko' ? '자기소개' : 'About me'}
          <span className="optional-tag">
            {lang === 'ko' ? '(선택)' : '(optional)'}
          </span>
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={lang === 'ko'
            ? '자기 자신을 소개해주세요. 관심사, 취미, 좋아하는 것 등...'
            : "Introduce yourself. Interests, hobbies, favorite things..."}
          rows={6}
          maxLength={500}
          className="textarea"
          disabled={saving}
        />
        <div className="char-count">
          {bio.length} / 500
        </div>
        <span className="hint">
          {lang === 'ko'
            ? '다른 사용자들이 당신에 대해 알 수 있도록 도와주세요.'
            : "Help others get to know you a little."}
        </span>
      </div>

      <div className="actions">
        <button type="button" className="btn-back" onClick={onBack} disabled={saving}>
          {lang === 'ko' ? '← 이전' : '← Back'}
        </button>
        <button type="submit" className="btn-next" disabled={saving}>
          {saving
            ? (lang === 'ko' ? '저장 중…' : 'Saving…')
            : (lang === 'ko' ? '완료 →' : 'Finish →')}
        </button>
      </div>

      <style jsx>{`
        .step-title { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--ink); }
        .step-sub { font-size: 16px; color: var(--ink-60); margin: 0 0 32px; }
        .field { margin-bottom: 24px; }
        .field label { display: block; font-weight: 600; font-size: 14px; color: var(--ink); margin-bottom: 8px; }
        .optional-tag { font-weight: 500; color: var(--ink-60); font-size: 13px; margin-left: 6px; }
        .input, .textarea { width: 100%; padding: 12px 16px; border: 1px solid var(--ink-12); border-radius: 12px; background: #fff; font-family: var(--body); font-size: 15px; color: var(--ink); outline: none; transition: border-color 0.15s; }
        .input:focus, .textarea:focus { border-color: var(--persimmon); }
        .textarea { resize: vertical; min-height: 120px; line-height: 1.5; }
        .hint { display: block; margin-top: 6px; font-size: 13px; color: var(--ink-60); }
        .char-count { text-align: right; font-size: 12px; color: var(--ink-60); margin-top: 4px; }
        .actions { margin-top: 40px; display: flex; justify-content: space-between; gap: 12px; }
        .btn-back { background: transparent; border: 1px solid var(--ink-12); padding: 12px 24px; border-radius: 999px; font-family: var(--body); font-weight: 600; font-size: 14px; color: var(--ink); cursor: pointer; }
        .btn-back:hover { background: var(--ink); color: var(--paper); }
        .btn-next { background: var(--persimmon); color: #fff; border: 0; padding: 14px 28px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 15px; cursor: pointer; }
        .btn-next:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .btn-next:disabled { opacity: 0.55; cursor: not-allowed; }
      `}</style>
    </form>
  );
}
