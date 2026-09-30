import 'server-only';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { createNotification } from '@/lib/notifications';
import { FREE_MATCH_REQUESTS_PER_MONTH, PLUS_EXTRA_OPEN_EVENTS, type PlanStatus } from '@/lib/plan';

const FREE: PlanStatus = { plus: false, expires_at: null, match_requests_used: 0, match_requests_limit: FREE_MATCH_REQUESTS_PER_MONTH };

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
  };
}

export async function hasPlus(userId: string): Promise<boolean> {
  return (await getPlan(userId)).plus;
}

/** Extra open events a Doreham+ member can host on top of their level limit. */
export async function planEventBonus(userId: string): Promise<number> {
  return (await hasPlus(userId)) ? PLUS_EXTRA_OPEN_EVENTS : 0;
}

/**
 * Admin: give Doreham+ for `months` (null = no end date), or take it away (months = 0).
 * Giving it again extends from the current end date if it's still running.
 */
export async function setPlus(userId: string, months: number | null): Promise<{ ok: true; expires_at: string | null } | { ok: false; error: string }> {
  const admin = getAdmin();
  const { data: p } = await admin.from('profiles').select('id, subscription_tier, subscription_expires_at').eq('id', userId).maybeSingle();
  if (!p) return { ok: false, error: 'user_not_found' };

  if (months === 0) {
    const { error } = await admin.from('profiles').update({ subscription_tier: 'free', subscription_expires_at: null }).eq('id', userId);
    return error ? { ok: false, error: error.message } : { ok: true, expires_at: null };
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
