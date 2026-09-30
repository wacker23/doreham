'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { useLang } from '@/lib/hooks/useLang';
import { AppHeader } from '@/components/AppHeader';
import { AppTabBar } from '@/components/AppTabBar';
import {
  FREE_MATCH_REQUESTS_PER_MONTH,
  PLAN_ROWS,
  PLUS_PRICE_MONTH_WON,
  PLUS_PRICE_YEAR_WON,
  wonLabel,
  type PlanRow,
  type PlanStatus,
} from '@/lib/plan';

const SUPPORT_EMAIL = 'support@doreham.co.kr';

/** Doreham+ : what you get, your plan, and (for now) how to get it. */
export default function PlusPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [lang, setLang] = useLang();
  const ko = lang === 'ko';
  const t = (en: string, k: string) => (ko ? k : en);
  const [plan, setPlan] = useState<PlanStatus | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/sign-in?return=/plus');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    fetch('/api/plan')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPlan(d as PlanStatus))
      .catch(() => {});
  }, [user]);

  const cell = (c: PlanRow['free']) =>
    c === true ? <span className="yes" aria-label={t('Included', '포함')}>✓</span>
    : c === false ? <span className="no" aria-label={t('Not included', '미포함')}>—</span>
    : <span>{ko ? c.ko : c.en}</span>;

  const until = plan?.expires_at
    ? new Date(plan.expires_at).toLocaleDateString(ko ? 'ko-KR' : 'en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: ko ? 'long' : 'short', day: 'numeric' })
    : null;
  const left = plan ? Math.max(0, plan.match_requests_limit - plan.match_requests_used) : null;

  return (
    <>
      <AppHeader lang={lang} setLang={setLang} />
      <main className="app-page narrow plus-wrap">
        <div className="plus-hero">
          <div className="mark" aria-hidden="true">✨</div>
          <h1>Doreham+</h1>
          <p className="lead">
            {t(
              'More ways to meet people. Everything you need to make friends stays free.',
              '사람들을 만나는 더 많은 방법. 친구를 사귀는 데 필요한 건 계속 무료예요.',
            )}
          </p>
        </div>

        <div className={`status ${plan?.plus ? 'on' : ''}`}>
          {!plan ? (
            <span className="muted">…</span>
          ) : plan.plus ? (
            <>
              <div className="status-title">✨ {t('You have Doreham+', 'Doreham+ 이용 중')}</div>
              <div className="status-sub">{until ? t(`Until ${until}`, `${until}까지`) : t('No end date', '기간 제한 없음')}</div>
            </>
          ) : (
            <>
              <div className="status-title">{t('Free plan', '무료 플랜')}</div>
              <div className="status-sub">
                {t(
                  `${left} of ${FREE_MATCH_REQUESTS_PER_MONTH} match requests left this month`,
                  `이번 달 매칭 요청 ${FREE_MATCH_REQUESTS_PER_MONTH}번 중 ${left}번 남음`,
                )}
              </div>
            </>
          )}
        </div>

        <div className="table" role="table" aria-label={t('Free and Doreham+', '무료와 Doreham+')}>
          <div className="row head" role="row">
            <div role="columnheader" />
            <div role="columnheader">{t('Free', '무료')}</div>
            <div role="columnheader" className="plus-col">Doreham+</div>
          </div>
          {PLAN_ROWS.map((r) => (
            <div className="row" role="row" key={r.en}>
              <div role="rowheader" className="feat">{ko ? r.ko : r.en}</div>
              <div role="cell">{cell(r.free)}</div>
              <div role="cell" className="plus-col">{cell(r.plus)}</div>
            </div>
          ))}
        </div>

        <div className="price">
          <div className="amount">
            {wonLabel(PLUS_PRICE_MONTH_WON)} <span>/ {t('month', '월')}</span>
          </div>
          <div className="or">
            {t(`or ${wonLabel(PLUS_PRICE_YEAR_WON)} a year`, `또는 1년 ${wonLabel(PLUS_PRICE_YEAR_WON)}`)}
          </div>
          <p className="soon">
            {t(
              'Online payment is coming soon. Until then, Doreham gives Doreham+ to early members and partner venues.',
              '온라인 결제는 곧 열려요. 그 전까지는 도레함이 초기 회원과 제휴 가게에 Doreham+를 드리고 있어요.',
            )}
          </p>
          {!plan?.plus && (
            <a className="ask" href={`mailto:${SUPPORT_EMAIL}?subject=Doreham%2B`}>
              {t('Ask for Doreham+ →', 'Doreham+ 문의하기 →')}
            </a>
          )}
        </div>

        <ul className="fair">
          <li>{t('봉사 volunteer quests are always free.', '봉사 퀘스트는 언제나 무료예요.')}</li>
          <li>{t("A request that ends with no match doesn't count toward your free requests.", '매칭되지 않고 끝난 요청은 무료 횟수에 포함되지 않아요.')}</li>
          <li>{t('Safety tools, chat and notifications are the same for everyone.', '안전 기능, 채팅, 알림은 모두에게 똑같아요.')}</li>
          <li>{t('When payment opens, you can cancel any time in one step.', '결제가 열리면 언제든 한 번에 해지할 수 있어요.')}</li>
        </ul>
      </main>
      <AppTabBar lang={lang} />

      <style jsx global>{`
        .plus-wrap .yes { color: var(--jade); font-weight: 800; }
        .plus-wrap .no { color: var(--ink-60); }
      `}</style>
      <style jsx>{`
        .plus-wrap { padding-bottom: 96px; }
        .plus-hero { text-align: center; margin: 8px 0 20px; }
        .mark { font-size: 34px; }
        h1 { font-family: var(--display); font-weight: 800; font-size: 34px; letter-spacing: -0.02em; margin: 4px 0 6px; color: var(--ink); }
        .lead { color: var(--ink-60); font-size: 15.5px; line-height: 1.55; margin: 0 auto; max-width: 46ch; }
        .status { background: #fff; border: 1px solid var(--ink-12); border-radius: 18px; padding: 16px 20px; margin-bottom: 16px; text-align: center; }
        .status.on { border-color: rgba(255, 106, 61, 0.35); background: linear-gradient(135deg, rgba(255, 106, 61, 0.07), rgba(199, 184, 224, 0.12)); }
        .status-title { font-weight: 800; font-size: 16px; color: var(--ink); }
        .status-sub { font-size: 13.5px; color: var(--ink-60); margin-top: 2px; }
        .muted { color: var(--ink-60); }
        .table { background: #fff; border: 1px solid var(--ink-12); border-radius: 18px; overflow: hidden; }
        .row { display: grid; grid-template-columns: 1.5fr 1fr 1fr; align-items: center; border-top: 1px solid var(--ink-12); }
        .row:first-child { border-top: 0; }
        .row > div { padding: 12px 14px; font-size: 14px; color: var(--ink); text-align: center; }
        .row > div.feat { text-align: left; font-weight: 600; }
        .row.head > div { font-weight: 800; font-size: 13px; color: var(--ink-60); padding-top: 14px; padding-bottom: 10px; }
        .row.head .plus-col { color: var(--persimmon); }
        .plus-col { background: rgba(255, 106, 61, 0.04); }
        .price { text-align: center; margin: 22px 0 8px; }
        .amount { font-family: var(--display); font-weight: 800; font-size: 28px; color: var(--ink); }
        .amount span { font-size: 15px; color: var(--ink-60); font-weight: 700; }
        .or { color: var(--ink-60); font-size: 14px; margin-top: 2px; }
        .soon { color: var(--ink-60); font-size: 13.5px; line-height: 1.55; max-width: 44ch; margin: 12px auto 14px; }
        .ask { display: inline-block; background: var(--persimmon); color: #fff; font-weight: 700; font-size: 14.5px; border-radius: 999px; padding: 11px 22px; text-decoration: none; }
        .fair { list-style: none; padding: 0; margin: 22px 0 0; display: grid; gap: 8px; }
        .fair li { position: relative; padding-left: 24px; font-size: 13.5px; color: var(--ink-60); line-height: 1.5; }
        .fair li::before { content: '✓'; position: absolute; left: 4px; color: var(--jade); font-weight: 800; }
        @media (max-width: 420px) {
          .row { grid-template-columns: 1.3fr 1fr 1fr; }
          .row > div { padding: 10px 8px; font-size: 13px; }
        }
      `}</style>
    </>
  );
}
