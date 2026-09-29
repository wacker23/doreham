'use client';

import { useEffect, useState } from 'react';
import { badge, levelByNumber } from '@/lib/points';
import type { ProfilePoints } from '@/lib/pointsTypes';

/** Level, points and earned badges on a profile. */
export function ProfileLevel({ userId, lang, isOwn }: { userId: string; lang: 'en' | 'ko'; isOwn: boolean }) {
  const ko = lang === 'ko';
  const [data, setData] = useState<ProfilePoints | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/points/profile/${userId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled) setData(j);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!data) return null;
  const lv = levelByNumber(data.level);

  return (
    <div className="pl">
      <a className="pl-level" href={isOwn ? '/leaderboard?tab=me' : '/leaderboard'}>
        <span className="pl-emoji" aria-hidden="true">{lv.emoji}</span>
        <span className="pl-text">
          <strong>{ko ? `${lv.ko} · 레벨 ${lv.n}` : `${lv.en} · Level ${lv.n}`}</strong>
          <span>
            {data.total.toLocaleString()} {ko ? '포인트' : 'points'} · {data.stats.quests} {ko ? '퀘스트' : data.stats.quests === 1 ? 'quest' : 'quests'}
          </span>
        </span>
        <span className="pl-arrow" aria-hidden="true">→</span>
      </a>
      {data.badges.length > 0 && (
        <div className="pl-badges" aria-label={ko ? '배지' : 'Badges'}>
          {data.badges.map((id) => {
            const b = badge(id);
            if (!b) return null;
            return (
              <span key={id} className="pl-badge" title={ko ? b.how_ko : b.how_en}>
                {b.emoji} {ko ? b.ko : b.en}
              </span>
            );
          })}
        </div>
      )}
      <style jsx>{`
        .pl { margin: 14px 0 16px; display: flex; flex-direction: column; gap: 8px; }
        .pl-level { display: flex; align-items: center; gap: 12px; background: linear-gradient(135deg, rgba(199, 184, 224, 0.3), rgba(245, 194, 199, 0.25)); border: 1px solid var(--ink-12); border-radius: 16px; padding: 10px 14px; text-decoration: none; color: var(--ink); }
        .pl-emoji { font-size: 32px; line-height: 1; }
        .pl-text { flex: 1; display: flex; flex-direction: column; font-size: 13px; color: var(--ink-60); }
        .pl-text strong { font-size: 15px; color: var(--ink); }
        .pl-arrow { color: var(--ink-60); font-weight: 700; }
        .pl-badges { display: flex; flex-wrap: wrap; gap: 6px; }
        .pl-badge { font-size: 12.5px; font-weight: 700; background: #fff; border: 1px solid rgba(255, 106, 61, 0.3); border-radius: 999px; padding: 4px 10px; color: var(--ink); }
      `}</style>
    </div>
  );
}
