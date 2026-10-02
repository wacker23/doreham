'use client';

import { useEffect, useState } from 'react';
import {
  FREE_MATCH_REQUESTS_PER_MONTH,
  PLUS_PRICE_MONTH_WON,
  historyLabel,
  wonLabel,
  type Membership,
} from '@/lib/plan';

/** Own-profile card: your plan, what you've used this month, and your membership history. */
export function MembershipSection({ lang }: { lang: 'en' | 'ko' }) {
  const [m, setM] = useState<Membership | null>(null);
  const [failed, setFailed] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const ko = lang === 'ko';
  const t = (en: string, k: string) => (ko ? k : en);
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(ko ? 'ko-KR' : 'en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: ko ? 'long' : 'short', day: 'numeric' });

  useEffect(() => {
    fetch('/api/plan?details=1')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setM(d as Membership))
      .catch(() => setFailed(true));
  }, []);

  if (failed) return null;

  const plus = !!m?.plus;
  const testPeriod = !!m && m.enforced === false && !plus; // plans switched off: everything unlocked
  const open = plus || testPeriod;
  const used = m?.match_requests_used ?? 0;
  const limit = m?.match_requests_limit ?? FREE_MATCH_REQUESTS_PER_MONTH;
  const history = m?.history ?? [];
  const shown = showAll ? history : history.slice(0, 4);

  return (
    <div className={`ms-card ${open ? 'plus' : ''}`}>
      <div className="ms-top">
        <h3>{t('Membership', '멤버십')}</h3>
        <a className="ms-link" href="/plus">{t('See plans →', '플랜 보기 →')}</a>
      </div>

      {!m ? (
        <div className="ms-sub">…</div>
      ) : (
        <>
          <div className="ms-plan">
            <span className={`ms-pill ${open ? 'plus' : ''}`}>
              {plus ? '✨ Doreham+' : testPeriod ? t('🎉 Test period', '🎉 테스트 기간') : t('Free plan', '무료 플랜')}
            </span>
            <span className="ms-status">
              {testPeriod
                ? t('Everything is unlocked for everyone', '모든 기능이 모두에게 열려 있어요')
                : plus
                ? m.expires_at
                  ? t(`Active until ${date(m.expires_at)}`, `${date(m.expires_at)}까지 이용`)
                  : t('Active · no end date', '이용 중 · 기간 제한 없음')
                : t(`Doreham+ is ${wonLabel(PLUS_PRICE_MONTH_WON)} a month`, `Doreham+는 월 ${wonLabel(PLUS_PRICE_MONTH_WON)}`)}
            </span>
          </div>
          {plus && m.member_since && (
            <div className="ms-sub">{t(`Member since ${date(m.member_since)}`, `${date(m.member_since)}부터 회원`)}</div>
          )}

          <div className="ms-usage">
            <div className="ms-row">
              <span>{t('Match requests this month', '이번 달 매칭 요청')}</span>
              <b>{open ? t(`${used} · unlimited`, `${used}번 · 무제한`) : t(`${used} of ${limit}`, `${limit}번 중 ${used}번`)}</b>
            </div>
            {!open && (
              <div className="ms-bar" aria-hidden="true">
                <div style={{ width: `${Math.min(100, (used / Math.max(1, limit)) * 100)}%` }} />
              </div>
            )}
            <div className="ms-row">
              <span>{t('봉사 volunteer quests', '봉사 퀘스트')}</span>
              <b>{t('Unlimited', '무제한')}</b>
            </div>
            <div className="ms-row">
              <span>{t('Open events you host', '열어 둔 이벤트')}</span>
              <b>
                {open
                  ? t(`${m.events_open} of ${m.events_limit}`, `${m.events_limit}개 중 ${m.events_open}개`)
                  : m.events_open > 0
                    ? t(`${m.events_open} open`, `${m.events_open}개`)
                    : '—'}
              </b>
            </div>
            <div className="ms-row">
              <span>{t('Group size & categories', '인원·카테고리 선택')}</span>
              <b>{open ? t('You choose', '직접 선택') : t('Random · any', '랜덤 · 전체')}</b>
            </div>
            <div className="ms-row">
              <span>{t('Register a venue', '가게 등록')}</span>
              <b>{open ? t('Included', '포함') : '—'}</b>
            </div>
          </div>

          <div className="ms-pay">
            <div className="ms-row">
              <span>{t('Payment', '결제')}</span>
              <b>
                {plus
                  ? t('Given by Doreham · no charge', '도레함 제공 · 결제 없음')
                  : testPeriod
                    ? t('Free during the test', '테스트 기간 무료')
                    : t('Online payment opens soon', '온라인 결제 곧 시작')}
              </b>
            </div>
            {open && (
              <div className="ms-note">
                {t(
                  "You won't be charged. When payment opens we'll ask you first; nothing renews without your OK.",
                  '결제되지 않아요. 결제가 시작되면 먼저 여쭤보고, 동의 없이 갱신되지 않아요.',
                )}
              </div>
            )}
          </div>

          {!open && (
            <div className="ms-upsell">
              <div className="ms-upsell-title">{t('With Doreham+', 'Doreham+로')}</div>
              <ul>
                <li>{t('Unlimited match requests', '무제한 매칭 요청')}</li>
                <li>{t('Pick the group size and categories', '그룹 인원과 카테고리 고르기')}</li>
                <li>{t('Register your venue', '가게 등록')}</li>
                <li>{t('Host your own events', '직접 이벤트 열기')}</li>
              </ul>
              <a className="ms-cta" href="/plus">{t('Get Doreham+', 'Doreham+ 시작하기')}</a>
            </div>
          )}

          {history.length > 0 && (
            <div className="ms-hist">
              <div className="ms-hist-title">{t('History', '기록')}</div>
              {shown.map((h) => (
                <div key={h.id} className="ms-hist-row">
                  <span className="ms-hist-date">{date(h.created_at)}</span>
                  <span>
                    {historyLabel(h, lang)}
                    {h.ends_at && h.action !== 'removed' ? t(` · until ${date(h.ends_at)}`, ` · ${date(h.ends_at)}까지`) : ''}
                  </span>
                </div>
              ))}
              {history.length > 4 && !showAll && (
                <button className="ms-more" onClick={() => setShowAll(true)}>{t('Show all', '모두 보기')}</button>
              )}
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .ms-card { background: #fff; border: 1px solid var(--ink-12); border-radius: 16px; padding: 20px 24px; margin-bottom: 12px; }
        .ms-card.plus { border-color: rgba(255, 106, 61, 0.35); background: linear-gradient(160deg, rgba(255, 106, 61, 0.05), #fff 45%); }
        .ms-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        h3 { font-family: var(--display); font-weight: 800; font-size: 16px; margin: 0; }
        .ms-link { font-size: 13px; color: var(--persimmon); font-weight: 700; text-decoration: none; }
        .ms-plan { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .ms-pill { font-weight: 800; font-size: 13px; padding: 5px 12px; border-radius: 999px; background: var(--paper-2); border: 1px solid var(--ink-12); color: var(--ink); }
        .ms-pill.plus { color: var(--persimmon); background: linear-gradient(135deg, rgba(255, 106, 61, 0.14), rgba(199, 184, 224, 0.3)); border-color: rgba(255, 106, 61, 0.3); }
        .ms-status { font-size: 13.5px; color: var(--ink); font-weight: 600; }
        .ms-sub { font-size: 13px; color: var(--ink-60); margin-top: 6px; }
        .ms-usage, .ms-pay { margin-top: 14px; border-top: 1px solid var(--ink-12); padding-top: 10px; display: grid; gap: 8px; }
        .ms-row { display: flex; justify-content: space-between; gap: 12px; font-size: 13.5px; color: var(--ink-60); }
        .ms-row b { color: var(--ink); font-weight: 700; text-align: right; }
        .ms-bar { height: 6px; border-radius: 999px; background: var(--paper-2); border: 1px solid var(--ink-12); overflow: hidden; margin-top: -2px; }
        .ms-bar div { height: 100%; background: var(--persimmon); border-radius: 999px; }
        .ms-note { font-size: 12.5px; color: var(--ink-60); line-height: 1.5; }
        .ms-upsell { margin-top: 14px; background: rgba(199, 184, 224, 0.16); border: 1px solid rgba(199, 184, 224, 0.55); border-radius: 14px; padding: 14px 16px; }
        .ms-upsell-title { font-weight: 800; font-size: 14px; color: var(--ink); margin-bottom: 6px; }
        .ms-upsell ul { list-style: none; margin: 0 0 12px; padding: 0; display: grid; gap: 4px; }
        .ms-upsell li { font-size: 13px; color: var(--ink); padding-left: 20px; position: relative; }
        .ms-upsell li::before { content: '✓'; position: absolute; left: 2px; color: var(--jade); font-weight: 800; }
        .ms-cta { display: inline-block; background: var(--persimmon); color: #fff; font-weight: 700; font-size: 13.5px; border-radius: 999px; padding: 9px 18px; text-decoration: none; }
        .ms-hist { margin-top: 14px; border-top: 1px solid var(--ink-12); padding-top: 10px; display: grid; gap: 6px; }
        .ms-hist-title { font-weight: 800; font-size: 13px; color: var(--ink); }
        .ms-hist-row { display: flex; gap: 10px; font-size: 13px; color: var(--ink); line-height: 1.45; }
        .ms-hist-date { color: var(--ink-60); white-space: nowrap; min-width: 92px; }
        .ms-more { justify-self: start; border: 0; background: none; padding: 0; color: var(--jade); font-weight: 700; font-size: 13px; cursor: pointer; font-family: var(--body); }
      `}</style>
    </div>
  );
}
