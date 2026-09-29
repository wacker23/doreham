import { NextResponse } from 'next/server';
import { isUuid, jsonError, readJson, requireUser } from '@/lib/server/auth';
import { getAdmin } from '@/lib/server/supabaseAdmin';
import { evaluatePendingGroup } from '@/lib/server/groupLifecycle';
import { hasConsent } from '@/lib/server/consents';

/** POST { group_id } — the signed-in user accepts their invite. */
export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const userId = auth.user.id;

  const { group_id } = await readJson<{ group_id: string }>(request);
  if (!isUuid(group_id)) return jsonError('group_id required', 400);

  const admin = getAdmin();
  const { data: membership } = await admin
    .from('group_members')
    .select('invite_state, invite_expires_at, left_at')
    .eq('group_id', group_id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!membership || membership.left_at) return jsonError('Not a member of this group', 403);
  if (membership.invite_state !== 'invited') {
    return jsonError(`Cannot accept — current state: ${membership.invite_state}`, 400);
  }

  // Volunteer quests finish with a group photo, so joining one needs the photo consent first.
  const { data: group } = await admin.from('groups').select('quest_type').eq('id', group_id).maybeSingle();
  if (group?.quest_type === 'volunteer' && !(await hasConsent(userId, 'volunteer_photos'))) {
    return jsonError('consent_required', 409, { consent: 'volunteer_photos' });
  }

  const { data: frozen } = await admin
    .from('user_penalties')
    .select('freeze_until')
    .eq('user_id', userId)
    .gt('freeze_until', new Date().toISOString())
    .limit(1);
  if (frozen && frozen.length > 0) return jsonError('account_frozen', 403, { frozen_until: frozen[0].freeze_until });

  const now = new Date().toISOString();
  if (membership.invite_expires_at && new Date(membership.invite_expires_at) < new Date()) {
    await admin
      .from('group_members')
      .update({ invite_state: 'expired', declined_at: now, left_at: now })
      .eq('group_id', group_id)
      .eq('user_id', userId)
      .eq('invite_state', 'invited');
    await evaluatePendingGroup(group_id);
    return jsonError('Invite has expired', 400);
  }

  const { data: updated } = await admin
    .from('group_members')
    .update({ invite_state: 'accepted', accepted_at: now })
    .eq('group_id', group_id)
    .eq('user_id', userId)
    .eq('invite_state', 'invited')
    .select('user_id');
  if (!updated || updated.length === 0) return jsonError('Invite is no longer open', 409);

  const state = await evaluatePendingGroup(group_id);
  return NextResponse.json({ ok: true, activated: state === 'activated', group_state: state });
}
