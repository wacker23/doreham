'use client';

import { useEffect, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { levelByNumber } from '@/lib/points';
import { perkText, type Redemption } from '@/lib/pointsTypes';

/**
 * What a member shows at the counter: the perk, who they are, the venue's code of the day
 * and a live clock, so staff can tell a live screen from an old screenshot.
 */
export function PerkRedeemSheet({ lang, r, onClose }: { lang: 'en' | 'ko'; r: Redemption; onClose: () => void }) {
  const ko = lang === 'ko';
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const t = perkText(r.perk, lang);
  const lv = levelByNumber(r.member.level);
  const clock = now.toLocaleTimeString(ko ? 'ko-KR' : 'en-US', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const date = now.toLocaleDateString(ko ? 'ko-KR' : 'en-US', { timeZone: 'Asia/Seoul', weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="pr-back" role="dialog" aria-modal="true" aria-label={ko ? '혜택 사용' : 'Use perk'}>
      <div className="pr">
        <div className="pr-venue">{r.venue.name}</div>
        <div className="pr-title">{t.title}</div>
        {t.details && <div className="pr-details">{t.details}</div>}

        <div className="pr-member">
          <Avatar name={r.member.display_name} url={r.member.photo_url} size={52} />
          <div>
            <div className="pr-name">{r.member.display_name}</div>
            <div className="pr-lv">
              {lv.emoji} {ko ? `도레함 ${lv.ko}` : `Doreham ${lv.en}`}
            </div>
          </div>
        </div>

        <div className="pr-code-label">{ko ? '오늘의 코드' : "Today's code"}</div>
        <div className="pr-code" aria-label={r.code.split('').join(' ')}>
          {r.code}
        </div>
        <div className="pr-clock">
          <span className="dot" aria-hidden="true" /> {date} · {clock}
        </div>

        <p className="pr-note">
          {ko
            ? '직원에게 이 화면을 보여 주세요. 코드는 매일 바뀌고, 가게의 “내 가게” 화면에 같은 코드가 보여요.'
            : "Show this screen to staff. The code changes every day and matches the one on the venue's dashboard."}
        </p>
        {r.already_used_today && (
          <p className="pr-again">{ko ? '오늘 이미 사용한 혜택이에요. 같은 화면을 다시 보여 드려요.' : "You already used this perk today. Here's the same screen again."}</p>
        )}
        <button className="pr-close" onClick={onClose}>
          {ko ? '닫기' : 'Done'}
        </button>
      </div>
      <style jsx>{`
        .pr-back { position: fixed; inset: 0; z-index: 90; background: rgba(30, 34, 48, 0.55); display: flex; align-items: center; justify-content: center; padding: 16px; }
        .pr { width: 100%; max-width: 420px; background: #fff; border-radius: 26px; padding: 24px 22px; text-align: center; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25); max-height: 94vh; overflow-y: auto; }
        .pr-venue { font-size: 13px; font-weight: 800; color: var(--ink-60); text-transform: uppercase; letter-spacing: 0.05em; }
        .pr-title { font-family: var(--display); font-weight: 800; font-size: 24px; line-height: 1.2; margin: 6px 0 2px; color: var(--ink); }
        .pr-details { font-size: 14px; color: var(--ink-60); }
        .pr-member { display: flex; gap: 12px; align-items: center; justify-content: center; margin: 18px 0 8px; text-align: left; }
        .pr-name { font-weight: 800; font-size: 17px; color: var(--ink); }
        .pr-lv { font-size: 13.5px; color: var(--ink-60); font-weight: 600; }
        .pr-code-label { font-size: 12px; font-weight: 800; color: var(--ink-60); margin-top: 10px; text-transform: uppercase; letter-spacing: 0.06em; }
        .pr-code { font-family: var(--display); font-weight: 800; font-size: 64px; letter-spacing: 0.18em; color: var(--persimmon); line-height: 1.1; margin-left: 0.18em; }
        .pr-clock { display: inline-flex; align-items: center; gap: 8px; font-variant-numeric: tabular-nums; font-weight: 700; font-size: 15px; color: var(--ink); background: var(--paper-2); border-radius: 999px; padding: 6px 14px; margin-top: 6px; }
        .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--jade); animation: blink 1s infinite; }
        @keyframes blink { 50% { opacity: 0.25; } }
        .pr-note { font-size: 12.5px; color: var(--ink-60); margin: 14px 0 0; line-height: 1.5; }
        .pr-again { font-size: 12.5px; color: var(--ink); background: #fff7ed; border-radius: 10px; padding: 8px 10px; margin: 10px 0 0; }
        .pr-close { margin-top: 16px; width: 100%; background: var(--ink); color: var(--paper); border: 0; border-radius: 999px; padding: 12px; font-family: var(--body); font-weight: 800; font-size: 15px; cursor: pointer; }
      `}</style>
    </div>
  );
}
