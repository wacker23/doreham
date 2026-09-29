'use client';

import { useCallback, useEffect, useState } from 'react';
import { LEVELS, levelByNumber } from '@/lib/points';
import { perkError } from '@/lib/pointsTypes';

type OwnerPerk = {
  id: string;
  title: string;
  details: string | null;
  min_level: number;
  is_active: boolean;
  redemptions: { today: number; total: number };
};

/** "My venues": offer perks to Doreham members by level, and see today's code. */
export function VenuePerksManager({ venueId, lang }: { venueId: string; lang: 'en' | 'ko' }) {
  const ko = lang === 'ko';
  const [data, setData] = useState<{ code_today: string; max: number; perks: OwnerPerk[] } | null>(null);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');
  const [minLevel, setMinLevel] = useState(2);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [confirmDel, setConfirmDel] = useState('');

  const load = useCallback(async () => {
    const r = await fetch(`/api/venue-perks/${venueId}`);
    if (r.ok) setData(await r.json());
  }, [venueId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    load();
  }, [load]);

  async function call(key: string, method: string, body?: unknown, qs = '') {
    setBusy(key);
    setError('');
    const r = await fetch(`/api/venue-perks/${venueId}${qs}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    setBusy('');
    if (!r.ok) {
      setError(perkError(j.error || '', lang));
      return false;
    }
    await load();
    return true;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await call('add', 'POST', { title, details, min_level: minLevel })) {
      setTitle('');
      setDetails('');
      setMinLevel(2);
      setAdding(false);
    }
  }

  if (!data) return null;

  return (
    <div className="vp">
      <div className="vp-head">
        <div className="vp-title">🎁 {ko ? '도레함 회원 혜택' : 'Perks for Doreham members'}</div>
        <div className="vp-code" title={ko ? '회원 화면에 같은 코드가 보여요' : "Members' screens show the same code"}>
          {ko ? '오늘의 코드' : "Today's code"} <strong>{data.code_today}</strong>
        </div>
      </div>
      <p className="vp-help">
        {ko
          ? '레벨이 높은 회원에게 할인이나 서비스를 주면 단골이 늘어요. 회원이 “사용하기”를 누르면 이름, 레벨, 오늘의 코드가 적힌 화면이 나와요. 코드가 위 코드와 같으면 혜택을 주세요.'
          : "Give members a discount or a treat by level and they'll keep coming back. When a member taps \"Use now\" they get a screen with their name, level and today's code. If it matches the code above, give them the perk."}
      </p>

      {data.perks.length > 0 && (
        <ul className="vp-list">
          {data.perks.map((p) => {
            const lv = levelByNumber(p.min_level);
            return (
              <li key={p.id} className={p.is_active ? '' : 'off'}>
                <div className="vp-main">
                  <strong>{p.title}</strong>
                  {p.details && <span>{p.details}</span>}
                  <span className="vp-meta">
                    {lv.emoji} {ko ? `${lv.ko} 이상` : `${lv.en} and up`} · {ko ? `오늘 ${p.redemptions.today}회 · 전체 ${p.redemptions.total}회` : `Used ${p.redemptions.today} today · ${p.redemptions.total} total`}
                  </span>
                </div>
                <div className="vp-acts">
                  <button disabled={!!busy} onClick={() => call(`t-${p.id}`, 'PATCH', { perk_id: p.id, is_active: !p.is_active })}>
                    {p.is_active ? (ko ? '일시 중지' : 'Pause') : ko ? '다시 시작' : 'Resume'}
                  </button>
                  {confirmDel === p.id ? (
                    <button
                      className="danger solid"
                      disabled={!!busy}
                      onClick={async () => {
                        await call(`d-${p.id}`, 'DELETE', undefined, `?perk_id=${p.id}`);
                        setConfirmDel('');
                      }}
                    >
                      {ko ? '정말 삭제' : 'Really delete'}
                    </button>
                  ) : (
                    <button className="danger" disabled={!!busy} onClick={() => setConfirmDel(p.id)}>
                      {ko ? '삭제' : 'Delete'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <form className="vp-form" onSubmit={add}>
          <label>
            {ko ? '혜택' : 'Perk'}
            <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder={ko ? '예: 음료 10% 할인' : 'e.g. 10% off drinks'} />
          </label>
          <label>
            {ko ? '조건 (선택)' : 'Conditions (optional)'}
            <input value={details} maxLength={300} onChange={(e) => setDetails(e.target.value)} placeholder={ko ? '예: 1인 1회, 평일만' : 'e.g. One per person, weekdays only'} />
          </label>
          <label>
            {ko ? '필요한 레벨' : 'Level needed'}
            <select value={minLevel} onChange={(e) => setMinLevel(Number(e.target.value))}>
              {LEVELS.map((l) => (
                <option key={l.n} value={l.n}>
                  {l.emoji} {ko ? `${l.ko} (레벨 ${l.n})` : `${l.en} (level ${l.n})`}
                </option>
              ))}
            </select>
          </label>
          <p className="vp-help">{ko ? '한국어로 쓰면 영어로 자동 번역돼요.' : 'Write in Korean or English; we translate it automatically.'}</p>
          <div className="vp-form-acts">
            <button type="button" onClick={() => setAdding(false)}>
              {ko ? '취소' : 'Cancel'}
            </button>
            <button type="submit" className="primary" disabled={busy === 'add'}>
              {busy === 'add' ? '…' : ko ? '혜택 추가' : 'Add perk'}
            </button>
          </div>
        </form>
      ) : (
        data.perks.length < data.max && (
          <button className="vp-add" onClick={() => setAdding(true)}>
            + {ko ? '혜택 추가' : 'Add a perk'}
          </button>
        )
      )}
      {error && <p className="vp-error">{error}</p>}

      <style jsx>{`
        .vp { margin-top: 14px; border: 1px solid var(--ink-12); border-radius: 16px; padding: 14px 16px; background: #fff; }
        .vp-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
        .vp-title { font-weight: 800; font-size: 15px; color: var(--ink); }
        .vp-code { font-size: 13px; color: var(--ink-60); font-weight: 700; background: var(--paper-2); border-radius: 999px; padding: 4px 12px; }
        .vp-code strong { font-family: var(--display); font-size: 18px; letter-spacing: 0.12em; color: var(--persimmon); margin-left: 4px; }
        .vp-help { font-size: 12.5px; color: var(--ink-60); margin: 6px 0 10px; line-height: 1.5; }
        .vp-list { list-style: none; padding: 0; margin: 0 0 10px; display: flex; flex-direction: column; gap: 8px; }
        .vp-list li { display: flex; gap: 10px; justify-content: space-between; align-items: center; border: 1px solid var(--ink-12); border-radius: 12px; padding: 10px 12px; flex-wrap: wrap; }
        .vp-list li.off { opacity: 0.55; }
        .vp-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1 1 180px; font-size: 13.5px; color: var(--ink-60); }
        .vp-main strong { font-size: 15px; color: var(--ink); }
        .vp-meta { font-size: 12px; }
        .vp-acts { display: flex; gap: 6px; }
        button { font-family: var(--body); font-weight: 700; font-size: 13px; border: 1px solid var(--ink-12); background: #fff; border-radius: 999px; padding: 7px 13px; cursor: pointer; color: var(--ink); }
        button.danger { color: #b42318; }
        button.danger.solid { background: #d92d20; border-color: #d92d20; color: #fff; }
        button.primary { background: var(--persimmon); border-color: var(--persimmon); color: #fff; }
        button:disabled { opacity: 0.55; cursor: not-allowed; }
        .vp-add { width: 100%; border-style: dashed; padding: 10px; }
        .vp-form { display: flex; flex-direction: column; gap: 10px; background: var(--paper-2); border-radius: 12px; padding: 12px; }
        .vp-form label { display: flex; flex-direction: column; gap: 4px; font-weight: 700; font-size: 13px; color: var(--ink); }
        .vp-form input, .vp-form select { font-family: var(--body); font-size: 14.5px; border: 1px solid var(--ink-12); border-radius: 10px; padding: 9px 11px; background: #fff; }
        .vp-form-acts { display: flex; justify-content: flex-end; gap: 8px; }
        .vp-error { color: #b42318; background: #fef3f2; border-radius: 10px; padding: 8px 12px; font-size: 13.5px; margin: 8px 0 0; }
      `}</style>
    </div>
  );
}
