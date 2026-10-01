import 'server-only';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { createNotification } from '@/lib/notifications';
import { FREE_MATCH_REQUESTS_PER_MONTH, PLUS_EXTRA_OPEN_EVENTS, type Membership, type PlanHistoryEntry, type PlanStatus } from '@/lib/plan';
import { hostLimitForLevel } from '@/lib/points';
import { levelOf } from '@/lib/server/points';

const FREE: PlanStatus = { plus: false, expires_at: null, match_requests_used: 0, match_requests_limit: FREE_MATCH_REQUESTS_PER_MONTH, enforced: true };

/** Someone's plan, from the database (public.plan_status). Falls back to Free on errors. */
export async function getPlan(userId: string): Promise<PlanStatus> {
  const { data, error } = await getAdmin().rpc('plan_status', { p_user: userId });
  if (error || !data) return FREE;
  const d = data as Partial<PlanStatus>;
  return {
    plus: !!d.plus,
    expires_at: d.expires_at ?? null,
    match_requests_used: Number(d.match_requests_used ?? 0),
    match_requests_limit: Number(d.match_requests_limit ?? FREE_MATCH_REQUESTS_PER_MONTH),
    enforced: d.enforced !== false, // older database without the switch = enforced
  };
}

export async function hasPlus(userId: string): Promise<boolean> {
  return (await getPlan(userId)).plus;
}

/** Extra open events on top of the level limit: Doreham+ members, and everyone during the test period. */
export async function planEventBonus(userId: string): Promise<number> {
  const p = await getPlan(userId);
  return p.plus || !p.enforced ? PLUS_EXTRA_OPEN_EVENTS : 0;
}

/** The test-period switch (app_settings.plans_enforced). */
export async function getPlansEnforced(): Promise<boolean> {
  const { data, error } = await getAdmin().rpc('get_plans_enforced');
  if (error) return true;
  return data !== false;
}

export async function setPlansEnforced(on: boolean, byUserId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await getAdmin()
    .from('app_settings')
    .upsert({ key: 'plans_enforced', value: on, updated_at: new Date().toISOString(), updated_by: byUserId }, { onConflict: 'key' });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Admin: give Doreham+ for `months` (null = no end date), or take it away (months = 0).
 * Giving it again extends from the current end date if it's still running.
 */
export async function setPlus(
  userId: string,
  months: number | null,
  byUserId: string | null = null,
): Promise<{ ok: true; expires_at: string | null } | { ok: false; error: string }> {
  const admin = getAdmin();
  const { data: p } = await admin.from('profiles').select('id, subscription_tier, subscription_expires_at').eq('id', userId).maybeSingle();
  if (!p) return { ok: false, error: 'user_not_found' };

  const wasActive =
    p.subscription_tier === 'plus' && (!p.subscription_expires_at || new Date(p.subscription_expires_at as string).getTime() > Date.now());

  if (months === 0) {
    const { error } = await admin.from('profiles').update({ subscription_tier: 'free', subscription_expires_at: null }).eq('id', userId);
    if (error) return { ok: false, error: error.message };
    await logHistory({ user_id: userId, action: 'removed', months: null, ends_at: null, created_by: byUserId });
    return { ok: true, expires_at: null };
  }

  let expires: string | null = null;
  if (months != null) {
    const current = p.subscription_tier === 'plus' && p.subscription_expires_at ? new Date(p.subscription_expires_at as string) : null;
    const from = current && current.getTime() > Date.now() ? current : new Date();
    const end = new Date(from);
    end.setMonth(end.getMonth() + months);
    expires = end.toISOString();
  }
  const { error } = await admin.from('profiles').update({ subscription_tier: 'plus', subscription_expires_at: expires }).eq('id', userId);
  if (error) return { ok: false, error: error.message };
  await logHistory({ user_id: userId, action: wasActive ? 'extended' : 'granted', months, ends_at: expires, created_by: byUserId });

  const until = expires ? new Date(expires) : null;
  await createNotification({
    user_id: userId,
    type: 'plus_granted',
    title_en: '✨ You have Doreham+',
    title_ko: '✨ Doreham+가 적용됐어요',
    body_en: until
      ? `Unlimited match requests, group size and categories, venue registration and more, until ${until.toLocaleDateString('en-US', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric', year: 'numeric' })}.`
      : 'Unlimited match requests, group size and categories, venue registration and more.',
    body_ko: until
      ? `${until.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', year: 'numeric' })}까지 무제한 매칭 요청, 인원·카테고리 선택, 가게 등록 등을 이용할 수 있어요.`
      : '무제한 매칭 요청, 인원·카테고리 선택, 가게 등록 등을 이용할 수 있어요.',
    action_url: '/plus',
  });
  return { ok: true, expires_at: expires };
}

/** Membership history row (never blocks the change itself). */
async function logHistory(row: { user_id: string; action: string; months: number | null; ends_at: string | null; created_by: string | null }) {
  try {
    const { error } = await getAdmin().from('plus_history').insert({ ...row, source: 'doreham' });
    if (error) console.error('plus_history insert failed:', error.message);
  } catch (e) {
    console.error('plus_history insert exception:', e instanceof Error ? e.message : e);
  }
}

/**
 * Everything the profile's membership card shows: plan, this month's use, hosting room
 * and the membership history (newest first).
 */
export async function getMembership(userId: string): Promise<Membership> {
  const admin = getAdmin();
  const [plan, level, events, history] = await Promise.all([
    getPlan(userId),
    levelOf(userId),
    admin
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', userId)
      .eq('host_kind', 'user')
      .eq('status', 'published')
      .gt('starts_at', new Date().toISOString()),
    admin.from('plus_history').select('id, action, source, months, amount_won, ends_at, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
  ]);
  const rows = ((history.error ? [] : history.data) ?? []) as PlanHistoryEntry[];

  // "Member since": the first start after the most recent removal.
  let since: string | null = null;
  if (plan.plus) {
    for (const r of rows) {
      if (r.action === 'removed' || r.action === 'cancelled' || r.action === 'refunded') break;
      if (r.action === 'granted' || r.action === 'purchased') since = r.created_at;
    }
  }

  return {
    ...plan,
    member_since: since,
    events_open: events.count ?? 0,
    events_limit: hostLimitForLevel(level) + (plan.plus || !plan.enforced ? PLUS_EXTRA_OPEN_EVENTS : 0),
    history: rows,
  };
}
