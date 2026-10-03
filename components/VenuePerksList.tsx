'use client';

import { useCallback, useEffect, useState } from 'react';
import { PerkRedeemSheet } from '@/components/PerkRedeemSheet';
import { levelByNumber } from '@/lib/points';
import { perkError, perkText, type Perk, type Redemption } from '@/lib/pointsTypes';
import { Icon } from '@/components/icons/Icon';
import { SeaArt, levelArt } from '@/components/icons/SeaArt';

/** On a venue's page: the perks it offers Doreham members, with "Use now". */
export function VenuePerksList({ venueId, lang }: { venueId: string; lang: 'en' | 'ko' }) {
  const ko = lang === 'ko';
  const [perks, setPerks] = useState<Perk[] | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [redemption, setRedemption] = useState<Redemption | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/perks?venue_id=${venueId}`);
    if (r.ok) setPerks(((await r.json()) as { perks: Perk[] }).perks);
  }, [venueId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    load();
  }, [load]);

  async function redeem(p: Perk) {
    setBusy(p.id);
    setError('');
    const r = await fetch(`/api/perks/${p.id}/redeem`, { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    setBusy('');
    if (!r.ok) return setError(perkError(j.error || '', lang));
    setRedemption(j as Redemption);
    load();
  }

  if (!perks || perks.length === 0) return null;

  return (
    <div className="vpl">
      <div className="vpl-title"><Icon name="perk" size={22} /> {ko ? '도레함 회원 혜택' : 'Doreham member perks'}</div>
      {perks.map((p) => {
        const t = perkText(p, lang);
        const need = levelByNumber(p.min_level);
        return (
          <div key={p.id} className={`vpl-item ${p.unlocked ? '' : 'locked'}`}>
            <div className="vpl-main">
              <strong>{t.title}</strong>
              {t.details && <span>{t.details}</span>}
              <span className="vpl-lv">
                <SeaArt name={levelArt(need.n)} size={18} /> {ko ? `${need.ko} 이상` : `${need.en} and up`}
              </span>
            </div>
            {p.unlocked ? (
              <button disabled={busy === p.id} onClick={() => redeem(p)}>
                {p.used_today ? (ko ? '다시 보기' : 'Show again') : ko ? '사용하기' : 'Use now'}
              </button>
            ) : (
              <a href="/leaderboard?tab=me" className="vpl-lock">
                <Icon name="lock" size={15} /> {ko ? '레벨 올리기' : 'Level up'}
              </a>
            )}
          </div>
        );
      })}
      {error && <p className="vpl-error">{error}</p>}
      {redemption && <PerkRedeemSheet lang={lang} r={redemption} onClose={() => setRedemption(null)} />}
      <style jsx>{`
        .vpl { margin: 18px 0; border: 1px solid rgba(255, 106, 61, 0.3); background: linear-gradient(135deg, rgba(255, 106, 61, 0.06), #fff 70%); border-radius: 18px; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
        .vpl-title { display: flex; align-items: center; gap: 8px; font-family: var(--display); font-weight: 800; font-size: 17px; color: var(--ink); }
        .vpl-item { display: flex; gap: 10px; align-items: center; justify-content: space-between; }
        .vpl-item.locked { opacity: 0.7; }
        .vpl-main { display: flex; flex-direction: column; gap: 1px; font-size: 13px; color: var(--ink-60); min-width: 0; }
        .vpl-main strong { font-size: 15px; color: var(--ink); }
        .vpl-lv { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 700; }
        button { flex-shrink: 0; background: var(--persimmon); color: #fff; border: 0; border-radius: 999px; padding: 8px 16px; font-family: var(--body); font-weight: 800; font-size: 13.5px; cursor: pointer; }
        button:disabled { opacity: 0.6; }
        .vpl-lock { flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 700; color: var(--ink-60); text-decoration: none; }
        .vpl-error { color: #b42318; font-size: 13px; margin: 0; }
      `}</style>
    </div>
  );
}
