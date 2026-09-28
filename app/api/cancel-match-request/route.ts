import { NextResponse } from 'next/server';
import { isUuid, jsonError, readJson, requireUser } from '@/lib/server/auth';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { leaveGroup } from '@/lib/server/groupLifecycle';

/**
 * POST { request_id } — the signed-in user cancels their own match request.
 *  - still searching             → cancelled, nothing else
 *  - matched, invites pending    → group withdrawn for everyone, no strike
 *  - matched, group confirmed    → same as leaving the group (strike; group continues if ≥2 remain)
 */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const { request_id } = await readJson<{ request_id: string }>(request);
  if (!isUuid(request_id)) return jsonError('request_id required', 400);

  const admin = getAdmin();
  const { data: req } = await admin
    .from('match_requests')
    .select('id, user_id, status, matched_group_id')
    .eq('id', request_id)
    .maybeSingle();

  if (!req) return jsonError('Request not found', 404);
  if (req.user_id !== userId) return jsonError('Not your request', 403);

  const now = new Date().toISOString();

  if (req.status === 'searching' || !req.matched_group_id) {
    await admin
      .from('match_requests')
      .update({ status: 'cancelled_by_user', resolved_at: now })
      .eq('id', request_id)
      .in('status', ['searching', 'matched']);
    return NextResponse.json({ ok: true, cancelled_group: false, strike_issued: false });
  }

  const result = await leaveGroup(userId, req.matched_group_id);
  if (!result.ok && result.error !== 'not_a_member') return jsonError(result.error, result.status);

  await admin.from('match_requests').update({ status: 'cancelled_by_user', resolved_at: now }).eq('id', request_id);

  return NextResponse.json({
    ok: true,
    cancelled_group: result.ok ? !result.group_continues : false,
    strike_issued: result.ok ? result.strike_issued : false,
    strike_number: result.ok ? result.strike_number : undefined,
    frozen_until: result.ok ? result.freeze_until : undefined,
  });
}
