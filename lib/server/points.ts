import 'server-only';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { createNotifications } from '@/lib/notifications';
import {
  BADGES,
  LEVEL_UNLOCKS,
  kstMonth,
  levelFor,
  levelProgress,
  previousKstMonth,
  type BadgeId,
} from '@/lib/points';

/**
 * Points, levels, badges and the national leaderboard.
 * Awards are computed in SQL (public.sync_points) from verified activity and are idempotent,
 * so this can run as often as we like: from the cron, and (throttled) when someone opens the page.
 */

const FOUNDING_BEFORE = '2027-01-01T00:00:00+09:00';
const LEADERBOARD_SIZE = 50;

let lastSync = 0;

export async function syncPoints(opts: { force?: boolean } = {}) {
  if (!opts.force && Date.now() - lastSync < 60_000) return { ok: true as const, skipped: 'recent' };
  lastSync = Date.now();
  const admin = getAdmin();
  const { data, error } = await admin.rpc('sync_points');
  if (error) return { ok: false as const, error: error.message };
  const gains = (data ?? []) as { user_id: string; gained: number }[];
  if (gains.length === 0) return { ok: true as const, users: 0, level_ups: 0 };

  // Level-up notifications
  const { data: totals } = await admin.from('user_points').select('user_id, total').in('user_id', gains.map((g) => g.user_id));
  const gained = new Map(gains.map((g) => [g.user_id, g.gained]));
  const ups: Parameters<typeof createNotifications>[0] = [];
  for (const t of totals ?? []) {
    const total = t.total as number;
    const before = levelFor(total - (gained.get(t.user_id as string) ?? 0));
    const after = levelFor(total);
    if (after.n <= before.n) continue;
    const unlock = LEVEL_UNLOCKS.find((u) => u.level === after.n);
    ups.push({
      user_id: t.user_id as string,
      type: 'level_up',
      title_en: `${after.emoji} Level up: you're a ${after.en} now!`,
      title_ko: `${after.emoji} 레벨 업! 이제 ${after.ko}예요`,
      body_en: unlock ? `Unlocked: ${unlock.en}` : 'See your new perks.',
      body_ko: unlock ? `새로 열림: ${unlock.ko}` : '새 혜택을 확인해 보세요.',
      action_url: '/leaderboard?tab=me',
    });
  }
  if (ups.length) await createNotifications(ups);
  return { ok: true as const, users: gains.length, level_ups: ups.length };
}

/** Once a month has ended: store the final top 10 and tell them. Safe to call repeatedly. */
export async function snapshotPreviousMonth() {
  const admin = getAdmin();
  const prev = previousKstMonth();
  const { count } = await admin.from('leaderboard_monthly').select('user_id', { count: 'exact', head: true }).eq('period', prev.period);
  if ((count ?? 0) > 0) return { ok: true as const, skipped: 'done', period: prev.period };

  const until = kstMonth().startIso;
  const { data, error } = await admin.rpc('points_leaderboard', { p_since: prev.startIso, p_until: until, p_limit: 10, p_viewer: null });
  if (error) return { ok: false as const, error: error.message };
  const rows = ((data ?? []) as { user_id: string; points: number; rank: number }[]).filter((r) => r.rank <= 10);
  if (rows.length === 0) return { ok: true as const, period: prev.period, saved: 0 };
  const { error: insErr } = await admin
    .from('leaderboard_monthly')
    .upsert(rows.map((r) => ({ period: prev.period, user_id: r.user_id, rank: r.rank, points: r.points })), { onConflict: 'period,user_id', ignoreDuplicates: true });
  if (insErr) return { ok: false as const, error: insErr.message };

  const [y, m] = prev.period.split('-').map(Number);
  const monthEn = new Date(Date.UTC(y, m - 1, 15)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  await createNotifications(
    rows.map((r) => ({
      user_id: r.user_id,
      type: 'monthly_rank' as const,
      title_en: `🏆 You finished #${r.rank} in Korea for ${monthEn}!`,
      title_ko: `🏆 ${m}월 전국 ${r.rank}위를 했어요!`,
      body_en: 'You earned the Top 10 badge. A new month has started, good luck!',
      body_ko: '톱 10 배지를 받았어요. 새 달이 시작됐어요. 이번 달도 화이팅!',
      action_url: '/leaderboard',
      is_important: true,
    })),
  );
  return { ok: true as const, period: prev.period, saved: rows.length };
}

/** Level number for each user (1 for anyone without points). */
export async function levelsById(ids: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return out;
  const { data } = await getAdmin().from('user_points').select('user_id, total').in('user_id', unique);
  for (const r of data ?? []) out.set(r.user_id as string, levelFor(r.total as number).n);
  return out;
}

export async function levelOf(userId: string): Promise<number> {
  return (await levelsById([userId])).get(userId) ?? 1;
}

export type Period = 'month' | 'all';

export async function leaderboard(viewerId: string, period: Period) {
  await syncPoints();
  const admin = getAdmin();
  const month = kstMonth();
  const since = period === 'month' ? month.startIso : '1970-01-01T00:00:00Z';
  const { data, error } = await admin.rpc('points_leaderboard', {
    p_since: since,
    p_until: '9999-12-31T00:00:00Z',
    p_limit: LEADERBOARD_SIZE,
    p_viewer: viewerId,
  });
  if (error) return { ok: false as const, error: error.message };
  const rows = (data ?? []) as { user_id: string; points: number; rank: number }[];
  const ids = rows.map((r) => r.user_id);
  const [{ data: people }, levels, { data: mine }] = await Promise.all([
    ids.length ? admin.from('profiles').select('id, display_name, photo_url, home_district').in('id', ids) : Promise.resolve({ data: [] as never[] }),
    levelsById(ids),
    admin.from('user_points').select('leaderboard_hidden').eq('user_id', viewerId).maybeSingle(),
  ]);
  const byId = new Map((people ?? []).map((p) => [p.id as string, p]));
  const all = rows.map((r) => {
    const p = byId.get(r.user_id);
    return {
      rank: Number(r.rank),
      points: Number(r.points),
      is_me: r.user_id === viewerId,
      user: {
        id: r.user_id,
        display_name: (p?.display_name as string) ?? '',
        photo_url: (p?.photo_url as string | null) ?? null,
        city: ((p?.home_district as string | null) ?? '').toLowerCase() || null,
        level: levels.get(r.user_id) ?? 1,
      },
    };
  });
  // The function returns the top N, plus the viewer's own row at the end when they are further down.
  const me = all.find((e) => e.is_me) ?? null;
  return {
    ok: true as const,
    period,
    month: month.period,
    entries: all.slice(0, LEADERBOARD_SIZE),
    me: me ? { rank: me.rank, points: me.points } : null,
    hidden: !!mine?.leaderboard_hidden,
  };
}

type LedgerRow = { reason: string; delta: number; created_at: string; ref_key: string | null };

function badgesFrom(rows: LedgerRow[], extra: { strikes90: number; top10: boolean; joinedAt: string | null }) {
  const count = (r: string) => rows.filter((x) => x.reason === r).length;
  const quests = count('quest') + count('volunteer');
  const vol = count('volunteer');
  const hosted = count('event_host');
  const compliments = count('compliment');
  const earned: Record<BadgeId, boolean> = {
    first_quest: quests >= 1,
    regular: quests >= 5,
    adventurer: quests >= 20,
    helper: vol >= 1,
    hero: vol >= 5,
    host: hosted >= 1,
    builder: hosted >= 5,
    warm: compliments >= 10,
    reliable: quests >= 5 && extra.strikes90 === 0,
    top10: extra.top10,
    founding: !!extra.joinedAt && extra.joinedAt < new Date(FOUNDING_BEFORE).toISOString(),
  };
  return {
    stats: { quests, volunteer: vol, hosted, compliments },
    badges: BADGES.map((b) => ({ id: b.id, earned: earned[b.id] })),
  };
}

async function badgeInputs(userId: string) {
  const admin = getAdmin();
  const since90 = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const [{ data: ledger }, { count: strikes90 }, { count: top10 }, { data: profile }] = await Promise.all([
    admin.from('points_ledger').select('reason, delta, created_at, ref_key').eq('user_id', userId).order('created_at', { ascending: false }).limit(2000),
    admin.from('user_penalties').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', since90),
    admin.from('leaderboard_monthly').select('user_id', { count: 'exact', head: true }).eq('user_id', userId).lte('rank', 10),
    admin.from('profiles').select('created_at').eq('id', userId).maybeSingle(),
  ]);
  return {
    rows: (ledger ?? []) as LedgerRow[],
    strikes90: strikes90 ?? 0,
    top10: (top10 ?? 0) > 0,
    joinedAt: (profile?.created_at as string | null) ?? null,
  };
}

/** Everything for the "My points" tab. */
export async function mySummary(userId: string) {
  await syncPoints();
  const admin = getAdmin();
  const month = kstMonth();
  const [inputs, { data: up }, { data: rankRows }] = await Promise.all([
    badgeInputs(userId),
    admin.from('user_points').select('total, leaderboard_hidden').eq('user_id', userId).maybeSingle(),
    admin.rpc('points_leaderboard', { p_since: month.startIso, p_until: '9999-12-31T00:00:00Z', p_limit: 0, p_viewer: userId }),
  ]);
  const total = (up?.total as number | undefined) ?? 0;
  const monthPoints = inputs.rows.filter((r) => r.created_at >= month.startIso).reduce((s, r) => s + r.delta, 0);
  const prog = levelProgress(total);
  const b = badgesFrom(inputs.rows, inputs);
  const myRank = ((rankRows ?? []) as { user_id: string; rank: number }[]).find((r) => r.user_id === userId);
  return {
    ok: true as const,
    total,
    month: month.period,
    month_points: monthPoints,
    month_rank: myRank ? Number(myRank.rank) : null,
    level: prog.level.n,
    next_level: prog.next?.n ?? null,
    progress: prog.progress,
    needed: prog.needed,
    hidden: !!up?.leaderboard_hidden,
    stats: b.stats,
    badges: b.badges,
    history: inputs.rows.slice(0, 60).map((r) => ({ reason: r.reason, delta: r.delta, created_at: r.created_at })),
  };
}

/** Level, points and earned badges for anyone's profile. */
export async function profileSummary(userId: string) {
  const admin = getAdmin();
  const [inputs, { data: up }] = await Promise.all([
    badgeInputs(userId),
    admin.from('user_points').select('total').eq('user_id', userId).maybeSingle(),
  ]);
  const total = (up?.total as number | undefined) ?? 0;
  const b = badgesFrom(inputs.rows, inputs);
  return {
    ok: true as const,
    total: Math.max(0, total),
    level: levelFor(total).n,
    stats: b.stats,
    badges: b.badges.filter((x) => x.earned).map((x) => x.id),
  };
}

export async function setLeaderboardHidden(userId: string, hidden: boolean) {
  const { error } = await getAdmin()
    .from('user_points')
    .upsert({ user_id: userId, leaderboard_hidden: hidden, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  return error ? { ok: false as const, error: error.message } : { ok: true as const, hidden };
}
