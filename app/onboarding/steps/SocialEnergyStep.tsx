'use client';

import { useState } from 'react';
import type { OnboardingFormData, SocialEnergyPref, UiLanguage } from '../lib/types';

const OPTIONS: {
  code: SocialEnergyPref;
  emoji: string;
  en: { title: string; desc: string };
  ko: { title: string; desc: string };
}[] = [
  {
    code: 'wants_conversation_starter',
    emoji: '🙋',
    en: {
      title: 'I like when someone else leads the conversation',
      desc: "I'm happy to join in, but I appreciate when others open the door.",
    },
    ko: {
      title: '누군가 먼저 대화를 이끌어주면 좋아요',
      desc: '대화에 참여하는 건 좋아하지만, 먼저 시작해주는 사람이 있으면 편해요.',
    },
  },
  {
    code: 'matches_my_energy',
    emoji: '🤝',
    en: {
      title: 'I want people at my same energy level',
      desc: 'A group where everyone brings similar vibes feels most comfortable.',
    },
    ko: {
      title: '비슷한 에너지의 사람들과 함께하고 싶어요',
      desc: '모두가 비슷한 분위기일 때 가장 편안해요.',
    },
  },
  {
    code: 'no_preference',
    emoji: '✨',
    en: {
      title: "Either is fine — I go with the flow",
      desc: "Introverts, extroverts, whoever — I'm easy either way.",
    },
    ko: {
      title: '상관없어요 — 어떤 분위기든 좋아요',
      desc: '내향적이든 외향적이든, 누구와도 잘 지낼 수 있어요.',
    },
  },
];

type Props = {
  lang: UiLanguage;
  initialData: Partial<OnboardingFormData>;
  onNext: (data: { social_energy: SocialEnergyPref }) => void;
  onBack: () => void;
  saving: boolean;
};

export function SocialEnergyStep({ lang, initialData, onNext, onBack, saving }: Props) {
  const [selected, setSelected] = useState<SocialEnergyPref | ''>(
    initialData.social_energy ?? ''
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError(lang === 'ko' ? '옵션을 선택해주세요.' : 'Please pick one.');
      return;
    }
    setError(null);
    onNext({ social_energy: selected });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="step-title">
        {lang === 'ko' ? '어떤 그룹이 편해요?' : "What group vibe fits you?"}
      </h2>
      <p className="step-sub">
        {lang === 'ko'
          ? '이 답변으로 잘 맞는 사람들과 그룹을 만들어 드립니다.'
          : "We'll use this to put you in groups that feel right."}
      </p>

      <div className="options">
        {OPTIONS.map((opt) => {
          const copy = lang === 'ko' ? opt.ko : opt.en;
          const isSelected = selected === opt.code;
          return (
            <label
              key={opt.code}
              className={`option-card ${isSelected ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name="social_energy"
                value={opt.code}
                checked={isSelected}
                onChange={() => {
                  setSelected(opt.code);
                  setError(null);
                }}
                disabled={saving}
              />
              <span className="emoji">{opt.emoji}</span>
              <div className="option-text">
                <span className="option-title">{copy.title}</span>
                <span className="option-desc">{copy.desc}</span>
              </div>
              {isSelected && (
                <span className="check" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </label>
          );
        })}
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
        .step-sub { font-size: 16px; color: var(--ink-60); margin: 0 0 28px; }
        .options { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
        .option-card {
          position: relative;
          display: flex;
          gap: 14px;
          padding: 18px 20px;
          border: 1.5px solid var(--ink-12);
          border-radius: 16px;
          background: #fff;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s, transform 0.15s;
        }
        .option-card:hover { border-color: var(--ink-60); transform: translateY(-1px); }
        .option-card.selected {
          border-color: var(--persimmon);
          background: rgba(255, 106, 61, 0.05);
        }
        .option-card input { position: absolute; opacity: 0; pointer-events: none; }
        .option-card .emoji { font-size: 28px; flex-shrink: 0; }
        .option-text { display: flex; flex-direction: column; gap: 4px; }
        .option-title { font-weight: 700; font-size: 15px; color: var(--ink); line-height: 1.35; }
        .option-desc { font-size: 13.5px; color: var(--ink-60); line-height: 1.4; }
        .check {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--persimmon);
          color: #fff;
          display: grid;
          place-items: center;
        }
        .err { display: block; margin: -8px 0 12px; font-size: 13px; color: var(--persimmon); font-weight: 500; }
        .actions { margin-top: 24px; display: flex; justify-content: space-between; gap: 12px; }
        .btn-back { background: transparent; border: 1px solid var(--ink-12); padding: 12px 24px; border-radius: 999px; font-family: var(--body); font-weight: 600; font-size: 14px; color: var(--ink); cursor: pointer; }
        .btn-back:hover:not(:disabled) { background: var(--ink); color: var(--paper); }
        .btn-next { background: var(--persimmon); color: #fff; border: 0; padding: 14px 28px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 15px; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s; }
        .btn-next:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .btn-next:disabled, .btn-back:disabled { opacity: 0.55; cursor: not-allowed; }
      `}</style>
    </form>
  );
}