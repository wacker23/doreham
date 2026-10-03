import { NextResponse } from 'next/server';
import { isUuid, jsonError, readJson, requireUser } from '@/lib/server/auth';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { lockQuestDate } from '@/lib/server/scheduling';

/**
 * POST { group_id } — called by the voting page. Locks the winning slot once
 * everyone voted or the deadline passed (KST weekend/evening tie-breaker). Idempotent.
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { group_id } = await readJson<{ group_id: string }>(request);
  if (!isUuid(group_id)) return jsonError('group_id required', 400);

  const { data: member } = await getAdmin()
    .from('group_members')
    .select('user_id')
    .eq('group_id', group_id)
    .eq('user_id', auth.user.id)
    .not('accepted_at', 'is', null)
    .is('left_at', null)
    .maybeSingle();
  if (!member) return jsonError('not_a_member', 403);

  const result = await lockQuestDate(group_id);
  if (!result.ok) return jsonError(result.error, result.status);
  return NextResponse.json(result);
}
