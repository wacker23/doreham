'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/hooks/useUser';
import { useLang } from '@/lib/hooks/useLang';
import { AppHeader } from '@/components/AppHeader';
import { AppTabBar } from '@/components/AppTabBar';
import { Avatar } from '@/components/Avatar';
import { PerkRedeemSheet } from '@/components/PerkRedeemSheet';
import { cityName } from '@/lib/cities';
import { BADGES, LEVELS, LEVEL_UNLOCKS, POINT_RULES, levelByNumber, reasonLabel } from '@/lib/points';
import { perkError, perkText, type LeaderboardResponse, type MySummary, type Perk, type Redemption } from '@/lib/pointsTypes';

type Tab = 'ranking' | 'me' | 'perks';
type Period = 'month' | 'all';

function monthLabel(period: string, lang: 'en' | 'ko') {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return '';
  return lang === 'ko' ? `${m}월` : new Date(Date.UTC(y, m - 1, 15)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [lang, setLang] = useLang();
  const ko = lang === 'ko';
  const [tab, setTab] = useState<Tab>('ranking');
  const [period, setPeriod] = useState<Period>('month');
  const [board, setBoard] = useState<LeaderboardResponse | null>(null);
  const [mine, setMine] = useState<MySummary | null>(null);
  const [perks, setPerks] = useState<{ level: number; perks: Perk[] } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [redemption, setRedemption] = useState<Redemption | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/sign-in?return=/leaderboard');
  }, [loading, user, router]);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from the URL after hydration
    if (t === 'me' || t === 'perks') setTab(t);
  }, []);

  const loadBoard = useCallback(async (p: Period) => {
    setBoard(null);
    const r = await fetch(`/api/points/leaderboard?period=${p}`);
    if (r.ok) setBoard(await r.json());
    else setError('load');
  }, []);
  const loadMine = useCallback(async () => {
    const r = await fetch('/api/points/me');
    if (r.ok) setMine(await r.json());
    else setError('load');
  }, []);
  const loadPerks = useCallback(async () => {
    const r = await fetch('/api/perks');
    if (r.ok) setPerks(await r.json());
    else setError('load');
  }, []);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch when the period changes
    loadBoard(period);
  }, [user, period, loadBoard]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch once signed in
    loadMine();
    loadPerks();
  }, [user, loadMine, loadPerks]);

  function pickTab(t: Tab) {
    setTab(t);
    try {
      const url = new URL(window.location.href);
      if (t === 'ranking') url.searchParams.delete('tab');
      else url.searchParams.set('tab', t);
      window.history.replaceState(null, '', url.toString());
    } catch {
      /* ignore */
    }
  }

  async function setHidden(hidden: boolean) {
    setBusy('hide');
    await fetch('/api/points/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leaderboard_hidden: hidden }) });
    await Promise.all([loadMine(), loadBoard(period)]);
    setBusy('');
  }

  async function redeem(p: Perk) {
    setBusy(p.id);
    setError('');
    const r = await fetch(`/api/perks/${p.id}/redeem`, { method: 'POST' });
    const j = await r.json().catch(() => ({}));
    setBusy('');
    if (!r.ok) {
      setError(perkError(j.error || '', lang));
      return;
    }
    setRedemption(j as Redemption);
    loadPerks();
  }

  if (loading || !user) return null;

  const myLevel = levelByNumber(mine?.level ?? perks?.level ?? 1);

  return (
    <>
      <AppHeader lang={lang} setLang={setLang} />
      <main className="wrap lb-wrap">
        <h1>{ko ? '랭킹' : 'Ranking'}</h1>
        <p className="lb-sub">
          {ko
            ? '전국 하나의 순위표예요. 퀘스트에 나오고, 봉사하고, 이벤트를 열면 포인트가 쌓여요.'
            : 'One leaderboard for all of Korea. Earn points by showing up, volunteering and hosting.'}
        </p>

        <div className="lb-tabs" role="tablist">
          {(
            [
              ['ranking', ko ? '🏆 순위' : '🏆 Ranking'],
              ['me', ko ? '⭐ 내 포인트' : '⭐ My points'],
              ['perks', ko ? '🎁 혜택' : '🎁 Perks'],
            ] as [Tab, string][]
          ).map(([t, label]) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => pickTab(t)}>
              {label}
            </button>
          ))}
        </div>

        {error === 'load' && <p className="lb-error">{ko ? '불러오지 못했어요. 새로고침해 주세요.' : "Couldn't load. Please refresh."}</p>}

        {/* ================= RANKING ================= */}
        {tab === 'ranking' && (
          <div>
            <div className="lb-period">
              <button className={period === 'month' ? 'on' : ''} onClick={() => setPeriod('month')}>
                {ko ? `이번 달${board ? ` (${monthLabel(board.month, 'ko')})` : ''}` : `This month${board ? ` (${monthLabel(board.month, 'en')})` : ''}`}
              </button>
              <button className={period === 'all' ? 'on' : ''} onClick={() => setPeriod('all')}>
                {ko ? '전체 기간' : 'All time'}
              </button>
            </div>

            {board?.hidden ? (
              <div className="lb-me muted-card">
                🙈 {ko ? '순위표에서 나를 숨겼어요.' : "You're hidden from the leaderboard."}{' '}
                <button className="linkish" disabled={busy === 'hide'} onClick={() => setHidden(false)}>
                  {ko ? '다시 보이기' : 'Show me again'}
                </button>
              </div>
            ) : board?.me ? (
              <div className="lb-me">
                <span className="lb-me-rank">#{board.me.rank}</span>
                <span>
                  {ko ? '내 순위' : 'Your rank'} · <strong>{ko ? `${board.me.points.toLocaleString()}점` : `${board.me.points.toLocaleString()} pts`}</strong>
                </span>
              </div>
            ) : board ? (
              <div className="lb-me muted-card">
                🌱 {ko ? '아직 순위가 없어요. 퀘스트를 마치면 순위표에 올라가요.' : 'Not on the board yet. Finish a quest to get on it.'}{' '}
                <a href="/matches">{ko ? '매칭 요청하기 →' : 'Request a match →'}</a>
              </div>
            ) : null}

            {!board ? (
              <div className="lb-skel" />
            ) : board.entries.length === 0 ? (
              <div className="lb-empty">
                <div className="lb-empty-icon">🏁</div>
                <strong>{ko ? '이번 달은 아직 아무도 포인트가 없어요' : 'No points yet this month'}</strong>
                <span>{ko ? '첫 번째 주인공이 되어 보세요!' : 'Be the first on the board!'}</span>
              </div>
            ) : (
              <>
                <div className="lb-podium">
                  {[1, 0, 2].map((i) => {
                    const e = board.entries[i];
                    if (!e) return <div key={i} className="pod empty" />;
                    const lv = levelByNumber(e.user.level);
                    return (
                      <a key={e.user.id} href={`/profile/${e.user.id}`} className={`pod p${i + 1} ${e.is_me ? 'me' : ''}`}>
                        <span className="medal">{['🥇', '🥈', '🥉'][i]}</span>
                        <Avatar name={e.user.display_name} url={e.user.photo_url} size={i === 0 ? 64 : 52} />
                        <span className="pod-name">{e.user.display_name}</span>
                        <span className="pod-lv">
                          {lv.emoji} {ko ? lv.ko : lv.en}
                        </span>
                        <span className="pod-pts">{e.points.toLocaleString()}</span>
                        <span className="pod-base">{e.rank}</span>
                      </a>
                    );
                  })}
                </div>
                <ol className="lb-list">
                  {board.entries.slice(3).map((e) => {
                    const lv = levelByNumber(e.user.level);
                    return (
                      <li key={e.user.id} className={e.is_me ? 'me' : ''}>
                        <a href={`/profile/${e.user.id}`}>
                          <span className="r">{e.rank}</span>
                          <Avatar name={e.user.display_name} url={e.user.photo_url} size={36} />
                          <span className="who">
                            <span className="n">{e.user.display_name}</span>
                            <span className="s">
                              {lv.emoji} {ko ? lv.ko : lv.en}
                              {e.user.city ? ` · ${cityName(e.user.city, lang)}` : ''}
                            </span>
                          </span>
                          <span className="p">{e.points.toLocaleString()}</span>
                        </a>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
            <p className="lb-foot">
              {ko
                ? '매달 1일 한국 시간 0시에 이번 달 순위가 새로 시작돼요. 월간 톱 10은 🏆 배지를 받아요.'
                : 'The monthly ranking restarts on the 1st at midnight Korea time. The monthly top 10 get the 🏆 badge.'}
            </p>
          </div>
        )}

        {/* ================= MY POINTS ================= */}
        {tab === 'me' && (
          <div>
            {!mine ? (
              <div className="lb-skel" />
            ) : (
              <>
                <div className="lvl-card">
                  <div className="lvl-emoji" aria-hidden="true">{myLevel.emoji}</div>
                  <div className="lvl-body">
                    <div className="lvl-name">
                      {ko ? `${myLevel.ko} · 레벨 ${myLevel.n}` : `${myLevel.en} · Level ${myLevel.n}`}
                    </div>
                    <div className="lvl-total">
                      {Math.max(0, mine.total).toLocaleString()} <span>{ko ? '포인트' : 'points'}</span>
                    </div>
                    <div className="lvl-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(mine.progress * 100)}>
                      <span style={{ width: `${Math.round(mine.progress * 100)}%` }} />
                    </div>
                    <div className="lvl-next">
                      {mine.next_level
                        ? ko
                          ? `${levelByNumber(mine.next_level).emoji} ${levelByNumber(mine.next_level).ko}까지 ${mine.needed}점`
                          : `${mine.needed} more to ${levelByNumber(mine.next_level).emoji} ${levelByNumber(mine.next_level).en}`
                        : ko ? '최고 레벨이에요! 🎉' : "You're at the top level! 🎉"}
                    </div>
                  </div>
                </div>

                <div className="stats">
                  <div>
                    <strong>{mine.month_points}</strong>
                    <span>{ko ? `${monthLabel(mine.month, 'ko')} 포인트` : `Points in ${monthLabel(mine.month, 'en')}`}</span>
                  </div>
                  <div>
                    <strong>{mine.hidden ? '—' : mine.month_rank ? `#${mine.month_rank}` : '—'}</strong>
                    <span>{ko ? '이번 달 순위' : 'Rank this month'}</span>
                  </div>
                  <div>
                    <strong>{mine.stats.quests}</strong>
                    <span>{ko ? '완료한 퀘스트' : 'Quests done'}</span>
                  </div>
                  <div>
                    <strong>{mine.stats.hosted}</strong>
                    <span>{ko ? '연 이벤트' : 'Events hosted'}</span>
                  </div>
                </div>

                <h2>{ko ? '배지' : 'Badges'}</h2>
                <div className="badges">
                  {BADGES.map((b) => {
                    const earned = mine.badges.find((x) => x.id === b.id)?.earned;
                    return (
                      <div key={b.id} className={`bdg ${earned ? 'on' : ''}`} title={ko ? b.how_ko : b.how_en}>
                        <span className="be">{earned ? b.emoji : '🔒'}</span>
                        <span className="bn">{ko ? b.ko : b.en}</span>
                        <span className="bh">{ko ? b.how_ko : b.how_en}</span>
                      </div>
                    );
                  })}
                </div>

                <h2>{ko ? '포인트 얻는 법' : 'How to earn points'}</h2>
                <ul className="rules">
                  {POINT_RULES.map((r) => (
                    <li key={r.reason}>
                      <span>
                        {r.emoji} {ko ? r.ko : r.en}
                      </span>
                      <strong className={r.points < 0 ? 'neg' : ''}>{r.points > 0 ? `+${r.points}` : r.points}</strong>
                    </li>
                  ))}
                </ul>
                <p className="small-note">
                  {ko
                    ? '포인트는 확인된 활동에만 쌓여요. 혜택은 전체 기간 포인트로 정해지는 레벨로 열려요. 포인트는 현금 가치가 없어요.'
                    : 'Points come only from activity we can verify. Your level (from all-time points) unlocks perks. Points have no cash value.'}
                </p>

                <h2>{ko ? '최근 기록' : 'History'}</h2>
                {mine.history.length === 0 ? (
                  <p className="muted">{ko ? '아직 기록이 없어요.' : 'Nothing yet.'}</p>
                ) : (
                  <ul className="hist">
                    {mine.history.map((h, i) => (
                      <li key={i}>
                        <span>{reasonLabel(h.reason, lang)}</span>
                        <span className="hd">{new Date(h.created_at).toLocaleDateString(ko ? 'ko-KR' : 'en-US', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric' })}</span>
                        <strong className={h.delta < 0 ? 'neg' : ''}>{h.delta > 0 ? `+${h.delta}` : h.delta}</strong>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="vis">
                  <label>
                    <input type="checkbox" checked={!mine.hidden} disabled={busy === 'hide'} onChange={(e) => setHidden(!e.target.checked)} />
                    {ko ? '전국 순위표에 나를 보여 주기' : 'Show me on the national leaderboard'}
                  </label>
                  <span>
                    {ko
                      ? '순위표에는 이름, 사진, 도시, 레벨, 포인트가 보여요. 꺼도 포인트와 혜택은 그대로예요.'
                      : 'The leaderboard shows your name, photo, city, level and points. Turning it off keeps your points and perks.'}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* ================= PERKS ================= */}
        {tab === 'perks' && (
          <div>
            <div className="lb-me">
              <span className="lb-me-rank">{myLevel.emoji}</span>
              <span>
                {ko ? '내 레벨' : 'Your level'}: <strong>{ko ? myLevel.ko : myLevel.en}</strong>
              </span>
            </div>

            <h2>{ko ? '레벨 혜택' : 'Level unlocks'}</h2>
            <ul className="unlocks">
              {LEVELS.slice(1).map((l) => {
                const items = LEVEL_UNLOCKS.filter((u) => u.level === l.n);
                const open = myLevel.n >= l.n;
                return (
                  <li key={l.n} className={open ? 'on' : ''}>
                    <span className="ul-lv">
                      {l.emoji} {ko ? l.ko : l.en}
                      <em>{l.min.toLocaleString()}+</em>
                    </span>
                    <span className="ul-items">
                      {items.length ? items.map((u) => <span key={u.en}>{open ? '✓' : '🔒'} {ko ? u.ko : u.en}</span>) : <span>{open ? '✓' : '🔒'} {ko ? '더 많은 가게 혜택' : 'More venue perks'}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>

            <h2>{ko ? '제휴 가게 혜택' : 'Partner venue perks'}</h2>
            {error && error !== 'load' && <p className="lb-error">{error}</p>}
            {!perks ? (
              <div className="lb-skel" />
            ) : perks.perks.length === 0 ? (
              <div className="lb-empty">
                <div className="lb-empty-icon">🎁</div>
                <strong>{ko ? '아직 가게 혜택이 없어요' : 'No venue perks yet'}</strong>
                <span>{ko ? '제휴 가게가 혜택을 추가하면 여기에 보여요.' : 'When partner venues add perks, they show up here.'}</span>
              </div>
            ) : (
              <div className="perks">
                {perks.perks.map((p) => {
                  const t = perkText(p, lang);
                  const need = levelByNumber(p.min_level);
                  return (
                    <div key={p.id} className={`perk ${p.unlocked ? '' : 'locked'}`}>
                      <div className="pk-top">
                        <a className="pk-venue" href={`/venues/${p.venue.id}`}>
                          {p.venue.name} · {cityName(p.venue.city, lang)}
                        </a>
                        <span className="pk-lv">
                          {need.emoji} {ko ? `${need.ko} 이상` : `${need.en}+`}
                        </span>
                      </div>
                      <div className="pk-title">{t.title}</div>
                      {t.details && <div className="pk-details">{t.details}</div>}
                      <div className="pk-act">
                        {p.unlocked ? (
                          <button className="pk-use" disabled={busy === p.id} onClick={() => redeem(p)}>
                            {p.used_today ? (ko ? '오늘 사용함 · 다시 보기' : 'Used today · Show again') : ko ? '지금 사용하기' : 'Use now'}
                          </button>
                        ) : (
                          <span className="pk-lock">
                            🔒 {ko ? `${need.ko} 레벨에서 열려요` : `Unlocks at ${need.en}`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="small-note">
              {ko
                ? '혜택은 각 가게가 제공해요. 계산하기 전에 직원에게 화면을 보여 주세요. 혜택마다 하루 한 번 사용할 수 있어요.'
                : 'Perks are offered by each venue. Show the screen to staff before you pay. Each perk can be used once a day.'}
            </p>
          </div>
        )}
      </main>

      {redemption && <PerkRedeemSheet lang={lang} r={redemption} onClose={() => setRedemption(null)} />}

      <AppTabBar lang={lang} />

      <style jsx>{`
        .lb-wrap { max-width: 720px; padding-top: 22px; padding-bottom: 48px; }
        h1 { font-family: var(--display); font-weight: 800; font-size: 30px; letter-spacing: -0.02em; margin: 0 0 4px; }
        h2 { font-family: var(--display); font-weight: 800; font-size: 18px; margin: 26px 0 10px; }
        .lb-sub { color: var(--ink-60); font-size: 14.5px; margin: 0 0 16px; }
        .muted { color: var(--ink-60); font-size: 14px; }
        .lb-error { color: #b42318; background: #fef3f2; border-radius: 12px; padding: 10px 14px; font-size: 14px; }
        .lb-tabs { display: flex; gap: 4px; background: var(--paper-2); border: 1px solid var(--ink-12); border-radius: 999px; padding: 4px; margin-bottom: 16px; }
        .lb-tabs button { flex: 1; border: 0; background: transparent; border-radius: 999px; padding: 9px 8px; font-family: var(--body); font-weight: 700; font-size: 14px; color: var(--ink-60); cursor: pointer; white-space: nowrap; }
        .lb-tabs button.on { background: var(--ink); color: var(--paper); }
        .lb-period { display: flex; gap: 8px; margin-bottom: 12px; }
        .lb-period button { border: 1px solid var(--ink-12); background: #fff; border-radius: 999px; padding: 7px 14px; font-family: var(--body); font-weight: 700; font-size: 13px; color: var(--ink); cursor: pointer; }
        .lb-period button.on { background: var(--persimmon); border-color: var(--persimmon); color: #fff; }
        .lb-me { display: flex; align-items: center; gap: 12px; background: #fff; border: 2px solid rgba(255, 106, 61, 0.35); border-radius: 16px; padding: 12px 16px; font-size: 14.5px; margin-bottom: 16px; flex-wrap: wrap; }
        .lb-me.muted-card { border: 1px solid var(--ink-12); background: var(--paper-2); color: var(--ink); }
        .lb-me a, .linkish { color: var(--persimmon); font-weight: 700; text-decoration: none; background: none; border: 0; padding: 0; cursor: pointer; font-family: var(--body); font-size: 14px; }
        .lb-me-rank { font-family: var(--display); font-weight: 800; font-size: 22px; color: var(--persimmon); }
        .lb-skel { height: 220px; border-radius: 18px; background: var(--paper-2); border: 1px solid var(--ink-12); }
        .lb-empty { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; padding: 40px 16px; background: var(--paper-2); border-radius: 20px; color: var(--ink); }
        .lb-empty span { color: var(--ink-60); font-size: 14px; }
        .lb-empty-icon { font-size: 40px; }

        .lb-podium { display: grid; grid-template-columns: 1fr 1.1fr 1fr; gap: 8px; align-items: end; margin: 8px 0 14px; }
        .pod { display: flex; flex-direction: column; align-items: center; gap: 4px; text-decoration: none; color: var(--ink); min-width: 0; }
        .pod.empty { visibility: hidden; }
        .medal { font-size: 22px; }
        .pod-name { font-weight: 800; font-size: 14px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pod-lv { font-size: 12px; color: var(--ink-60); }
        .pod-pts { font-family: var(--display); font-weight: 800; font-size: 16px; }
        .pod-base { width: 100%; border-radius: 14px 14px 6px 6px; background: var(--paper-2); border: 1px solid var(--ink-12); text-align: center; font-family: var(--display); font-weight: 800; font-size: 20px; color: var(--ink-60); padding-top: 8px; }
        .pod.p1 .pod-base { height: 76px; background: linear-gradient(180deg, rgba(255, 106, 61, 0.18), rgba(255, 106, 61, 0.05)); color: var(--persimmon); }
        .pod.p2 .pod-base { height: 56px; }
        .pod.p3 .pod-base { height: 42px; }
        .pod.me .pod-name { color: var(--persimmon); }

        .lb-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
        .lb-list a { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: #fff; border: 1px solid var(--ink-12); border-radius: 14px; text-decoration: none; color: var(--ink); }
        .lb-list li.me a { border: 2px solid rgba(255, 106, 61, 0.45); }
        .r { width: 26px; text-align: center; font-family: var(--display); font-weight: 800; color: var(--ink-60); }
        .who { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .n { font-weight: 700; font-size: 14.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .s { font-size: 12.5px; color: var(--ink-60); }
        .p { font-family: var(--display); font-weight: 800; font-size: 16px; }
        .lb-foot, .small-note { color: var(--ink-60); font-size: 12.5px; margin: 14px 0 0; line-height: 1.5; }

        .lvl-card { display: flex; gap: 16px; align-items: center; background: linear-gradient(135deg, rgba(199, 184, 224, 0.35), rgba(245, 194, 199, 0.3)); border: 1px solid var(--ink-12); border-radius: 22px; padding: 18px; }
        .lvl-emoji { font-size: 58px; line-height: 1; }
        .lvl-body { flex: 1; min-width: 0; }
        .lvl-name { font-weight: 800; font-size: 15px; }
        .lvl-total { font-family: var(--display); font-weight: 800; font-size: 30px; }
        .lvl-total span { font-size: 15px; color: var(--ink-60); }
        .lvl-bar { height: 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.7); overflow: hidden; margin: 6px 0 4px; }
        .lvl-bar span { display: block; height: 100%; background: var(--persimmon); border-radius: 999px; }
        .lvl-next { font-size: 13px; color: var(--ink-60); font-weight: 600; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 12px; }
        .stats div { background: #fff; border: 1px solid var(--ink-12); border-radius: 14px; padding: 10px; display: flex; flex-direction: column; gap: 2px; }
        .stats strong { font-family: var(--display); font-size: 20px; }
        .stats span { font-size: 12px; color: var(--ink-60); }
        .badges { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
        .bdg { display: flex; flex-direction: column; gap: 2px; background: var(--paper-2); border: 1px dashed var(--ink-12); border-radius: 14px; padding: 10px 12px; opacity: 0.75; }
        .bdg.on { background: #fff; border: 1px solid rgba(255, 106, 61, 0.35); opacity: 1; }
        .be { font-size: 24px; }
        .bn { font-weight: 800; font-size: 14px; }
        .bh { font-size: 12px; color: var(--ink-60); line-height: 1.35; }
        .rules, .hist { list-style: none; padding: 0; margin: 0; background: #fff; border: 1px solid var(--ink-12); border-radius: 16px; overflow: hidden; }
        .rules li, .hist li { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-top: 1px solid var(--ink-12); font-size: 14px; }
        .rules li:first-child, .hist li:first-child { border-top: 0; }
        .rules li span, .hist li span:first-child { flex: 1; }
        .rules strong, .hist strong { font-family: var(--display); color: var(--jade); }
        .neg { color: #b42318 !important; }
        .hd { color: var(--ink-60); font-size: 12.5px; }
        .vis { margin-top: 22px; background: var(--paper-2); border: 1px solid var(--ink-12); border-radius: 14px; padding: 12px 14px; display: flex; flex-direction: column; gap: 4px; }
        .vis label { display: flex; gap: 8px; align-items: center; font-weight: 700; font-size: 14.5px; cursor: pointer; }
        .vis span { font-size: 12.5px; color: var(--ink-60); }

        .unlocks { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
        .unlocks li { display: flex; gap: 12px; align-items: flex-start; background: var(--paper-2); border: 1px solid var(--ink-12); border-radius: 14px; padding: 10px 14px; font-size: 14px; color: var(--ink-60); }
        .unlocks li.on { background: #fff; color: var(--ink); }
        .ul-lv { width: 130px; flex-shrink: 0; font-weight: 800; color: var(--ink); display: flex; flex-direction: column; }
        .ul-lv em { font-style: normal; font-weight: 600; font-size: 12px; color: var(--ink-60); }
        .ul-items { display: flex; flex-direction: column; gap: 2px; }
        .perks { display: flex; flex-direction: column; gap: 10px; }
        .perk { background: #fff; border: 1px solid var(--ink-12); border-radius: 16px; padding: 14px 16px; }
        .perk.locked { background: var(--paper-2); }
        .pk-top { display: flex; justify-content: space-between; gap: 8px; align-items: center; flex-wrap: wrap; }
        .pk-venue { font-size: 13px; font-weight: 700; color: var(--ink-60); text-decoration: none; }
        .pk-lv { font-size: 12px; font-weight: 800; background: rgba(199, 184, 224, 0.4); border-radius: 999px; padding: 2px 9px; }
        .pk-title { font-family: var(--display); font-weight: 800; font-size: 17px; margin-top: 4px; }
        .pk-details { font-size: 13.5px; color: var(--ink-60); margin-top: 2px; }
        .pk-act { margin-top: 10px; }
        .pk-use { background: var(--persimmon); color: #fff; border: 0; border-radius: 999px; padding: 9px 18px; font-family: var(--body); font-weight: 800; font-size: 14px; cursor: pointer; }
        .pk-use:disabled { opacity: 0.6; }
        .pk-lock { font-size: 13px; color: var(--ink-60); font-weight: 600; }
        @media (max-width: 560px) {
          h1 { font-size: 26px; }
          .stats { grid-template-columns: repeat(2, 1fr); }
          .lb-tabs button { font-size: 13px; }
          .ul-lv { width: 100px; }
        }
      `}</style>
    </>
  );
}
