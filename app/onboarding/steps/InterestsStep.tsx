'use client';

import { useState } from 'react';
import type { ActivityCategory, OnboardingFormData, UiLanguage } from '../lib/types';

const CATEGORIES: {
  code: ActivityCategory;
  emoji: string;
  en: { title: string; desc: string };
  ko: { title: string; desc: string };
}[] = [
  { code: 'conversation_coffee', emoji: '☕', en: { title: 'Coffee & talk', desc: 'Cafés, deep conversations' }, ko: { title: '커피와 대화', desc: '카페, 깊은 이야기' } },
  { code: 'board_games_casual', emoji: '🎲', en: { title: 'Games & fun', desc: 'Board games, mafia, cards' }, ko: { title: '보드게임 · 놀이', desc: '보드게임, 마피아, 카드' } },
  { code: 'workshops_creative', emoji: '🏺', en: { title: 'Make something', desc: 'Pottery, baking, crafts' }, ko: { title: '함께 만들기', desc: '도자기, 베이킹, 공예' } },
  { code: 'active_outdoor', emoji: '🥾', en: { title: 'Outdoors', desc: 'Hikes, walks, easy trails' }, ko: { title: '바깥으로', desc: '등산, 산책, 트레킹' } },
  { code: 'food_dining', emoji: '🍜', en: { title: 'Food & dining', desc: 'Restaurants, tastings' }, ko: { title: '맛집 · 식사', desc: '동네 맛집, 푸드 투어' } },
  { code: 'learning_culture', emoji: '📚', en: { title: 'Learning & culture', desc: 'Bookshops, museums, talks' }, ko: { title: '배움 · 문화', desc: '서점, 박물관, 강연' } },
  { code: 'nature_calm', emoji: '🌿', en: { title: 'Nature & calm', desc: 'Parks, gardens, slow walks' }, ko: { title: '자연 · 산책', desc: '공원, 정원, 느긋한 산책' } },
  { code: 'escape_puzzles', emoji: '🧩', en: { title: 'Escape & puzzles', desc: 'Escape rooms, mystery games' }, ko: { title: '방탈출 · 퍼즐', desc: '방탈출, 퍼즐 카페' } },
  { code: 'movies_music_shows', emoji: '🎬', en: { title: 'Movies & shows', desc: 'Cinema, concerts, exhibits' }, ko: { title: '영화 · 공연', desc: '영화관, 콘서트, 전시' } },
  { code: 'career_networking', emoji: '💼', en: { title: 'Career & networking', desc: 'Meetups, tech talks' }, ko: { title: '커리어 · 네트워킹', desc: '밋업, 테크 토크' } },
  { code: 'volunteering_community', emoji: '🤝', en: { title: 'Volunteering', desc: 'Community events, giving back' }, ko: { title: '봉사 · 커뮤니티', desc: '봉사 활동, 커뮤니티' } },
  { code: 'nightlife_social', emoji: '🌙', en: { title: 'Nightlife', desc: 'Bars, night markets, hangouts' }, ko: { title: '나이트라이프', desc: '바, 야시장, 저녁 모임' } },
];

const MIN_INTERESTS = 3;
const MAX_INTERESTS = 8;

type Props = {
  lang: UiLanguage;
  initialData: Partial<OnboardingFormData>;
  onNext: (data: { activity_preferences: ActivityCategory[] }) => void;
  onBack: () => void;
  saving: boolean;
};

export function InterestsStep({ lang, initialData, onNext, onBack, saving }: Props) {
  const [selected, setSelected] = useState<ActivityCategory[]>(initialData.activity_preferences ?? []);
  const [error, setError] = useState<string | null>(null);

  function toggle(code: ActivityCategory) {
    setError(null);
    if (selected.includes(code)) {
      setSelected(selected.filter((c) => c !== code));
    } else {
      if (selected.length >= MAX_INTERESTS) {
        setError(lang === 'ko' ? `최대 ${MAX_INTERESTS}개까지 선택할 수 있습니다.` : `You can pick up to ${MAX_INTERESTS}.`);
        return;
      }
      setSelected([...selected, code]);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.length < MIN_INTERESTS) {
      setError(lang === 'ko' ? `최소 ${MIN_INTERESTS}개 이상 선택해주세요.` : `Please pick at least ${MIN_INTERESTS}.`);
      return;
    }
    setError(null);
    onNext({ activity_preferences: selected });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="step-title">
        {lang === 'ko' ? '무엇을 좋아하세요?' : 'What do you enjoy?'}
      </h2>
      <p className="step-sub">
        {lang === 'ko' ? `${MIN_INTERESTS}~${MAX_INTERESTS}개를 선택하세요. 관심사가 겹치는 사람과 매칭됩니다.` : `Pick ${MIN_INTERESTS}–${MAX_INTERESTS}. We'll match you with people who share these.`}
      </p>

      <div className="counter">
        <span className={selected.length >= MIN_INTERESTS ? 'ok' : 'warn'}>{selected.length}</span>
        <span className="counter-total"> / {MAX_INTERESTS}</span>
      </div>

      <div className="interests-grid">
        {CATEGORIES.map((cat) => {
          const isSelected = selected.includes(cat.code);
          const copy = lang === 'ko' ? cat.ko : cat.en;
          return (
            <button
              type="button"
              key={cat.code}
              className={`interest-card ${isSelected ? 'selected' : ''}`}
              onClick={() => toggle(cat.code)}
              disabled={saving}
              aria-pressed={isSelected}
            >
              <span className="emoji">{cat.emoji}</span>
              <span className="title">{copy.title}</span>
              <span className="desc">{copy.desc}</span>
              {isSelected && (
                <span className="check" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 14 14">
                    <path d="M3 7l3 3 5-6" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && <span className="err">{error}</span>}

      <div className="actions">
        <button type="button" className="btn-back" onClick={onBack} disabled={saving}>
          {lang === 'ko' ? '← 이전' : '← Back'}
        </button>
        <button type="submit" className="btn-next" disabled={saving}>
          {saving ? (lang === 'ko' ? '저장 중…' : 'Saving…') : (lang === 'ko' ? '다음 →' : 'Next →')}
        </button>
      </div>

      <style jsx>{`
        .step-title { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--ink); }
        .step-sub { font-size: 16px; color: var(--ink-60); margin: 0 0 20px; }
        .counter { font-family: var(--display); font-weight: 800; font-size: 15px; margin-bottom: 16px; }
        .counter .ok { color: var(--jade); }
        .counter .warn { color: var(--ink-60); }
        .counter-total { color: var(--ink-60); font-weight: 500; }
        .interests-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px; }
        .interest-card { position: relative; background: #fff; border: 1.5px solid var(--ink-12); border-radius: 14px; padding: 16px 14px 14px; cursor: pointer; text-align: left; font-family: var(--body); display: flex; flex-direction: column; gap: 4px; transition: transform 0.2s, border-color 0.15s, background 0.15s; }
        .interest-card:hover:not(:disabled) { border-color: var(--ink-60); transform: translateY(-1px); }
        .interest-card.selected { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.05); }
        .interest-card:disabled { opacity: 0.55; cursor: not-allowed; }
        .interest-card .emoji { font-size: 24px; line-height: 1; margin-bottom: 4px; }
        .interest-card .title { font-weight: 700; font-size: 15px; color: var(--ink); }
        .interest-card .desc { font-size: 12.5px; color: var(--ink-60); line-height: 1.35; }
        .interest-card .check { position: absolute; top: 10px; right: 10px; width: 22px; height: 22px; border-radius: 50%; background: var(--persimmon); color: #fff; display: grid; place-items: center; }
        .err { display: block; margin: -8px 0 12px; font-size: 13px; color: var(--persimmon); font-weight: 500; }
        .actions { margin-top: 24px; display: flex; justify-content: space-between; gap: 12px; }
        .btn-back { background: transparent; border: 1px solid var(--ink-12); padding: 12px 24px; border-radius: 999px; font-family: var(--body); font-weight: 600; font-size: 14px; color: var(--ink); cursor: pointer; }
        .btn-back:hover:not(:disabled) { background: var(--ink); color: var(--paper); }
        .btn-next { background: var(--persimmon); color: #fff; border: 0; padding: 14px 28px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 15px; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s; }
        .btn-next:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .btn-next:disabled, .btn-back:disabled { opacity: 0.55; cursor: not-allowed; }
        @media (max-width: 480px) { .interests-grid { grid-template-columns: 1fr; } }
      `}</style>
    </form>
  );
}