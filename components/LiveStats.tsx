'use client';

import { useEffect, useRef, useState } from 'react';

type Stats = {
  matches: number;
  completed: number;
  finished: number;
  success_rate: number | null;
  upcoming: number;
  updated_at: string;
};

type Lang = 'en' | 'ko';

const REFRESH_MS = 30_000;
const MIN_FINISHED_FOR_RATE = 5; // same rule as the server (lib/server/publicStats.ts)

/** Counts up smoothly (from 0 the first time) to the new value whenever it changes. */
function useCountUp(target: number, ms = 900) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const duration = reduce ? 0 : ms; // reduced motion: jump straight to the number
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = duration === 0 ? 1 : Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (target - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = target;
    };
  }, [target, ms]);
  return shown;
}

function Num({ value, suffix = '' }: { value: number; suffix?: string }) {
  const n = useCountUp(value);
  return <>{n.toLocaleString('en-US')}{suffix}</>;
}

/**
 * Homepage counter: matches made, meetups completed, success rate and meetups coming up,
 * refreshed every 30 seconds while the page is visible (paused in background tabs).
 */
export function LiveStats({ lang }: { lang: Lang }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function load() {
      try {
        const res = await fetch('/api/stats', { cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as Stats;
        if (alive) {
          setStats(body);
          setFailed(false);
        }
      } catch {
        if (alive) setFailed(true);
      }
    }
    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        if (document.visibilityState === 'visible') await load();
        if (alive) schedule();
      }, REFRESH_MS);
    }
    function onVisible() {
      if (document.visibilityState === 'visible') void load();
    }

    void load();
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Nothing to show if the very first load failed (no empty boxes on the homepage).
  if (!stats && failed) return null;

  const t = (en: string, ko: string) => (lang === 'ko' ? ko : en);
  const rateReady = stats?.success_rate != null;

  return (
    <div className="ls" aria-live="polite">
      <div className="wrap">
        <div className="ls-head">
          <span className="ls-live"><span className="ls-dot" aria-hidden="true" />{t('Live', '실시간')}</span>
          <h2>{t('Happening on Doreham', '지금 도레함에서는')}</h2>
        </div>

        <div className="ls-grid">
          <div className="ls-tile">
            <div className="ls-n">{stats ? <Num value={stats.matches} /> : '–'}</div>
            <div className="ls-l">{t('Matches made', '성사된 매칭')}</div>
            <div className="ls-s">{t('groups where everyone said yes', '모두가 수락한 그룹')}</div>
          </div>
          <div className="ls-tile">
            <div className="ls-n">{stats ? <Num value={stats.completed} /> : '–'}</div>
            <div className="ls-l">{t('Meetups completed', '완료된 만남')}</div>
            <div className="ls-s">{t('checked in together at the venue', '매장에서 함께 체크인')}</div>
          </div>
          <div className="ls-tile ls-accent">
            <div className="ls-n">
              {stats && rateReady ? <Num value={stats.success_rate as number} suffix="%" /> : stats ? t('Soon', '집계 중') : '–'}
            </div>
            <div className="ls-l">{t('Success rate', '만남 성공률')}</div>
            <div className="ls-s">
              {rateReady || !stats
                ? t('of finished matches met in person', '끝난 매칭 중 실제로 만난 비율')
                : t(
                    `shown after ${MIN_FINISHED_FOR_RATE} finished matches (${stats.finished} so far)`,
                    `끝난 매칭 ${MIN_FINISHED_FOR_RATE}건부터 표시 (지금 ${stats.finished}건)`,
                  )}
            </div>
          </div>
          <div className="ls-tile">
            <div className="ls-n">{stats ? <Num value={stats.upcoming} /> : '–'}</div>
            <div className="ls-l">{t('Coming up', '예정된 만남')}</div>
            <div className="ls-s">{t('meetups scheduled right now', '지금 날짜가 잡힌 만남')}</div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .ls { padding: 44px 0 52px; border-top: 1px solid var(--ink-12); background: var(--paper-2); }
        .ls-head { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 22px; }
        .ls-head h2 { font-family: var(--display); font-weight: 800; font-size: 26px; letter-spacing: -0.02em; margin: 0; color: var(--ink); }
        .ls-live { display: inline-flex; align-items: center; gap: 8px; padding: 5px 12px; border-radius: 999px; background: rgba(15, 157, 119, 0.1); color: var(--jade); font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
        .ls-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--jade); box-shadow: 0 0 0 0 rgba(15, 157, 119, 0.5); animation: ls-pulse 1.8s ease-out infinite; }
        @keyframes ls-pulse { 0% { box-shadow: 0 0 0 0 rgba(15, 157, 119, 0.5); } 70% { box-shadow: 0 0 0 9px rgba(15, 157, 119, 0); } 100% { box-shadow: 0 0 0 0 rgba(15, 157, 119, 0); } }
        @media (prefers-reduced-motion: reduce) { .ls-dot { animation: none; } }
        .ls-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
        .ls-tile { background: #fff; border: 1px solid var(--ink-12); border-radius: 18px; padding: 20px 18px; min-width: 0; }
        .ls-accent { border-color: rgba(255, 106, 61, 0.35); background: linear-gradient(160deg, rgba(255, 106, 61, 0.07), #fff 60%); }
        .ls-n { font-family: var(--display); font-weight: 800; font-size: 40px; line-height: 1.05; letter-spacing: -0.03em; color: var(--ink); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
        .ls-accent .ls-n { color: var(--persimmon); }
        .ls-l { margin-top: 8px; font-weight: 700; font-size: 14px; color: var(--ink); }
        .ls-s { margin-top: 4px; font-size: 12.5px; line-height: 1.45; color: var(--ink-60); }
        @media (max-width: 900px) { .ls-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 380px) { .ls-n { font-size: 32px; } .ls-tile { padding: 16px 14px; } }
      `}</style>
    </div>
  );
}
