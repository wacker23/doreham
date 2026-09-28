import { NextResponse } from 'next/server';
import { isUuid, jsonError, readJson, requireUser } from '@/lib/server/auth';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { evaluatePendingGroup } from '@/lib/server/groupLifecycle';

/** POST { group_id } — the signed-in user declines their invite (no strike). */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const { group_id } = await readJson<{ group_id: string }>(request);
  if (!isUuid(group_id)) return jsonError('group_id required', 400);

  const admin = getAdmin();
  const now = new Date().toISOString();
  const { data: updated } = await admin
    .from('group_members')
    .update({ invite_state: 'declined', declined_at: now, left_at: now })
    .eq('group_id', group_id)
    .eq('user_id', userId)
    .eq('invite_state', 'invited')
    .is('left_at', null)
    .select('user_id');

  if (!updated || updated.length === 0) return jsonError('No open invite to decline', 400);

  const state = await evaluatePendingGroup(group_id);
  return NextResponse.json({ ok: true, group_state: state });
}
