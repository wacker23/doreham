'use client';

import { useState } from 'react';
import type { UiLanguage } from '../lib/types';

/**
 * 20-item IPIP Big Five short-form (4 items per trait, balanced positive/negative keying).
 * Based on public-domain IPIP items (Goldberg, 1992).
 * Each response is 1-5 (Strongly Disagree to Strongly Agree).
 * Reverse-keyed items are subtracted from 6 before averaging.
 * Final score per trait = mean of 4 items, normalized to 0.0-1.0.
 */

type Trait = 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism';

type Question = {
  id: number;
  trait: Trait;
  reversed: boolean;  // true = higher agreement = LOWER trait score
  en: string;
  ko: string;
};

const QUESTIONS: Question[] = [
  // Extraversion (4)
  { id: 1, trait: 'extraversion', reversed: false, en: 'I am the life of the party.', ko: '나는 파티의 분위기 메이커다.' },
  { id: 2, trait: 'extraversion', reversed: true, en: "I don't talk a lot.", ko: '나는 말수가 적은 편이다.' },
  { id: 3, trait: 'extraversion', reversed: false, en: 'I feel comfortable around people.', ko: '나는 사람들 주변에서 편안함을 느낀다.' },
  { id: 4, trait: 'extraversion', reversed: true, en: 'I keep in the background.', ko: '나는 뒤에 물러나 있는 편이다.' },

  // Agreeableness (4)
  { id: 5, trait: 'agreeableness', reversed: true, en: "I feel little concern for others.", ko: '나는 다른 사람들에게 별로 관심이 없다.' },
  { id: 6, trait: 'agreeableness', reversed: false, en: "I am interested in people.", ko: '나는 사람들에게 관심이 있다.' },
  { id: 7, trait: 'agreeableness', reversed: true, en: 'I insult people.', ko: '나는 사람들을 무시하는 말을 자주 한다.' },
  { id: 8, trait: 'agreeableness', reversed: false, en: "I sympathize with others' feelings.", ko: '나는 다른 사람의 감정에 공감한다.' },

  // Conscientiousness (4)
  { id: 9, trait: 'conscientiousness', reversed: false, en: 'I am always prepared.', ko: '나는 항상 준비되어 있다.' },
  { id: 10, trait: 'conscientiousness', reversed: true, en: 'I leave my belongings around.', ko: '나는 물건을 아무 데나 두는 편이다.' },
  { id: 11, trait: 'conscientiousness', reversed: false, en: 'I pay attention to details.', ko: '나는 세부 사항에 신경 쓴다.' },
  { id: 12, trait: 'conscientiousness', reversed: true, en: 'I make a mess of things.', ko: '나는 일을 엉망으로 만드는 편이다.' },

  // Neuroticism (4)
  { id: 13, trait: 'neuroticism', reversed: false, en: 'I get stressed out easily.', ko: '나는 쉽게 스트레스를 받는다.' },
  { id: 14, trait: 'neuroticism', reversed: true, en: 'I am relaxed most of the time.', ko: '나는 대부분 여유롭다.' },
  { id: 15, trait: 'neuroticism', reversed: false, en: 'I worry about things.', ko: '나는 이런저런 걱정을 많이 한다.' },
  { id: 16, trait: 'neuroticism', reversed: true, en: 'I seldom feel blue.', ko: '나는 우울해지는 일이 거의 없다.' },

  // Openness (4)
  { id: 17, trait: 'openness', reversed: false, en: 'I have a rich vocabulary.', ko: '나는 어휘력이 풍부하다.' },
  { id: 18, trait: 'openness', reversed: true, en: "I am not interested in abstract ideas.", ko: '나는 추상적인 아이디어에는 관심이 없다.' },
  { id: 19, trait: 'openness', reversed: false, en: 'I have a vivid imagination.', ko: '나는 상상력이 풍부하다.' },
  { id: 20, trait: 'openness', reversed: true, en: 'I have difficulty understanding abstract ideas.', ko: '나는 추상적인 개념을 이해하기 어렵다.' },
];

const LIKERT_LABELS = {
  en: [
    { value: 1, label: 'Strongly disagree' },
    { value: 2, label: 'Disagree' },
    { value: 3, label: 'Neutral' },
    { value: 4, label: 'Agree' },
    { value: 5, label: 'Strongly agree' },
  ],
  ko: [
    { value: 1, label: '전혀 그렇지 않다' },
    { value: 2, label: '그렇지 않다' },
    { value: 3, label: '보통이다' },
    { value: 4, label: '그렇다' },
    { value: 5, label: '매우 그렇다' },
  ],
};

/**
 * Score each trait as a value from 0.0 to 1.0.
 * Formula: for each trait's 4 items, take raw score (1-5) and reverse if needed (6 - raw).
 * Sum them, divide by 20 (max possible = 4×5) to get 0.0-1.0.
 */
function computeBigFiveScores(answers: Record<number, number>): {
  big_five_openness: number;
  big_five_conscientiousness: number;
  big_five_extraversion: number;
  big_five_agreeableness: number;
  big_five_neuroticism: number;
} {
  const traitTotals: Record<Trait, number> = {
    openness: 0,
    conscientiousness: 0,
    extraversion: 0,
    agreeableness: 0,
    neuroticism: 0,
  };

  for (const q of QUESTIONS) {
    const raw = answers[q.id];
    const scored = q.reversed ? 6 - raw : raw;
    traitTotals[q.trait] += scored;
  }

  // Each trait has 4 items, max sum = 20, min sum = 4.
  // Normalize to 0.0-1.0: (sum - 4) / (20 - 4) = (sum - 4) / 16
  const normalize = (sum: number) => Math.round(((sum - 4) / 16) * 100) / 100;

  return {
    big_five_openness: normalize(traitTotals.openness),
    big_five_conscientiousness: normalize(traitTotals.conscientiousness),
    big_five_extraversion: normalize(traitTotals.extraversion),
    big_five_agreeableness: normalize(traitTotals.agreeableness),
    big_five_neuroticism: normalize(traitTotals.neuroticism),
  };
}

type Props = {
  lang: UiLanguage;
  onNext: (scores: {
    big_five_openness: number;
    big_five_conscientiousness: number;
    big_five_extraversion: number;
    big_five_agreeableness: number;
    big_five_neuroticism: number;
  }) => void;
  onBack: () => void;
  saving: boolean;
};

export function BigFiveQuiz({ lang, onNext, onBack, saving }: Props) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [error, setError] = useState<string | null>(null);

  const answered = Object.keys(answers).length;
  const total = QUESTIONS.length;

  function setAnswer(questionId: number, value: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (answered < total) {
      setError(
        lang === 'ko'
          ? `모든 질문에 답해주세요. (${answered}/${total})`
          : `Please answer all questions. (${answered}/${total})`
      );
      // Scroll to first unanswered
      const firstUnanswered = QUESTIONS.find((q) => !(q.id in answers));
      if (firstUnanswered) {
        document.getElementById(`q-${firstUnanswered.id}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
      return;
    }

    const scores = computeBigFiveScores(answers);
    onNext(scores);
  }

  const labels = LIKERT_LABELS[lang];

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="step-title">
        {lang === 'ko' ? '자기 자신을 알아볼 시간' : "A quick personality check"}
      </h2>
      <p className="step-sub">
        {lang === 'ko'
          ? '20개의 짧은 문항입니다. 정답은 없어요 — 매칭을 위해 사용됩니다.'
          : "20 quick questions. No right answers — this helps us match you well."}
      </p>

      <div className="quiz-progress">
        <div className="quiz-progress-text">
          {lang === 'ko'
            ? `${answered} / ${total} 완료`
            : `${answered} of ${total} answered`}
        </div>
        <div className="quiz-progress-bar">
          <div
            className="quiz-progress-fill"
            style={{ width: `${(answered / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="questions">
        {QUESTIONS.map((q, i) => (
          <div key={q.id} id={`q-${q.id}`} className="question">
            <div className="question-number">
              {lang === 'ko' ? `문 ${i + 1}` : `Q${i + 1}`}
            </div>
            <div className="question-text">
              {lang === 'ko' ? q.ko : q.en}
            </div>
            <div className="likert" role="radiogroup" aria-label={q.en}>
              {labels.map((opt) => (
                <label
                  key={opt.value}
                  className={`likert-option ${answers[q.id] === opt.value ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name={`q_${q.id}`}
                    value={opt.value}
                    checked={answers[q.id] === opt.value}
                    onChange={() => setAnswer(q.id, opt.value)}
                    disabled={saving}
                  />
                  <span className="likert-dot">{opt.value}</span>
                  <span className="likert-label">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && <div className="err">{error}</div>}

      <div className="actions">
        <button type="button" className="btn-back" onClick={onBack} disabled={saving}>
          {lang === 'ko' ? '← 이전' : '← Back'}
        </button>
        <button
          type="submit"
          className="btn-next"
          disabled={saving || answered < total}
        >
          {saving
            ? (lang === 'ko' ? '저장 중…' : 'Saving…')
            : answered < total
              ? (lang === 'ko' ? `${total - answered}개 남음` : `${total - answered} left`)
              : (lang === 'ko' ? '완료 →' : 'Finish →')}
        </button>
      </div>

      <style jsx>{`
        .step-title { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--ink); }
        .step-sub { font-size: 16px; color: var(--ink-60); margin: 0 0 24px; }

        .quiz-progress {
          margin-bottom: 32px;
          position: sticky;
          top: 68px;
          background: var(--paper-2);
          padding: 12px 0;
          z-index: 5;
        }
        .quiz-progress-text {
          font-size: 13px;
          font-weight: 600;
          color: var(--ink-60);
          margin-bottom: 6px;
        }
        .quiz-progress-bar {
          height: 4px;
          background: var(--ink-12);
          border-radius: 2px;
          overflow: hidden;
        }
        .quiz-progress-fill {
          height: 100%;
          background: var(--persimmon);
          transition: width 0.3s ease;
        }

        .questions {
          display: flex;
          flex-direction: column;
          gap: 24px;
          margin-bottom: 24px;
        }
        .question {
          background: #fff;
          border: 1px solid var(--ink-12);
          border-radius: 16px;
          padding: 20px;
        }
        .question-number {
          font-family: var(--display);
          font-weight: 700;
          font-size: 12px;
          color: var(--persimmon);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 8px;
        }
        .question-text {
          font-size: 16px;
          font-weight: 500;
          color: var(--ink);
          line-height: 1.4;
          margin-bottom: 16px;
        }

        .likert {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .likert-option {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          border: 1px solid var(--ink-12);
          border-radius: 10px;
          cursor: pointer;
          transition: border-color 0.12s, background 0.12s;
        }
        .likert-option:hover { border-color: var(--ink-60); }
        .likert-option.selected {
          border-color: var(--persimmon);
          background: rgba(255, 106, 61, 0.05);
        }
        .likert-option input { position: absolute; opacity: 0; pointer-events: none; }
        .likert-dot {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: var(--paper-2);
          border: 1.5px solid var(--ink-12);
          display: grid;
          place-items: center;
          font-weight: 700;
          font-size: 12px;
          color: var(--ink-60);
          flex-shrink: 0;
        }
        .likert-option.selected .likert-dot {
          background: var(--persimmon);
          border-color: var(--persimmon);
          color: #fff;
        }
        .likert-label {
          font-size: 14px;
          color: var(--ink);
        }

        .err {
          padding: 12px 16px;
          border-radius: 12px;
          background: rgba(255, 106, 61, 0.1);
          color: var(--persimmon);
          border: 1px solid rgba(255, 106, 61, 0.25);
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 16px;
        }
        .actions {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          position: sticky;
          bottom: 0;
          background: var(--paper-2);
          padding: 20px 0 4px;
          border-top: 1px solid var(--ink-12);
        }
        .btn-back { background: transparent; border: 1px solid var(--ink-12); padding: 12px 24px; border-radius: 999px; font-family: var(--body); font-weight: 600; font-size: 14px; color: var(--ink); cursor: pointer; }
        .btn-back:hover:not(:disabled) { background: var(--ink); color: var(--paper); }
        .btn-next { background: var(--persimmon); color: #fff; border: 0; padding: 14px 28px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 15px; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s; }
        .btn-next:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .btn-next:disabled, .btn-back:disabled { opacity: 0.55; cursor: not-allowed; }
      `}</style>
    </form>
  );
}