'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type Language = 'en' | 'ko';

type LifestyleOption = {
  code: string;
  en: string;
  ko: string;
  emoji: string;
};

const OPTIONS: Record<string, LifestyleOption[]> = {
  exercise_frequency: [
    { code: 'never', en: 'Never', ko: '전혀 안 해요', emoji: '🛋️' },
    { code: 'occasionally', en: 'Occasionally', ko: '가끔', emoji: '🚶' },
    {
      code: 'weekly_1_2',
      en: '1–2 times a week',
      ko: '주 1–2회',
      emoji: '🏃',
    },
    {
      code: 'weekly_3_4',
      en: '3–4 times a week',
      ko: '주 3–4회',
      emoji: '💪',
    },
    {
      code: 'daily',
      en: 'Almost every day',
      ko: '거의 매일',
      emoji: '🔥',
    },
  ],

  education_level: [
    {
      code: 'high_school',
      en: 'High school',
      ko: '고등학교',
      emoji: '🏫',
    },
    {
      code: 'college_student',
      en: 'College student',
      ko: '대학생',
      emoji: '📖',
    },
    {
      code: 'bachelors',
      en: "Bachelor's",
      ko: '학사',
      emoji: '🎓',
    },
    {
      code: 'masters',
      en: "Master's",
      ko: '석사',
      emoji: '🎓',
    },
    {
      code: 'doctoral',
      en: 'Doctoral',
      ko: '박사',
      emoji: '👩‍🔬',
    },
    {
      code: 'other',
      en: 'Other',
      ko: '기타',
      emoji: '✨',
    },
  ],

  drinking_habits: [
    {
      code: 'no',
      en: "Don't drink",
      ko: '술 안 마심',
      emoji: '🚫',
    },
    {
      code: 'occasionally',
      en: 'Occasionally',
      ko: '가끔',
      emoji: '🍷',
    },
    {
      code: 'socially',
      en: 'Socially',
      ko: '사교적으로',
      emoji: '🥂',
    },
    {
      code: 'regularly',
      en: 'Regularly',
      ko: '자주',
      emoji: '🍺',
    },
    {
      code: 'prefer_not_to_say',
      en: 'Prefer not to say',
      ko: '답변 안 함',
      emoji: '—',
    },
  ],

  smoking_habits: [
    {
      code: 'non_smoker',
      en: 'Non-smoker',
      ko: '비흡연자',
      emoji: '🚭',
    },
    {
      code: 'occasionally',
      en: 'Occasionally',
      ko: '가끔',
      emoji: '🚬',
    },
    {
      code: 'regular',
      en: 'Regular',
      ko: '일상 흡연',
      emoji: '🚬',
    },
    {
      code: 'former',
      en: 'Former smoker',
      ko: '금연 중',
      emoji: '💨',
    },
    {
      code: 'vape',
      en: 'Vape',
      ko: '전자담배',
      emoji: '💨',
    },
    {
      code: 'prefer_not_to_say',
      en: 'Prefer not to say',
      ko: '답변 안 함',
      emoji: '—',
    },
  ],

  children_status: [
    {
      code: 'no_children',
      en: 'No children',
      ko: '자녀 없음',
      emoji: '👤',
    },
    {
      code: 'have_children',
      en: 'Have children',
      ko: '자녀 있음',
      emoji: '👨‍👩‍👧',
    },
    {
      code: 'expecting',
      en: 'Expecting',
      ko: '임신 중',
      emoji: '🤰',
    },
    {
      code: 'prefer_not_to_say',
      en: 'Prefer not to say',
      ko: '답변 안 함',
      emoji: '—',
    },
  ],
};

type LifestyleGroupProps = {
  label: string;
  value: string;
  setValue: (value: string) => void;
  options: LifestyleOption[];
  lang: Language;
};

function LifestyleGroup({
  label,
  value,
  setValue,
  options,
  lang,
}: LifestyleGroupProps) {
  return (
    <div className="lifestyle-group">
      <div className="lifestyle-group-label">{label}</div>

      <div className="lifestyle-chips">
        {options.map((option) => {
          const isSelected = value === option.code;

          return (
            <button
              key={option.code}
              type="button"
              className={`lifestyle-chip ${
                isSelected ? 'lifestyle-chip-selected' : ''
              }`}
              onClick={() => setValue(option.code)}
              aria-pressed={isSelected}
            >
              <span className="chip-emoji" aria-hidden="true">
                {option.emoji}
              </span>

              <span>{lang === 'ko' ? option.ko : option.en}</span>
            </button>
          );
        })}
      </div>

      <style jsx>{`
        .lifestyle-group {
          margin-bottom: 20px;
        }

        .lifestyle-group-label {
          margin-bottom: 10px;
          color: var(--ink);
          font-size: 14px;
          font-weight: 700;
        }

        .lifestyle-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .lifestyle-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 42px;
          padding: 10px 16px;
          appearance: none;
          background: var(--paper-2);
          border: 2px solid transparent;
          border-radius: 999px;
          color: var(--ink);
          font-family: var(--body);
          font-size: 13px;
          font-weight: 600;
          line-height: 1.2;
          white-space: nowrap;
          cursor: pointer;
          transition:
            border-color 0.15s ease,
            background-color 0.15s ease,
            color 0.15s ease,
            transform 0.15s ease;
        }

        .lifestyle-chip:hover {
          border-color: var(--ink-60);
        }

        .lifestyle-chip:focus-visible {
          outline: 3px solid rgba(255, 106, 61, 0.25);
          outline-offset: 2px;
        }

        .lifestyle-chip-selected {
          border-color: var(--persimmon);
          background: rgba(255, 106, 61, 0.08);
          color: var(--persimmon);
        }

        .lifestyle-chip-selected:hover {
          border-color: var(--persimmon);
        }

        .chip-emoji {
          flex-shrink: 0;
          font-size: 15px;
          line-height: 1;
        }

        @media (max-width: 640px) {
          .lifestyle-group {
            margin-bottom: 18px;
          }

          .lifestyle-chip {
            min-height: 40px;
            padding: 9px 13px;
            font-size: 12px;
          }
        }
      `}</style>
    </div>
  );
}

type Props = {
  profile: {
    id: string;
    exercise_frequency: string | null;
    education_level: string | null;
    drinking_habits: string | null;
    smoking_habits: string | null;
    children_status: string | null;
  };
  lang: Language;
  onClose: () => void;
  onSaved: () => void;
};

export function EditLifestyleModal({
  profile,
  lang,
  onClose,
  onSaved,
}: Props) {
  const [exercise, setExercise] = useState(
    profile.exercise_frequency ?? '',
  );
  const [education, setEducation] = useState(
    profile.education_level ?? '',
  );
  const [drinking, setDrinking] = useState(
    profile.drinking_habits ?? '',
  );
  const [smoking, setSmoking] = useState(
    profile.smoking_habits ?? '',
  );
  const [children, setChildren] = useState(
    profile.children_status ?? '',
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          exercise_frequency: exercise || null,
          education_level: education || null,
          drinking_habits: drinking || null,
          smoking_habits: smoking || null,
          children_status: children || null,
        })
        .eq('id', profile.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      onSaved();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : lang === 'ko'
            ? '저장 중 오류가 발생했습니다.'
            : 'Something went wrong while saving.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lifestyle-modal-title"
      >
        <button
          type="button"
          className="close-btn"
          onClick={onClose}
          disabled={saving}
          aria-label={lang === 'ko' ? '닫기' : 'Close'}
        >
          ×
        </button>

        <h2 id="lifestyle-modal-title" className="modal-title">
          {lang === 'ko' ? '라이프스타일 편집' : 'Edit lifestyle'}
        </h2>

        <p className="modal-subtitle">
          {lang === 'ko'
            ? '각 항목에 가장 잘 맞는 답변을 선택하세요.'
            : 'Choose the answer that fits you best.'}
        </p>

        <form onSubmit={handleSave}>
          <LifestyleGroup
            label={lang === 'ko' ? '운동' : 'Exercise'}
            value={exercise}
            setValue={setExercise}
            options={OPTIONS.exercise_frequency}
            lang={lang}
          />

          <LifestyleGroup
            label={lang === 'ko' ? '학력' : 'Education'}
            value={education}
            setValue={setEducation}
            options={OPTIONS.education_level}
            lang={lang}
          />

          <LifestyleGroup
            label={lang === 'ko' ? '음주' : 'Drinking'}
            value={drinking}
            setValue={setDrinking}
            options={OPTIONS.drinking_habits}
            lang={lang}
          />

          <LifestyleGroup
            label={lang === 'ko' ? '흡연' : 'Smoking'}
            value={smoking}
            setValue={setSmoking}
            options={OPTIONS.smoking_habits}
            lang={lang}
          />

          <LifestyleGroup
            label={lang === 'ko' ? '자녀' : 'Children'}
            value={children}
            setValue={setChildren}
            options={OPTIONS.children_status}
            lang={lang}
          />

          {error && (
            <div className="error-msg" role="alert">
              {error}
            </div>
          )}

          <div className="actions">
            <button
              type="button"
              className="btn-cancel"
              onClick={onClose}
              disabled={saving}
            >
              {lang === 'ko' ? '취소' : 'Cancel'}
            </button>

            <button
              type="submit"
              className="btn-save"
              disabled={saving}
            >
              {saving
                ? lang === 'ko'
                  ? '저장 중…'
                  : 'Saving…'
                : lang === 'ko'
                  ? '저장'
                  : 'Save'}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(30, 34, 48, 0.5);
          backdrop-filter: blur(4px);
        }

        .modal-card {
          position: relative;
          width: 100%;
          max-width: 900px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 48px;
          background: #ffffff;
          border-radius: 28px;
          box-shadow: 0 24px 70px rgba(30, 34, 48, 0.2);
        }

        .close-btn {
          position: absolute;
          top: 22px;
          right: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          padding: 0;
          appearance: none;
          background: transparent;
          border: 0;
          border-radius: 50%;
          color: var(--ink-60);
          font-family: Arial, sans-serif;
          font-size: 32px;
          font-weight: 300;
          line-height: 1;
          cursor: pointer;
          transition:
            background-color 0.15s ease,
            color 0.15s ease;
        }

        .close-btn:hover:not(:disabled) {
          background: var(--paper-2);
          color: var(--ink);
        }

        .close-btn:focus-visible {
          outline: 3px solid rgba(255, 106, 61, 0.25);
          outline-offset: 2px;
        }

        .modal-title {
          margin: 0 0 8px;
          color: var(--ink);
          font-family: var(--display);
          font-size: 32px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .modal-subtitle {
          margin: 0 0 28px;
          color: var(--ink-60);
          font-family: var(--body);
          font-size: 15px;
          line-height: 1.5;
        }

        .error-msg {
          margin-top: 16px;
          padding: 12px 14px;
          background: rgba(255, 106, 61, 0.1);
          border: 1px solid rgba(255, 106, 61, 0.25);
          border-radius: 12px;
          color: var(--persimmon);
          font-size: 13px;
        }

        .actions {
          display: flex;
          justify-content: flex-end;
          gap: 14px;
          margin-top: 30px;
        }

        .btn-cancel,
        .btn-save {
          min-width: 126px;
          min-height: 54px;
          padding: 13px 28px;
          border-radius: 999px;
          font-family: var(--body);
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease,
            background-color 0.15s ease;
        }

        .btn-cancel {
          background: transparent;
          border: 1px solid var(--ink-12);
          color: var(--ink);
        }

        .btn-cancel:hover:not(:disabled) {
          background: var(--paper-2);
        }

        .btn-save {
          background: var(--persimmon);
          border: 0;
          color: #ffffff;
        }

        .btn-save:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32);
        }

        .btn-cancel:focus-visible,
        .btn-save:focus-visible {
          outline: 3px solid rgba(255, 106, 61, 0.25);
          outline-offset: 2px;
        }

        .btn-save:disabled,
        .btn-cancel:disabled,
        .close-btn:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        @media (max-width: 640px) {
          .modal-backdrop {
            align-items: flex-end;
            padding: 10px;
          }

          .modal-card {
            max-height: 94vh;
            padding: 32px 20px 24px;
            border-radius: 24px;
          }

          .close-btn {
            top: 12px;
            right: 12px;
          }

          .modal-title {
            padding-right: 44px;
            font-size: 26px;
          }

          .modal-subtitle {
            margin-bottom: 24px;
            font-size: 14px;
          }

          .actions {
            position: sticky;
            bottom: -24px;
            z-index: 2;
            margin: 24px -20px -24px;
            padding: 16px 20px 24px;
            background: #ffffff;
            border-top: 1px solid var(--ink-12);
          }

          .btn-cancel,
          .btn-save {
            flex: 1;
            min-width: 0;
            min-height: 48px;
            padding: 11px 18px;
            font-size: 14px;
          }
        }
      `}</style>
    </div>
  );
}
