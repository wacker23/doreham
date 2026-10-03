'use client';

import { useState } from 'react';

/**
 * Birthday as three dropdowns (year · month · day) instead of a calendar.
 *
 * Phone calendars open on today's month and make you page back ~25 years, and some ignore `max`.
 * Dropdowns open the phone's own wheel/list picker, so picking 1998 is one flick.
 *
 * `value`/`onChange` use 'YYYY-MM-DD'. Until all three parts are picked, onChange gets ''.
 */

export const MIN_AGE = 19;
const MAX_AGE = 100;

const pad = (n: number) => String(n).padStart(2, '0');

/** Latest birthday allowed today: the same rule as the database (date_of_birth <= today - 19 years). */
export function latestBirthday(minAge = MIN_AGE, now = new Date()): string {
  const y = now.getUTCFullYear() - minAge;
  const m = now.getUTCMonth() + 1;
  // Feb 29 today with a non-leap target year: the database rolls back to Feb 28.
  const d = Math.min(now.getUTCDate(), daysInMonth(y, m));
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** 'YYYY-MM-DD' that is a real date, at least 19 and at most 100 years ago. */
export function isAllowedBirthday(dob: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return false;
  const [y, m, d] = dob.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return false;
  return dob <= latestBirthday(MIN_AGE, now) && dob > latestBirthday(MAX_AGE + 1, now);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function split(value: string): { y: string; m: string; d: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? { y: match[1], m: String(Number(match[2])), d: String(Number(match[3])) } : { y: '', m: '', d: '' };
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function BirthdayPicker({
  value,
  onChange,
  lang,
  idPrefix = 'dob',
}: {
  value: string;
  onChange: (v: string) => void;
  lang: 'en' | 'ko';
  idPrefix?: string;
}) {
  const ko = lang === 'ko';
  const [parts, setParts] = useState(() => split(value));

  const newest = new Date().getUTCFullYear() - MIN_AGE;
  const years = Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, i) => newest - i);
  const dayCount = daysInMonth(Number(parts.y) || 2000, Number(parts.m) || 1); // 2000: leap year, so Feb shows 29 until a year is picked

  function pick(key: 'y' | 'm' | 'd', v: string) {
    const next = { ...parts, [key]: v };
    // 31 → 30 when switching to a shorter month (or Feb 29 → 28 in a non-leap year).
    if (next.d && next.m) {
      const max = daysInMonth(Number(next.y) || 2000, Number(next.m));
      if (Number(next.d) > max) next.d = String(max);
    }
    setParts(next);
    onChange(next.y && next.m && next.d ? `${next.y}-${pad(Number(next.m))}-${pad(Number(next.d))}` : '');
  }

  const complete = Boolean(parts.y && parts.m && parts.d);
  const full = complete ? `${parts.y}-${pad(Number(parts.m))}-${pad(Number(parts.d))}` : '';
  const tooYoung = complete && full > latestBirthday();

  return (
    <div className="bp">
      <div className="bp-row" role="group" aria-label={ko ? '생년월일' : 'Date of birth'}>
        <label className="bp-field bp-year" htmlFor={`${idPrefix}-y`}>
          <span className="bp-label">{ko ? '년' : 'Year'}</span>
          <select id={`${idPrefix}-y`} value={parts.y} onChange={(e) => pick('y', e.target.value)} className={parts.y ? '' : 'empty'}>
            <option value="" disabled>{ko ? '연도' : 'Year'}</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </label>
        <label className="bp-field" htmlFor={`${idPrefix}-m`}>
          <span className="bp-label">{ko ? '월' : 'Month'}</span>
          <select id={`${idPrefix}-m`} value={parts.m} onChange={(e) => pick('m', e.target.value)} className={parts.m ? '' : 'empty'}>
            <option value="" disabled>{ko ? '월' : 'Month'}</option>
            {MONTHS_EN.map((name, i) => (
              <option key={name} value={String(i + 1)}>{ko ? `${i + 1}월` : name}</option>
            ))}
          </select>
        </label>
        <label className="bp-field" htmlFor={`${idPrefix}-d`}>
          <span className="bp-label">{ko ? '일' : 'Day'}</span>
          <select id={`${idPrefix}-d`} value={parts.d} onChange={(e) => pick('d', e.target.value)} className={parts.d ? '' : 'empty'}>
            <option value="" disabled>{ko ? '일' : 'Day'}</option>
            {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
              <option key={d} value={String(d)}>{ko ? `${d}일` : d}</option>
            ))}
          </select>
        </label>
      </div>
      {tooYoung && (
        <p className="bp-err" role="alert">
          {ko ? `도레함은 만 ${MIN_AGE}세 이상부터 가입할 수 있어요.` : `You need to be ${MIN_AGE} or older to join Doreham.`}
        </p>
      )}
      <style jsx>{`
        .bp-row { display: grid; grid-template-columns: 1.25fr 1fr 1fr; gap: 8px; }
        .bp-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .bp-label { font-size: 12.5px; font-weight: 700; color: var(--ink-60); padding-left: 4px; }
        select {
          width: 100%;
          min-width: 0;
          appearance: none;
          -webkit-appearance: none;
          padding: 14px 32px 14px 14px;
          border: 1px solid var(--ink-12);
          border-radius: 12px;
          background-color: #fff;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='%23777' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 12px center;
          font-family: var(--body);
          font-size: 16px; /* 16px stops iPhone zooming in on tap */
          font-weight: 600;
          color: var(--ink);
          outline: none;
          cursor: pointer;
        }
        select.empty { color: var(--ink-60); font-weight: 500; }
        select:focus { border-color: var(--persimmon); }
        .bp-err { margin: 10px 0 0; font-size: 14px; color: var(--persimmon); font-weight: 600; }
        @media (max-width: 360px) {
          .bp-row { gap: 6px; }
          select { padding: 13px 24px 13px 10px; background-position: right 8px center; }
        }
      `}</style>
    </div>
  );
}
