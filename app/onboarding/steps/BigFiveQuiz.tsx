'use client';

import { useState } from 'react';
import type { UiLanguage } from '../lib/types';

/**
 * 20-item Big Five short-form quiz — Doreham custom version.
 */

type Trait = 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism';

type Question = {
  id: number;
  trait: Trait;
  reversed: boolean;
  en: string;
  ko: string;
};

const QUESTIONS: Question[] = [
  // Extraversion (4)
  { id: 1, trait: 'extraversion', reversed: false, en: 'I feel energized when I meet new people.', ko: '새로운 사람들을 만나면 에너지가 생긴다.' },
  { id: 2, trait: 'extraversion', reversed: true, en: 'I need quiet time alone to recharge.', ko: '혼자 조용한 시간을 보내야 힘이 난다.' },
  { id: 3, trait: 'extraversion', reversed: false, en: 'I usually start conversations, not wait for others to.', ko: '보통 내가 먼저 대화를 시작하는 편이다.' },
  { id: 4, trait: 'extraversion', reversed: true, en: 'In a group, I prefer to listen more than talk.', ko: '그룹에서는 말하기보다 듣는 편이 편하다.' },

  // Agreeableness (4)
  { id: 5, trait: 'agreeableness', reversed: false, en: 'When someone shares a problem, I feel it with them.', ko: '누군가 힘든 일을 이야기하면, 나도 함께 마음이 아프다.' },
  { id: 6, trait: 'agreeableness', reversed: true, en: 'I get annoyed by others more easily than most people.', ko: '나는 다른 사람들보다 쉽게 짜증이 나는 편이다.' },
  { id: 7, trait: 'agreeableness', reversed: false, en: 'I try to understand people before judging them.', ko: '판단하기 전에 사람을 이해하려고 노력한다.' },
  { id: 8, trait: 'agreeableness', reversed: true, en: 'I find it hard to trust strangers.', ko: '낯선 사람을 쉽게 믿기 어렵다.' },

  // Conscientiousness (4)
  { id: 9, trait: 'conscientiousness', reversed: false, en: 'I make plans and stick to them.', ko: '계획을 세우면 그대로 실천한다.' },
  { id: 10, trait: 'conscientiousness', reversed: true, en: 'I often leave things until the last minute.', ko: '일을 마지막 순간까지 미루는 편이다.' },
  { id: 11, trait: 'conscientiousness', reversed: false, en: 'My space (desk, room, phone) is usually organized.', ko: '내 공간(책상, 방, 휴대폰)은 대체로 정리되어 있다.' },
  { id: 12, trait: 'conscientiousness', reversed: true, en: 'I sometimes forget to reply to messages for days.', ko: '며칠 동안 메시지 답장을 잊어버릴 때가 있다.' },

  // Neuroticism (4)
  { id: 13, trait: 'neuroticism', reversed: false, en: 'Small things can affect my mood for hours.', ko: '작은 일에도 오래 기분이 흔들릴 때가 있다.' },
  { id: 14, trait: 'neuroticism', reversed: true, en: 'I stay calm even in stressful situations.', ko: '스트레스 상황에서도 평정을 유지하는 편이다.' },
  { id: 15, trait: 'neuroticism', reversed: false, en: 'I worry about things more than I should.', ko: '나는 필요 이상으로 걱정을 많이 하는 편이다.' },
  { id: 16, trait: 'neuroticism', reversed: true, en: 'When something bad happens, I bounce back quickly.', ko: '안 좋은 일이 있어도 금방 회복하는 편이다.' },

  // Openness (4)
  { id: 17, trait: 'openness', reversed: false, en: 'I love learning about how other people live.', ko: '다른 사람들이 어떻게 사는지 배우는 것을 좋아한다.' },
  { id: 18, trait: 'openness', reversed: true, en: 'I prefer familiar routines over trying new things.', ko: '새로운 시도보다 익숙한 방식이 편하다.' },
  { id: 19, trait: 'openness', reversed: false, en: 'I get excited by ideas, art, or unusual perspectives.', ko: '아이디어나 예술, 색다른 관점에 흥미를 느낀다.' },
  { id: 20, trait: 'openness', reversed: true, en: "I'd rather stick to what I know than experiment.", ko: '실험적인 것보다 아는 것을 선호한다.' },
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
          {lang === 'ko' ? `${answered} / ${total} 완료` : `${answered} of ${total} answered`}
        </div>
        <div className="quiz-progress-bar">
          <div className="quiz-progress-fill" style={{ width: `${(answered / total) * 100}%` }} />
        </div>
      </div>

      <div className="questions">
        {QUESTIONS.map((q, i) => (
          <div key={q.id} id={`q-${q.id}`} className="question">
            <div className="question-number">{lang === 'ko' ? `문 ${i + 1}` : `Q${i + 1}`}</div>
            <div className="question-text">{lang === 'ko' ? q.ko : q.en}</div>
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
        <button type="submit" className="btn-next" disabled={saving || answered < total}>
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
        .quiz-progress { margin-bottom: 32px; position: sticky; top: 68px; background: var(--paper-2); padding: 12px 0; z-index: 5; }
        .quiz-progress-text { font-size: 13px; font-weight: 600; color: var(--ink-60); margin-bottom: 6px; }
        .quiz-progress-bar { height: 4px; background: var(--ink-12); border-radius: 2px; overflow: hidden; }
        .quiz-progress-fill { height: 100%; background: var(--persimmon); transition: width 0.3s ease; }
        .questions { display: flex; flex-direction: column; gap: 24px; margin-bottom: 24px; }
        .question { background: #fff; border: 1px solid var(--ink-12); border-radius: 16px; padding: 20px; }
        .question-number { font-family: var(--display); font-weight: 700; font-size: 12px; color: var(--persimmon); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
        .question-text { font-size: 16px; font-weight: 500; color: var(--ink); line-height: 1.4; margin-bottom: 16px; }
        .likert { display: flex; flex-direction: column; gap: 6px; }
        .likert-option { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border: 1px solid var(--ink-12); border-radius: 10px; cursor: pointer; transition: border-color 0.12s, background 0.12s; }
        .likert-option:hover { border-color: var(--ink-60); }
        .likert-option.selected { border-color: var(--persimmon); background: rgba(255, 106, 61, 0.05); }
        .likert-option input { position: absolute; opacity: 0; pointer-events: none; }
        .likert-dot { width: 24px; height: 24px; border-radius: 50%; background: var(--paper-2); border: 1.5px solid var(--ink-12); display: grid; place-items: center; font-weight: 700; font-size: 12px; color: var(--ink-60); flex-shrink: 0; }
        .likert-option.selected .likert-dot { background: var(--persimmon); border-color: var(--persimmon); color: #fff; }
        .likert-label { font-size: 14px; color: var(--ink); }
        .err { padding: 12px 16px; border-radius: 12px; background: rgba(255, 106, 61, 0.1); color: var(--persimmon); border: 1px solid rgba(255, 106, 61, 0.25); font-size: 14px; font-weight: 500; margin-bottom: 16px; }
        .actions { display: flex; justify-content: space-between; gap: 12px; position: sticky; bottom: 0; background: var(--paper-2); padding: 20px 0 4px; border-top: 1px solid var(--ink-12); }
        .btn-back { background: transparent; border: 1px solid var(--ink-12); padding: 12px 24px; border-radius: 999px; font-family: var(--body); font-weight: 600; font-size: 14px; color: var(--ink); cursor: pointer; }
        .btn-back:hover:not(:disabled) { background: var(--ink); color: var(--paper); }
        .btn-next { background: var(--persimmon); color: #fff; border: 0; padding: 14px 28px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 15px; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s; }
        .btn-next:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        .btn-next:disabled, .btn-back:disabled { opacity: 0.55; cursor: not-allowed; }
      `}</style>
    </form>
  );
}