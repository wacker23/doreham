'use client';

import { useState } from 'react';
import type { UiLanguage, VenueFormData, WeekHours, Weekday } from '../lib/types';
import { DEFAULT_HOURS, WEEKDAY_LABELS } from '../lib/types';

type Props = {
  lang: UiLanguage;
  initialData: Partial<VenueFormData>;
  onNext: (data: { hours: WeekHours }) => void;
  onBack: () => void;
};

const DAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function HoursStep({ lang, initialData, onNext, onBack }: Props) {
  const [hours, setHours] = useState<WeekHours>(initialData.hours ?? DEFAULT_HOURS);

  function updateDay(day: Weekday, changes: Partial<typeof hours.mon>) {
    setHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...changes },
    }));
  }

  function toggleClosed(day: Weekday) {
    const current = hours[day];
    if (current.closed) {
      updateDay(day, { closed: false, open: '09:00', close: '22:00' });
    } else {
      updateDay(day, { closed: true, open: undefined, close: undefined });
    }
  }

  function applyToAll() {
    // Copy Monday's hours to every other day
    const template = hours.mon;
    setHours({
      mon: template,
      tue: { ...template },
      wed: { ...template },
      thu: { ...template },
      fri: { ...template },
      sat: { ...template },
      sun: { ...template },
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onNext({ hours });
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="step-title">
        {lang === 'ko' ? '영업 시간' : 'Business hours'}
      </h2>
      <p className="step-sub">
        {lang === 'ko'
          ? '요일별 영업 시간을 알려주세요.'
          : 'Set your opening hours for each day.'}
      </p>

      <button type="button" className="btn-apply-all" onClick={applyToAll}>
        {lang === 'ko' ? '월요일 시간을 모든 요일에 적용' : "Apply Monday's hours to all days"}
      </button>

      <div className="days">
        {DAYS.map((day) => {
          const dayHours = hours[day];
          const label = WEEKDAY_LABELS[day];
          return (
            <div key={day} className={`day-row ${dayHours.closed ? 'closed' : ''}`}>
              <div className="day-name">
                {lang === 'ko' ? label.ko : label.en}
              </div>

              <label className="closed-toggle">
                <input
                  type="checkbox"
                  checked={dayHours.closed}
                  onChange={() => toggleClosed(day)}
                />
                <span>{lang === 'ko' ? '휴무' : 'Closed'}</span>
              </label>

              {!dayHours.closed && (
                <div className="times">
                  <input
                    type="time"
                    value={dayHours.open ?? '09:00'}
                    onChange={(e) => updateDay(day, { open: e.target.value })}
                    className="time-input"
                  />
                  <span className="dash">—</span>
                  <input
                    type="time"
                    value={dayHours.close ?? '22:00'}
                    onChange={(e) => updateDay(day, { close: e.target.value })}
                    className="time-input"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="actions">
        <button type="button" className="btn-back" onClick={onBack}>
          {lang === 'ko' ? '← 이전' : '← Back'}
        </button>
        <button type="submit" className="btn-next">
          {lang === 'ko' ? '다음 →' : 'Next →'}
        </button>
      </div>

      <style jsx>{`
        .step-title { font-family: var(--display); font-weight: 800; font-size: 28px; letter-spacing: -0.02em; margin: 0 0 8px; color: var(--ink); }
        .step-sub { font-size: 16px; color: var(--ink-60); margin: 0 0 20px; }
        .btn-apply-all { background: var(--paper-2); border: 1px solid var(--ink-12); padding: 10px 16px; border-radius: 999px; font-family: var(--body); font-weight: 600; font-size: 13px; color: var(--ink); cursor: pointer; margin-bottom: 20px; transition: background 0.15s; }
        .btn-apply-all:hover { background: var(--ink); color: var(--paper); }
        .days { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
        .day-row {
          display: grid;
          grid-template-columns: 100px auto 1fr;
          align-items: center;
          gap: 16px;
          padding: 12px 16px;
          background: #fff;
          border: 1px solid var(--ink-12);
          border-radius: 12px;
          transition: background 0.15s;
        }
        .day-row.closed { background: var(--paper-2); }
        .day-name { font-weight: 600; font-size: 15px; color: var(--ink); }
        .closed-toggle { display: flex; align-items: center; gap: 6px; font-size: 14px; color: var(--ink-60); cursor: pointer; user-select: none; }
        .closed-toggle input { accent-color: var(--persimmon); cursor: pointer; }
        .times { display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
        .time-input { padding: 8px 12px; border: 1px solid var(--ink-12); border-radius: 8px; font-family: var(--body); font-size: 14px; }
        .time-input:focus { outline: none; border-color: var(--persimmon); }
        .dash { color: var(--ink-60); }
        .actions { margin-top: 40px; display: flex; justify-content: space-between; gap: 12px; }
        .btn-back { background: transparent; border: 1px solid var(--ink-12); padding: 12px 24px; border-radius: 999px; font-family: var(--body); font-weight: 600; font-size: 14px; color: var(--ink); cursor: pointer; }
        .btn-back:hover { background: var(--ink); color: var(--paper); }
        .btn-next { background: var(--persimmon); color: #fff; border: 0; padding: 14px 28px; border-radius: 999px; font-family: var(--body); font-weight: 700; font-size: 15px; cursor: pointer; transition: transform 0.12s, box-shadow 0.12s; }
        .btn-next:hover { transform: translateY(-1px); box-shadow: 0 8px 22px rgba(255, 106, 61, 0.32); }
        @media (max-width: 480px) {
          .day-row { grid-template-columns: 1fr; gap: 8px; }
          .times { justify-content: flex-start; }
        }
      `}</style>
    </form>
  );
}